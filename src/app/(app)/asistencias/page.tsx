import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Asistencias" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Asistencias"
      descripcion="Registros diarios, horas trabajadas y correcciones manuales."
      fase="Fase 4"
    />
  );
}
