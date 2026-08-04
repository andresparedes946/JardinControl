"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerConfiguracion } from "@/lib/empleados";
import {
  desmarcarAsistenciasDeLicencia,
  diaDesdeISO,
  licenciaSolapada,
  marcarAsistenciasDeLicencia,
  rangoLegible,
} from "@/lib/licencias";
import { prisma } from "@/lib/prisma";
import { requerirAdmin, requerirSesion } from "@/lib/session";
import { borrarComprobantes, subirComprobante } from "@/lib/supabase";
import { diaLocal } from "@/lib/time";
import {
  certificadoSchema,
  COMPROBANTES_MAXIMOS,
  ETIQUETA_TIPO_LICENCIA,
  problemaDelComprobante,
  revisionLicenciaSchema,
  TIPO_LICENCIA_POR_DEFECTO,
} from "@/lib/validaciones";

/**
 * Acciones de licencias, las de la empleada y las de la dirección juntas.
 *
 * Están en un solo módulo porque comparten las mismas reglas de propiedad y
 * de estado, y tenerlas separadas por pantalla invitaba a que una de las dos
 * copias se olvidara de alguna. Cada acción declara su propia guarda: la ruta
 * desde la que se llame no decide nada.
 */

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

const RUTAS = ["/licencias", "/mis-licencias"];

function revalidar() {
  for (const ruta of RUTAS) revalidatePath(ruta);
}

/**
 * El admin no es empleado del jardín, así que no puede pedir licencias para
 * sí mismo. Se devuelve un error explícito en vez de un 403 genérico para que
 * se entienda por qué.
 */
const SIN_EMPLEADA =
  "Tu usuario no tiene una empleada asociada, así que no puede pedir licencias.";

/** Extrae y valida los archivos adjuntos de un FormData. */
function archivosDe(formData: FormData): File[] | string {
  const archivos = formData
    .getAll("archivos")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (archivos.length > COMPROBANTES_MAXIMOS) {
    return `No se pueden adjuntar más de ${COMPROBANTES_MAXIMOS} archivos.`;
  }

  for (const archivo of archivos) {
    const problema = problemaDelComprobante(archivo);
    if (problema) return problema;
  }

  return archivos;
}

/**
 * Sube los archivos y registra las filas de `comprobantes`.
 *
 * Si algo falla a mitad de camino se borran los que ya habían subido: un
 * archivo suelto en el bucket, sin fila que lo referencie, no lo encuentra
 * nadie y ocupa lugar para siempre.
 */
async function guardarComprobantes(
  empleadoId: string,
  licenciaId: string,
  archivos: File[],
) {
  const subidos: string[] = [];

  try {
    for (const archivo of archivos) {
      const path = await subirComprobante(empleadoId, licenciaId, archivo);
      subidos.push(path);

      await prisma.comprobante.create({
        data: {
          licenciaId,
          path,
          nombreOriginal: archivo.name.slice(0, 200),
          mimeType: archivo.type,
          tamanioBytes: archivo.size,
        },
      });
    }
  } catch (error) {
    await borrarComprobantes(subidos);
    throw error;
  }
}

// ─────────────────────────── Empleada ───────────────────────────

/**
 * Sube un certificado y deja la licencia pendiente de que la dirección la
 * cargue.
 *
 * La empleada no elige tipo ni fechas: manda el papel y, si quiere, una
 * aclaración. El período sale del certificado y lo carga la dirección al
 * revisarlo, así que la licencia nace con el día de hoy en las dos puntas,
 * como marcador provisorio, y la pantalla lo muestra como "sin período
 * definido" hasta que se resuelve.
 */
