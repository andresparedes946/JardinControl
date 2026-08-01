import type { Metadata } from "next";

import { PantallaPendiente } from "@/components/pantalla-pendiente";
import { requerirSesion } from "@/lib/session";

export const metadata: Metadata = { title: "Mis licencias" };

export default async function Pagina() {
  await requerirSesion();

  return (
    <PantallaPendiente
      titulo="Mis licencias"
      descripcion="Pedir una licencia y adjuntar el certificado correspondiente."
      fase="Fase 5"
    />
  );
}
