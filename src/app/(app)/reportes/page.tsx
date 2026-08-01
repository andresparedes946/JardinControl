import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Reportes" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Reportes"
      descripcion="Exportación a PDF, Excel y CSV por empleada, sala, turno y mes."
      fase="Fase 7"
    />
  );
}
