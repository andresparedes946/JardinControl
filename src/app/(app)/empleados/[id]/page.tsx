import { ScanFace } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { actualizarEmpleado } from "@/app/(app)/empleados/acciones";
import { FormularioEmpleado } from "@/components/empleados/formulario-empleado";
import { Button } from "@/components/ui/button";
import { listarSalas, obtenerEmpleado } from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Editar empleada" };

export default async function EditarEmpleadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();

  const { id } = await params;
  const [empleado, salas] = await Promise.all([
    obtenerEmpleado(id),
    listarSalas(),
  ]);

  if (!empleado) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {empleado.usuario.nombre} {empleado.usuario.apellido}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Legajo {empleado.legajo}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/empleados/${empleado.id}/rostro`} />}
          >
            <ScanFace className="size-4" />
            Registro facial
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/empleados" />}
          >
            Volver
          </Button>
        </div>
      </div>

      <FormularioEmpleado
        empleadoId={empleado.id}
        salas={salas.map((s) => ({ id: s.id, nombre: s.nombre }))}
        valoresIniciales={{
          nombre: empleado.usuario.nombre,
          apellido: empleado.usuario.apellido,
          email: empleado.usuario.email,
          dni: empleado.dni,
          legajo: empleado.legajo,
          cargo: empleado.cargo,
          turno: empleado.turno,
          salaId: empleado.salaId ?? "sin-sala",
          // Decimal de Prisma no es serializable hacia un componente cliente.
          valorHora: Number(empleado.valorHora),
          telefono: empleado.telefono ?? "",
          direccion: empleado.direccion ?? "",
          fechaNacimiento: empleado.fechaNacimiento
            ? empleado.fechaNacimiento.toISOString().slice(0, 10)
            : "",
          estado: empleado.estado,
        }}
        onGuardar={async (datos) => {
          "use server";
          return actualizarEmpleado(id, datos);
        }}
      />
    </div>
  );
}