export async function subirCertificado(
  empleadoId: string,
  formData: FormData,
): Promise<Resultado> {
  // Lo carga la dirección y no la empleada: desde que el fichaje es por QR,
  // las maestras no tienen cuenta, así que el papel llega en mano o por
  // mensaje y lo sube quien lo recibe.
  const sesion = await requerirAdmin();

  const parseado = certificadoSchema.safeParse({
    detalle: formData.get("detalle") ?? "",
  });

  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const archivos = archivosDe(formData);
  if (typeof archivos === "string") return { ok: false, error: archivos };
  if (archivos.length === 0) {
    return { ok: false, error: "Adjuntá el certificado antes de enviarlo." };
  }

  try {
    const config = await obtenerConfiguracion();
    const hoy = diaLocal(new Date(), config.zonaHoraria);

    const licencia = await prisma.licencia.create({
      data: {
        empleadoId,
        tipo: TIPO_LICENCIA_POR_DEFECTO,
        fechaInicio: hoy,
        fechaFin: hoy,
        motivo: parseado.data.detalle ?? null,
      },
    });

    await guardarComprobantes(empleadoId, licencia.id, archivos);

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "SUBIR_CERTIFICADO",
      entidad: "Licencia",
      entidadId: licencia.id,
      detalle: { comprobantes: archivos.length },
    });

    revalidar();
    return {
      ok: true,
      mensaje:
        archivos.length === 1
          ? "Certificado enviado. La dirección lo revisa y carga los días."
          : `${archivos.length} archivos enviados. La dirección los revisa y carga los días.`,
    };
  } catch (error) {
    console.error("subirCertificado:", error);
    return { ok: false, error: "No se pudo enviar el certificado." };
  }
}

/**
 * Suma archivos a un envío que la dirección todavía no resolvió.
 *
 * Existe porque el certificado no siempre llega completo de una: falta la
 * segunda hoja, o el papel del especialista aparece al otro día. Una vez
 * resuelta, el legajo no se toca más.
 */
export async function adjuntarComprobantes(
  licenciaId: string,
  formData: FormData,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const archivos = archivosDe(formData);
  if (typeof archivos === "string") return { ok: false, error: archivos };
  if (archivos.length === 0) return { ok: false, error: "Elegí al menos un archivo." };

  try {
    const licencia = await prisma.licencia.findUnique({
      where: { id: licenciaId },
      select: {
        empleadoId: true,
        estado: true,
        _count: { select: { comprobantes: true } },
      },
    });

    if (!licencia) {
      return { ok: false, error: "No se encontró la licencia." };
    }

    const empleadoId = licencia.empleadoId;

    if (licencia.estado !== "PENDIENTE") {
      return { ok: false, error: "La licencia ya fue resuelta: no se le pueden agregar comprobantes." };
    }

    if (licencia._count.comprobantes + archivos.length > COMPROBANTES_MAXIMOS) {
      return {
        ok: false,
        error: `Una licencia admite hasta ${COMPROBANTES_MAXIMOS} comprobantes y ya tiene ${licencia._count.comprobantes}.`,
      };
    }

    await guardarComprobantes(empleadoId, licenciaId, archivos);

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "ADJUNTAR_COMPROBANTE",
      entidad: "Licencia",
      entidadId: licenciaId,
      detalle: { archivos: archivos.length },
    });

    revalidar();
    return {
      ok: true,
      mensaje:
        archivos.length === 1 ? "Comprobante adjuntado." : `${archivos.length} comprobantes adjuntados.`,
    };
  } catch (error) {
    console.error("adjuntarComprobantes:", error);
    return { ok: false, error: "No se pudo subir el comprobante." };
  }
}

/** Cancela un pedido propio que todavía no revisó la dirección. */
export async function cancelarLicencia(licenciaId: string): Promise<Resultado> {
  const sesion = await requerirSesion();
  const empleadoId = sesion.user.empleadoId;
  if (!empleadoId) return { ok: false, error: SIN_EMPLEADA };

  try {
    const licencia = await prisma.licencia.findUnique({
      where: { id: licenciaId },
      select: {
        empleadoId: true,
        estado: true,
        comprobantes: { select: { path: true } },
      },
    });

    if (!licencia || licencia.empleadoId !== empleadoId) {
      return { ok: false, error: "No se encontró la licencia." };
    }

    if (licencia.estado !== "PENDIENTE") {
      return {
        ok: false,
        error: "La licencia ya fue resuelta por la dirección: no se puede cancelar.",
      };
    }

    // La fila se borra de verdad: un pedido que nunca se resolvió no es
    // historial de nada, y los certificados médicos no tienen por qué quedar
    // guardados si la licencia no llegó a existir.
    await prisma.licencia.delete({ where: { id: licenciaId } });
    await borrarComprobantes(licencia.comprobantes.map((c) => c.path));

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "CANCELAR_LICENCIA",
      entidad: "Licencia",
      entidadId: licenciaId,
    });

    revalidar();
    return { ok: true, mensaje: "Licencia cancelada." };
  } catch (error) {
    console.error("cancelarLicencia:", error);
    return { ok: false, error: "No se pudo cancelar la licencia." };
  }
}

