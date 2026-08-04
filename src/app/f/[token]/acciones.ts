"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";

import type { ResultadoFichaje, TipoFichaje } from "@/generated/prisma/enums";
import { minutosTrabajados } from "@/lib/asistencia";
import { tokenEsValido } from "@/lib/fichaje-qr";
import { evaluarUbicacion } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import {
  diaLocal,
  formatearHoras,
  horaLocal,
  minutosDeTardanza,
} from "@/lib/time";
import { fichajeQrSchema } from "@/lib/validaciones";

export type RespuestaFichaje =
  | {
      ok: true;
      nombre: string;
      tipo: TipoFichaje;
      hora: string;
      minutosTarde: number;
      trabajadas: string | null;
    }
  | { ok: false; motivo: string };

/**
 * Registra un fichaje hecho desde el QR.
 *
 * Sin cuentas, la identidad la sostienen tres cosas a la vez: el código del
 * día prueba que alguien estuvo frente al cartel, el PIN prueba quién es, y la
 * geocerca prueba dónde está. Ninguna alcanza sola.
 *
 * Todo intento identificado queda escrito en `fichajes`, aceptado o rechazado.
 * Los que ni siquiera llegan a identificar a alguien —DNI inexistente, código
 * vencido— no dejan fila porque no habría a quién atribuírsela.
 */
export async function ficharConQr(
  token: string,
  entrada: unknown,
): Promise<RespuestaFichaje> {
  const parseado = fichajeQrSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      motivo: parseado.error.issues[0]?.message ?? "Datos incompletos.",
    };
  }

  const datos = parseado.data;

  const [config, cabeceras] = await Promise.all([
    prisma.configuracion.findUnique({ where: { id: 1 } }),
    headers(),
  ]);

  if (!config) {
    return { ok: false, motivo: "No se pudo leer la configuración del jardín." };
  }

  const empleado = await prisma.empleado.findUnique({
    where: { dni: datos.dni },
    include: { usuario: { select: { nombre: true, apellido: true } } },
  });

  // Mensaje único para DNI inexistente y PIN equivocado: decir cuál de los dos
  // falló convertiría la pantalla en un buscador de DNIs válidos del jardín.
  const generico = "El DNI o el PIN no coinciden.";

  if (!empleado || !empleado.pinFichaje) {
    return { ok: false, motivo: generico };
  }

  const nombre = `${empleado.usuario.nombre} ${empleado.usuario.apellido}`;
  const ahora = new Date();
  const fecha = diaLocal(ahora, config.zonaHoraria);

  const asistencia = await prisma.asistencia.findUnique({
    where: { empleadoId_fecha: { empleadoId: empleado.id, fecha } },
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

  const rechazar = async (
    resultado: ResultadoFichaje,
    motivo: string,
  ): Promise<RespuestaFichaje> => {
    await prisma.fichaje.create({
      data: {
        empleadoId: empleado.id,
        asistenciaId: asistencia?.id ?? null,
        tipo,
        resultado,
        timestamp: ahora,
        lat: datos.lat,
        lng: datos.lng,
        precisionMetros: datos.precisionMetros,
        distanciaMetros: ubicacion.distanciaMetros,
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
    if (!(await compare(datos.pin, empleado.pinFichaje))) {
      return rechazar("RECHAZADO_PIN", generico);
    }

    // Se revalida el código acá y no solo al abrir la página: la dirección
    // puede haberlo regenerado mientras alguien tenía el formulario abierto.
    if (!(await tokenEsValido(token, config.zonaHoraria))) {
      return rechazar(
        "RECHAZADO_TOKEN",
        "El código venció. Volvé a escanear el que está en la entrada.",
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

    const horario = await prisma.horario.findUnique({
      where: { turno: empleado.turno },
    });

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
          where: { empleadoId_fecha: { empleadoId: empleado.id, fecha } },
          create: {
            empleadoId: empleado.id,
            fecha,
            horaIngreso: ahora,
            minutosTarde,
            estado: minutosTarde > 0 ? "TARDE" : "PRESENTE",
          },
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
        where: { empleadoId_fecha: { empleadoId: empleado.id, fecha } },
        data: { horaSalida: ahora, minutosTrabajados: trabajados },
      });

      return { fila, minutosTarde: fila.minutosTarde, trabajados };
    });

    await prisma.fichaje.create({
      data: {
        empleadoId: empleado.id,
        asistenciaId: guardado.fila.id,
        tipo,
        resultado: "ACEPTADO",
        timestamp: ahora,
        lat: datos.lat,
        lng: datos.lng,
        precisionMetros: datos.precisionMetros,
        distanciaMetros: ubicacion.distanciaMetros,
        ip:
          cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          cabeceras.get("x-real-ip"),
        userAgent: cabeceras.get("user-agent"),
      },
    });

    return {
      ok: true,
      nombre,
      tipo,
      hora: horaLocal(ahora, config.zonaHoraria),
      minutosTarde: guardado.minutosTarde,
      trabajadas:
        guardado.trabajados != null
          ? formatearHoras(guardado.trabajados)
          : null,
    };
  } catch (error) {
    console.error("ficharConQr:", error);
    return {
      ok: false,
      motivo: "No se pudo registrar el fichaje. Probá de nuevo en un momento.",
    };
  }
}
