import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Empleados" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Empleados"
      descripcion="Alta, edición y baja del personal, con valor hora, turno y sala."
      fase="Fase 1"
    />
  );
}
