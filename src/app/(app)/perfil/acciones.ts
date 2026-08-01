"use server";

import { compare, hash } from "bcryptjs";

import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/session";
import { cambioPasswordSchema } from "@/lib/validaciones";

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export async function cambiarPassword(entrada: unknown): Promise<Resultado> {
  const sesion = await requerirSesion();

  const parseado = cambioPasswordSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  // El id sale de la sesión, nunca del formulario: si viniera del cliente,
  // cualquiera podría cambiarle la contraseña a otra persona.
  const usuario = await prisma.usuario.findUnique({
    where: { id: sesion.user.id },
    select: { id: true, password: true },
  });

  if (!usuario) return { ok: false, error: "No se encontró la cuenta." };

  const coincide = await compare(parseado.data.actual, usuario.password);
  if (!coincide) {
    return { ok: false, error: "La contraseña actual no es correcta." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { password: await hash(parseado.data.nueva, 10) },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "CAMBIAR_PASSWORD",
    entidad: "Usuario",
    entidadId: usuario.id,
  });

  return { ok: true, mensaje: "Contraseña actualizada." };
}
