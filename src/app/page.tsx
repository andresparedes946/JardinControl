import { redirect } from "next/navigation";

import { INICIO_POR_ROL } from "@/lib/rutas";
import { sesionActual } from "@/lib/session";

/**
 * El middleware ya redirige "/" según el rol; esto cubre el caso en que la
 * ruta se alcance sin pasar por él (por ejemplo, desde el service worker,
 * que usa "/" como start_url de la PWA).
 */
export default async function Home() {
  const sesion = await sesionActual();
  redirect(sesion?.user ? INICIO_POR_ROL[sesion.user.rol] : "/login");
}
