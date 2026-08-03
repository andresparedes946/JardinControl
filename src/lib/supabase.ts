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

/**
 * Sube un comprobante y devuelve el path dentro del bucket.
 *
 * El nombre se genera acá y no se reutiliza el del archivo: un certificado
 * puede llamarse "certificado.pdf" en los diez celulares del jardín, y además
 * un nombre subido por el usuario no tiene por qué ser una ruta segura. El
 * original se guarda aparte, en la fila de `comprobantes`, solo para mostrarlo.
 */
export async function subirComprobante(
  empleadoId: string,
  licenciaId: string,
  archivo: File,
): Promise<string> {
  const extension = extensionDe(archivo);
  const path = `${empleadoId}/${licenciaId}/${crypto.randomUUID()}${extension}`;

  const { error } = await supabaseAdmin()
    .storage.from(BUCKET_COMPROBANTES)
    .upload(path, archivo, { contentType: archivo.type, upsert: false });

  if (error) throw error;
  return path;
}

/**
 * Borra archivos del bucket. No lanza: se llama al deshacer una operación que
 * ya falló o al cancelar una licencia, y un archivo huérfano en un bucket
 * privado es mucho menos grave que dejar la base inconsistente por un error
 * de Storage.
 */
export async function borrarComprobantes(paths: string[]) {
  if (paths.length === 0) return;

  const { error } = await supabaseAdmin()
    .storage.from(BUCKET_COMPROBANTES)
    .remove(paths);

  if (error) console.error("No se pudieron borrar comprobantes:", error);
}

function extensionDe(archivo: File): string {
  const punto = archivo.name.lastIndexOf(".");
  if (punto <= 0) return "";

  const extension = archivo.name.slice(punto).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : "";
}
