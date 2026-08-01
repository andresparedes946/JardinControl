import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Licencias" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Licencias"
      descripcion="Solicitudes de licencia y revisión de los comprobantes cargados."
      fase="Fase 5"
    />
  );
}
