import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la service_role key.
 *
 * Solo servidor: esta clave saltea las políticas RLS, así que no puede
 * llegar nunca al bundle del cliente. Los comprobantes viven en un bucket
 * privado y se entregan con signed URLs de corta duración generadas acá.
 */

export const BUCKET_COMPROBANTES =
  process.env.SUPABASE_BUCKET_COMPROBANTES ?? "comprobantes";

let cliente: ReturnType<typeof createClient> | null = null;

export function supabaseAdmin() {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Ver .env.example.",
    );
  }

  cliente = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cliente;
}

/** URL temporal para que el admin pueda abrir un comprobante. */
export async function urlFirmadaComprobante(path: string, segundos = 60) {
  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET_COMPROBANTES)
    .createSignedUrl(path, segundos);

  if (error) throw error;
  return data.signedUrl;
}
