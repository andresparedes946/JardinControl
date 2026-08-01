"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { requerirAdmin } from "@/lib/session";
import {
  configuracionSchema,
  horariosSchema,
  salaSchema,
} from "@/lib/validaciones";

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export async function guardarConfiguracion(
  entrada: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = configuracionSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  try {
    await prisma.configuracion.update({
      where: { id: 1 },
      data: parseado.data,
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "ACTUALIZAR",
      entidad: "Configuracion",
      entidadId: "1",
      detalle: {
        radioMetros: parseado.data.radioMetros,
        jardinLat: parseado.data.jardinLat,
        jardinLng: parseado.data.jardinLng,
      },
    });

    revalidatePath("/configuracion");
    return { ok: true, mensaje: "Configuración guardada." };
  } catch (error) {
    console.error("guardarConfiguracion:", error);
    return { ok: false, error: "No se pudo guardar la configuración." };
  }
}

export async function guardarHorarios(entrada: unknown): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = horariosSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  try {
    // Los tres turnos se guardan juntos: dejar la mitad aplicada haría que
    // el cálculo de tardanzas use horarios inconsistentes entre sí.
    await prisma.$transaction(
      parseado.data.horarios.map((h) =>
        prisma.horario.update({
          where: { turno: h.turno },
          data: {
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
            toleranciaMinutos: h.toleranciaMinutos,
          },
        }),
      ),
    );

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "ACTUALIZAR",
      entidad: "Horario",
      detalle: { horarios: parseado.data.horarios },
    });

    revalidatePath("/configuracion");
    return { ok: true, mensaje: "Horarios guardados." };
  } catch (error) {
    console.error("guardarHorarios:", error);
    return { ok: false, error: "No se pudieron guardar los horarios." };
  }
}

export async function crearSala(entrada: unknown): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = salaSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  try {
    const sala = await prisma.sala.create({ data: parseado.data });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "CREAR",
      entidad: "Sala",
      entidadId: sala.id,
      detalle: { nombre: sala.nombre },
    });

    revalidatePath("/configuracion");
    revalidatePath("/empleados");
    return { ok: true, mensaje: `Sala "${sala.nombre}" creada.` };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya existe una sala con ese nombre." };
    }
    console.error("crearSala:", error);
    return { ok: false, error: "No se pudo crear la sala." };
  }
}

export async function actualizarSala(
  id: string,
  entrada: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = salaSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  try {
    await prisma.sala.update({ where: { id }, data: parseado.data });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "ACTUALIZAR",
      entidad: "Sala",
      entidadId: id,
    });

    revalidatePath("/configuracion");
    revalidatePath("/empleados");
    return { ok: true, mensaje: "Sala actualizada." };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ya existe una sala con ese nombre." };
    }
    console.error("actualizarSala:", error);
    return { ok: false, error: "No se pudo actualizar la sala." };
  }
}

export async function eliminarSala(id: string): Promise<Resultado> {
  const sesion = await requerirAdmin();

  try {
    const sala = await prisma.sala.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });

    if (!sala) return { ok: false, error: "No se encontró la sala." };

    // La relación es onDelete: SetNull, así que borrarla no rompería nada,
    // pero dejaría empleadas sin sala sin avisar. Mejor obligar a moverlas.
    if (sala._count.empleados > 0) {
      return {
        ok: false,
        error: `"${sala.nombre}" tiene ${sala._count.empleados} empleada(s) asignada(s). Movelas a otra sala antes de eliminarla.`,
      };
    }

    await prisma.sala.delete({ where: { id } });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "ELIMINAR",
      entidad: "Sala",
      entidadId: id,
      detalle: { nombre: sala.nombre },
    });

    revalidatePath("/configuracion");
    revalidatePath("/empleados");
    return { ok: true, mensaje: `Sala "${sala.nombre}" eliminada.` };
  } catch (error) {
    console.error("eliminarSala:", error);
    return { ok: false, error: "No se pudo eliminar la sala." };
  }
}
