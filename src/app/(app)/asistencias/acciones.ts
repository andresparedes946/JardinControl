"use server";

import { revalidatePath } from "next/cache";

import { minutosTrabajados } from "@/lib/asistencia";
import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerConfiguracion } from "@/lib/empleados";
import { prisma } from "@/lib/prisma";
import { requerirAdmin } from "@/lib/session";
import { instanteDesdeHoraLocal } from "@/lib/time";
import { ajusteAsistenciaSchema } from "@/lib/validaciones";

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

/**
 * Corrige a mano una jornada.
 *
 * Existe porque el fichaje va a fallar alguna vez: alguien se olvida de
 * marcar la salida, el celular se queda sin batería, el GPS no engancha. Sin
 * una salida manual, esa jornada quedaría mal para siempre y la liquidación
 * saldría mal con ella.
 *
 * Toda fila tocada queda marcada con `ajustadaManual`, para que después se
 * pueda distinguir lo que midió el sistema de lo que escribió una persona.
 */
export async function ajustarAsistencia(
  id: string,
  entrada: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = ajusteAsistenciaSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const datos = parseado.data;

  try {
    const [asistencia, config] = await Promise.all([
      prisma.asistencia.findUnique({
        where: { id },
        include: { empleado: { select: { usuarioId: true } } },
      }),
      obtenerConfiguracion(),
    ]);

    if (!asistencia) return { ok: false, error: "No se encontró la jornada." };

    // Las horas llegan como "HH:mm" en hora del jardín; se guardan como el
    // instante UTC de ese día. Ver `instanteDesdeHoraLocal`.
    const horaIngreso = datos.horaIngreso
      ? instanteDesdeHoraLocal(
          asistencia.fecha,
          datos.horaIngreso,
          config.zonaHoraria,
        )
      : null;

    const horaSalida = datos.horaSalida
      ? instanteDesdeHoraLocal(
          asistencia.fecha,
          datos.horaSalida,
          config.zonaHoraria,
        )
      : null;

    // Sin las dos puntas no hay duración que calcular. Se pone en null y no
    // en cero: son cosas distintas, y un cero se sumaría a la liquidación
    // como si esa jornada hubiera durado nada.
    const trabajados =
      horaIngreso && horaSalida
        ? minutosTrabajados(horaIngreso, horaSalida)
        : null;

    await prisma.asistencia.update({
      where: { id },
      data: {
        horaIngreso,
        horaSalida,
        minutosTrabajados: trabajados,
        estado: datos.estado,
        observaciones: datos.observaciones ?? null,
        ajustadaManual: true,
      },
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "AJUSTAR_ASISTENCIA",
      entidad: "Asistencia",
      entidadId: id,
      detalle: {
        horaIngreso: datos.horaIngreso || null,
        horaSalida: datos.horaSalida || null,
        estado: datos.estado,
      },
    });

    revalidatePath("/asistencias");
    revalidatePath("/mi-historial");

    return { ok: true, mensaje: "Jornada corregida." };
  } catch (error) {
    console.error("ajustarAsistencia:", error);
    return { ok: false, error: "No se pudo guardar la corrección." };
  }
}
