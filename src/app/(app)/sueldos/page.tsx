import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Sueldos" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Sueldos"
      descripcion="Liquidación mensual por horas trabajadas y valor hora."
      fase="Fase 6"
    />
  );
}
