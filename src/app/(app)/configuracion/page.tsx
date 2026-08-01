import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Configuración" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Configuración"
      descripcion="Geocerca del jardín, horarios por turno, tolerancia y feriados."
      fase="Fase 1"
    />
  );
}
