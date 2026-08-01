import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Guardas de servidor.
 *
 * El middleware ya bloquea por ruta, pero eso es solo la primera capa: cada
 * page y cada route handler vuelve a verificar acá. Confiar únicamente en el
 * middleware deja expuesto cualquier endpoint que se agregue más adelante y
 * no encaje en el matcher.
 */

export async function sesionActual() {
  return auth();
}

export async function requerirSesion() {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");
  return sesion;
}

export async function requerirAdmin() {
  const sesion = await requerirSesion();
  if (sesion.user.rol !== "ADMIN") redirect("/fichar");
  return sesion;
}

/** Para route handlers: devuelve la sesión o null, sin redirigir. */
export async function sesionDeApi() {
  const sesion = await auth();
  return sesion?.user ? sesion : null;
}