// ─────────────────────────── Dirección ───────────────────────────

/**
 * Resuelve una licencia: define de qué es, qué días cubre y si vale.
 *
 * El tipo y el rango se cargan acá y no cuando la empleada manda el papel,
 * porque el papel es el que los dice. Aprobar entonces no es solo cambiar un
 * estado: esos días laborales quedan marcados como LICENCIA en las
 * asistencias, o si no aparecerían como ausencias sin justificar en el
 * historial y en la liquidación. Cambiar de opinión y pasarla a rechazada
 * deshace la marca.
 */
export async function revisarLicencia(
  licenciaId: string,
  entrada: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = revisionLicenciaSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const datos = parseado.data;
  const fechaInicio = diaDesdeISO(datos.fechaInicio);
  const fechaFin = diaDesdeISO(datos.fechaFin);

  try {
    const licencia = await prisma.licencia.findUnique({
      where: { id: licenciaId },
      include: {
        empleado: { include: { usuario: { select: { nombre: true, apellido: true } } } },
      },
    });

    if (!licencia) return { ok: false, error: "No se encontró la licencia." };

    // Aprobar un rango que se pisa con otra licencia ya aprobada duplicaría
    // esos días. Se comprueba contra el rango que se está cargando ahora, no
    // contra el provisorio con el que nació la licencia.
    if (datos.estado === "APROBADA") {
      const solapada = await licenciaSolapada(
        licencia.empleadoId,
        fechaInicio,
        fechaFin,
        licencia.id,
      );

      if (solapada?.estado === "APROBADA") {
        return {
          ok: false,
          error: `Se pisa con otra licencia ya aprobada del ${rangoLegible(solapada.fechaInicio, solapada.fechaFin)}.`,
        };
      }
    }

    // Si estaba aprobada, las marcas viejas se levantan antes de tocar las
    // fechas: después del update ya no se sabría sobre qué días se pusieron.
    let dias = 0;
    if (licencia.estado === "APROBADA") {
      dias = await desmarcarAsistenciasDeLicencia(licencia);
    }

    await prisma.licencia.update({
      where: { id: licenciaId },
      data: {
        estado: datos.estado,
        tipo: datos.tipo,
        fechaInicio,
        fechaFin,
        observaciones: datos.observaciones ?? null,
        revisadaPorId: sesion.user.id,
        revisadaEn: new Date(),
      },
    });

    if (datos.estado === "APROBADA") {
      const config = await obtenerConfiguracion();
      dias = await marcarAsistenciasDeLicencia(
        { ...licencia, fechaInicio, fechaFin, tipo: datos.tipo },
        config.diasLaborales,
        ETIQUETA_TIPO_LICENCIA[datos.tipo],
      );
    }

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: datos.estado === "APROBADA" ? "APROBAR_LICENCIA" : "RECHAZAR_LICENCIA",
      entidad: "Licencia",
      entidadId: licenciaId,
      detalle: {
        anterior: licencia.estado,
        tipo: datos.tipo,
        desde: datos.fechaInicio,
        hasta: datos.fechaFin,
        diasAfectados: dias,
      },
    });

    revalidar();
    revalidatePath("/asistencias");
    revalidatePath("/mi-historial");

    const quien = `${licencia.empleado.usuario.nombre} ${licencia.empleado.usuario.apellido}`;

    if (datos.estado === "RECHAZADA") {
      return { ok: true, mensaje: `Licencia de ${quien} rechazada.` };
    }

    return {
      ok: true,
      mensaje:
        dias > 0
          ? `Licencia de ${quien} aprobada. ${dias} ${dias === 1 ? "día laboral quedó marcado" : "días laborales quedaron marcados"} en las asistencias.`
          : `Licencia de ${quien} aprobada. No cae ningún día laboral en ese rango.`,
    };
  } catch (error) {
    console.error("revisarLicencia:", error);
    return { ok: false, error: "No se pudo resolver la licencia." };
  }
}
