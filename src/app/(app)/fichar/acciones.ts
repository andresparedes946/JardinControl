"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type { ResultadoFichaje, TipoFichaje } from "@/generated/prisma/enums";
import { minutosTrabajados } from "@/lib/asistencia";
import { evaluarUbicacion } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { similitudMaxima } from "@/lib/rostro";
import { requerirSesion } from "@/lib/session";
import {
  diaLocal,
  formatearHoras,
  horaLocal,
  minutosDeTardanza,
} from "@/lib/time";
import { fichajeSchema } from "@/lib/validaciones";

export type RespuestaFichaje =
  | {
      ok: true;
      tipo: TipoFichaje;
      hora: string;
      minutosTarde: number;
      trabajadas: string | null;
    }
  | { ok: false; motivo: string };

/**
 * Registra un intento de fichaje.
 *
 * Verificación 1 a 1: se compara contra los descriptores de la empleada que
 * inició sesión, no contra los de todo el jardín. No es solo más barato, es
 * más seguro: para hacerse pasar por otra habría que tener antes su
 * contraseña, así que el reconocimiento no carga solo con el peso de la
 * identidad.
 *
 * Todo intento queda escrito en `fichajes`, aceptado o rechazado, con la
 * ubicación y los scores que lo motivaron. Un rechazo del que no queda rastro
 * es un rechazo que nadie puede auditar después.
 */
