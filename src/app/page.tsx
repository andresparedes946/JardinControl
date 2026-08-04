import { redirect } from "next/navigation";

import { INICIO } from "@/lib/rutas";
import { sesionActual } from "@/lib/session";

/**
 * El middleware ya redirige "/"; esto cubre el caso en que la ruta se alcance
 * sin pasar por él (por ejemplo, desde el service worker, que usa "/" como
 * start_url de la PWA).
 */
export default async function Home() {
  const sesion = await sesionActual();
  redirect(sesion?.user ? INICIO : "/login");
}
