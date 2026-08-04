"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { regenerarToken } from "@/lib/fichaje-qr";
import { requerirAdmin } from "@/lib/session";

/**
 * Genera un código nuevo y tira el anterior.
 *
 * Se audita porque tiene consecuencias visibles para todo el jardín: si
 * alguien no puede fichar a las 8 de la mañana, lo primero que hay que poder
 * responder es si el código se regeneró cinco minutos antes.
 */
export async function regenerarCodigo(): Promise<{ ok: boolean; error?: string }> {
  const sesion = await requerirAdmin();

  try {
    await regenerarToken();

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "REGENERAR_CODIGO",
      entidad: "Configuracion",
    });

    revalidatePath("/codigo");
    return { ok: true };
  } catch (error) {
    console.error("regenerarCodigo:", error);
    return { ok: false, error: "No se pudo generar un código nuevo." };
  }
}