export async function registrarFichaje(
  entrada: unknown,
): Promise<RespuestaFichaje> {
  const sesion = await requerirSesion();
  const empleadoId = sesion.user.empleadoId;

  if (!empleadoId) {
    return {
      ok: false,
      motivo: "Tu usuario no tiene una empleada asociada, así que no puede fichar.",
    };
  }

  const parseado = fichajeSchema.safeParse(entrada);
  if (!parseado.success) {
    return { ok: false, motivo: "Los datos del fichaje llegaron incompletos." };
  }

  const datos = parseado.data;

  const [empleado, config, cabeceras] = await Promise.all([
    prisma.empleado.findUnique({
      where: { id: empleadoId },
      include: { descriptores: { where: { activo: true } } },
    }),
    prisma.configuracion.findUnique({ where: { id: 1 } }),
    headers(),
  ]);

  if (!empleado || !config) {
    return { ok: false, motivo: "No se pudo leer la configuración del jardín." };
  }

  const ahora = new Date();
  const fecha = diaLocal(ahora, config.zonaHoraria);

  const asistencia = await prisma.asistencia.findUnique({
    where: { empleadoId_fecha: { empleadoId, fecha } },
  });

  const proximo: TipoFichaje | null = !asistencia?.horaIngreso
    ? "INGRESO"
    : !asistencia.horaSalida
      ? "EGRESO"
      : null;

  // Aunque el intento se rechace hay que guardarlo con algún tipo. Si la
  // jornada ya está cerrada, lo que se estaba intentando era una salida.
  const tipo: TipoFichaje = proximo ?? "EGRESO";

  const ubicacion = evaluarUbicacion(
    { lat: datos.lat, lng: datos.lng, precisionMetros: datos.precisionMetros },
    {
      lat: config.jardinLat,
      lng: config.jardinLng,
      radioMetros: config.radioMetros,
      precisionMaximaMetros: config.precisionMaximaMetros,
    },
  );

  const parecido = similitudMaxima(
    datos.descriptor,
    empleado.descriptores.map((d) => d.descriptor),
  );

  /**
   * Deja el intento registrado y devuelve el mensaje para la pantalla.
   *
   * Arrow y no `function`: una función declarada se hoistea, así que
   * TypeScript la analiza sin la comprobación de `empleadoId` de más arriba y
   * lo sigue viendo como `string | null`.
   */
  const rechazar = async (
    resultado: ResultadoFichaje,
    motivo: string,
  ): Promise<RespuestaFichaje> => {
    await prisma.fichaje.create({
      data: {
        empleadoId,
        asistenciaId: asistencia?.id ?? null,
        tipo,
        resultado,
        timestamp: ahora,
        lat: datos.lat,
        lng: datos.lng,
        precisionMetros: datos.precisionMetros,
        distanciaMetros: ubicacion.distanciaMetros,
        scoreFacial: parecido,
        scoreLiveness: datos.scoreLiveness,
        scoreAntispoof: datos.scoreAntispoof,
        motivoRechazo: motivo,
        ip:
          cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          cabeceras.get("x-real-ip"),
        userAgent: cabeceras.get("user-agent"),
      },
    });

    return { ok: false, motivo };
  };

  try {
    if (empleado.descriptores.length === 0) {
      return rechazar(
        "RECHAZADO_SIN_ENROLAR",
        "Todavía no tenés el rostro registrado. Pedile a la dirección que te lo registre.",
      );
    }

    if (proximo === null) {
      return rechazar(
        "RECHAZADO_DUPLICADO",
        "Ya registraste tu entrada y tu salida de hoy.",
      );
    }

    if (!ubicacion.dentro) {
      return rechazar("RECHAZADO_UBICACION", ubicacion.motivo);
    }

    // Antispoof mira si la cara es plana (una foto); liveness, si hay señales
    // de vida. Se evalúan antes que el parecido a propósito: una foto de la
    // empleada correcta se parece muchísimo a la empleada correcta.
    if (datos.scoreAntispoof < config.umbralAntispoof) {
      return rechazar(
        "RECHAZADO_LIVENESS",
        "Parece una foto o una pantalla en vez de una persona. Fichá mirando la cámara vos misma.",
      );
    }

    if (datos.scoreLiveness < config.umbralLiveness) {
      return rechazar(
        "RECHAZADO_LIVENESS",
        "No se detectaron señales de vida en la imagen. Probá de nuevo con mejor luz.",
      );
    }

    if (parecido < config.similitudMinima) {
      return rechazar(
        "RECHAZADO_ROSTRO",
        "La cara no coincide con la registrada para tu legajo.",
      );
    }

    // ── Aceptado ──
    const horario = await prisma.horario.findUnique({
      where: { turno: empleado.turno },
    });

    // `proximo === "EGRESO"` ya garantiza que existe la fila con su ingreso;
    // se lee acá para que el tipo lo refleje sin aserciones.
    const horaIngresoPrevia = asistencia?.horaIngreso ?? null;

    const guardado = await prisma.$transaction(async (tx) => {
      if (tipo === "INGRESO" || !horaIngresoPrevia) {
        const minutosTarde = horario
          ? minutosDeTardanza(
              ahora,
              horario.horaInicio,
              horario.toleranciaMinutos,
              config.zonaHoraria,
            )
          : 0;

        const fila = await tx.asistencia.upsert({
          where: { empleadoId_fecha: { empleadoId, fecha } },
          create: {
            empleadoId,
            fecha,
            horaIngreso: ahora,
            minutosTarde,
            estado: minutosTarde > 0 ? "TARDE" : "PRESENTE",
          },
          // Puede existir sin ingreso si el admin la creó a mano o si quedó
          // marcada como ausente antes de que la empleada llegara.
          update: {
            horaIngreso: ahora,
            minutosTarde,
            estado: minutosTarde > 0 ? "TARDE" : "PRESENTE",
          },
        });

        return { fila, minutosTarde, trabajados: null as number | null };
      }

      const trabajados = minutosTrabajados(horaIngresoPrevia, ahora);

      const fila = await tx.asistencia.update({
        where: { empleadoId_fecha: { empleadoId, fecha } },
        data: { horaSalida: ahora, minutosTrabajados: trabajados },
      });

      return { fila, minutosTarde: fila.minutosTarde, trabajados };
    });

    await prisma.fichaje.create({
      data: {
        empleadoId,
        asistenciaId: guardado.fila.id,
        tipo,
        resultado: "ACEPTADO",
        timestamp: ahora,
        lat: datos.lat,
        lng: datos.lng,
        precisionMetros: datos.precisionMetros,
        distanciaMetros: ubicacion.distanciaMetros,
        scoreFacial: parecido,
        scoreLiveness: datos.scoreLiveness,
        scoreAntispoof: datos.scoreAntispoof,
        ip:
          cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          cabeceras.get("x-real-ip"),
        userAgent: cabeceras.get("user-agent"),
      },
    });

    revalidatePath("/fichar");

    return {
      ok: true,
      tipo,
      hora: horaLocal(ahora, config.zonaHoraria),
      minutosTarde: guardado.minutosTarde,
      trabajadas:
        guardado.trabajados != null
          ? formatearHoras(guardado.trabajados)
          : null,
    };
  } catch (error) {
    console.error("registrarFichaje:", error);
    return {
      ok: false,
      motivo: "No se pudo registrar el fichaje. Probá de nuevo en un momento.",
    };
  }
}
