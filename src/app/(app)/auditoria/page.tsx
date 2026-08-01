import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Auditoría" };

export default async function Pagina() {
  await requerirAdmin();

  return (
    <PantallaPendiente
      titulo="Auditoría"
      descripcion="Registro de acciones, con usuario, fecha, IP y dispositivo."
      fase="Fase 8"
    />
  );
}
