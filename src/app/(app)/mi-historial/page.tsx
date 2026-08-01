import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirSesion } from "@/lib/session";

export const metadata: Metadata = { title: "Mi historial" };

export default async function Pagina() {
  await requerirSesion();

  return (
    <PantallaPendiente
      titulo="Mi historial"
      descripcion="Tus ingresos, egresos y horas trabajadas mes a mes."
      fase="Fase 4"
    />
  );
}
