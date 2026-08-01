import type { Metadata } from "next";
import Link from "next/link";

import { crearEmpleado } from "@/app/(app)/empleados/acciones";
import { FormularioEmpleado } from "@/components/empleados/formulario-empleado";
import { Button } from "@/components/ui/button";
import { listarSalas } from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nueva empleada" };

export default async function NuevaEmpleadaPage() {
  await requerirAdmin();
  const salas = await listarSalas();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nueva empleada
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Se le crea la cuenta y queda lista para registrar su rostro.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/empleados" />}
        >
          Volver
        </Button>
      </div>

      <FormularioEmpleado
        salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))}
        onGuardar={async (datos) => {
          "use server";
          return crearEmpleado(datos);
        }}
      />
    </div>
  );
}
