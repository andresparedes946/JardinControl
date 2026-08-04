"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { requerirAdmin } from "@/lib/session";
import { calcularPeriodo } from "@/lib/sueldos";
import { periodoSchema } from "@/lib/validaciones";

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

/**
 * Congela la liquidación de un mes.
 *
 * El valor hora se copia a la fila en vez de referenciarse: un aumento en
 * septiembre no tiene que cambiar lo que se pagó en agosto. Por eso mismo
 * regenerar es una acción explícita y no algo que pase solo cuando alguien
 * corrige una asistencia vieja.
 *
 * Se recalcula del lado del servidor y no se confía en lo que muestra la
 * pantalla: entre que se cargó y que se apretó el botón pudo cambiar
 * cualquier cosa.
 */
export async function generarLiquidacion(
  periodoCrudo: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = periodoSchema.safeParse(periodoCrudo);
  if (!parseado.success) return { ok: false, error: "Período inválido." };

  const periodo = parseado.data;

  try {
    const { filas } = await calcularPeriodo(periodo);
    const conHoras = filas.filter((f) => f.minutosTotales > 0);

    if (conHoras.length === 0) {
      return {
        ok: false,
        error: "No hay horas cargadas en ese mes: no hay nada que liquidar.",
      };
    }

    // Un upsert por empleada dentro de una transacción: o queda liquidado el
    // mes entero o no queda nada. Un mes liquidado a medias sería peor que
    // uno sin liquidar, porque parecería completo.
    await prisma.$transaction(
      conHoras.map((f) =>
        prisma.liquidacion.upsert({
          where: {
            empleadoId_periodo: { empleadoId: f.empleadoId, periodo },
          },
          create: {
            empleadoId: f.empleadoId,
            periodo,
            minutosTrabajados: f.minutosTrabajados,
            minutosLicencia: f.minutosLicencia,
            valorHora: f.valorHora,
            total: f.total,
          },
          update: {
            minutosTrabajados: f.minutosTrabajados,
            minutosLicencia: f.minutosLicencia,
            valorHora: f.valorHora,
            total: f.total,
            generadaEn: new Date(),
          },
        }),
      ),
    );

    const total = conHoras.reduce((t, f) => t + f.total, 0);

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "GENERAR_LIQUIDACION",
      entidad: "Liquidacion",
      entidadId: periodo,
      detalle: { periodo, empleadas: conHoras.length, total },
    });

    revalidatePath("/sueldos");

    return {
      ok: true,
      mensaje: `Liquidación generada para ${conHoras.length} ${conHoras.length === 1 ? "empleada" : "empleadas"}.`,
    };
  } catch (error) {
    console.error("generarLiquidacion:", error);
    return { ok: false, error: "No se pudo generar la liquidación." };
  }
}
