import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RegistroFacial } from "@/components/empleados/registro-facial";
import { Button } from "@/components/ui/button";
import { obtenerEmpleado, obtenerEnrolamiento } from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";
import { ZONA_HORARIA_POR_DEFECTO } from "@/lib/time";

export const metadata: Metadata = { title: "Registro facial" };

const fechaLarga = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: ZONA_HORARIA_POR_DEFECTO,
});

export default async function RostroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();

  const { id } = await params;
  const [empleado, enrolamiento] = await Promise.all([
    obtenerEmpleado(id),
    obtenerEnrolamiento(id),
  ]);

  if (!empleado) notFound();

  const nombre = `${empleado.usuario.nombre} ${empleado.usuario.apellido}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{nombre}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Legajo {empleado.legajo}
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

      <RegistroFacial
        empleadoId={empleado.id}
        nombre={nombre}
        registrado={
          enrolamiento && {
            muestras: enrolamiento.muestras,
            // La fecha se formatea acá y viaja como texto: mandarle un Date al
            // componente cliente lo dejaría a merced de la zona horaria del
            // celular de quien esté mirando.
            fecha: fechaLarga.format(enrolamiento.fecha),
          }
        }
      />
    </div>
  );
}
