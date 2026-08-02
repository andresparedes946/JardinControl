import type { Metadata } from "next";

import { FormularioGeocerca } from "@/components/configuracion/formulario-geocerca";
import { FormularioHorarios } from "@/components/configuracion/formulario-horarios";
import { GestionSalas } from "@/components/configuracion/gestion-salas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listarHorarios,
  listarSalas,
  obtenerConfiguracion,
} from "@/lib/empleados";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  await requerirAdmin();

  const [config, horarios, salas] = await Promise.all([
    obtenerConfiguracion(),
    listarHorarios(),
    listarSalas(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Parámetros del jardín, horarios y salas.
        </p>
      </div>

      <Tabs defaultValue="jardin">
        <TabsList>
          <TabsTrigger value="jardin">Jardín y geocerca</TabsTrigger>
          <TabsTrigger value="horarios">Horarios</TabsTrigger>
          <TabsTrigger value="salas">Salas</TabsTrigger>
        </TabsList>

        <TabsContent value="jardin" className="mt-6">
          <FormularioGeocerca
            inicial={{
              nombreJardin: config.nombreJardin,
              jardinLat: config.jardinLat,
              jardinLng: config.jardinLng,
              radioMetros: config.radioMetros,
              precisionMaximaMetros: config.precisionMaximaMetros,
              similitudMinima: config.similitudMinima,
              umbralLiveness: config.umbralLiveness,
              umbralAntispoof: config.umbralAntispoof,
              diasLaborales: config.diasLaborales,
            }}
          />
        </TabsContent>

        <TabsContent value="horarios" className="mt-6">
          <FormularioHorarios
            inicial={{
              horarios: horarios.map((h) => ({
                turno: h.turno,
                horaInicio: h.horaInicio,
                horaFin: h.horaFin,
                toleranciaMinutos: h.toleranciaMinutos,
              })),
            }}
          />
        </TabsContent>

        <TabsContent value="salas" className="mt-6">
          <GestionSalas salas={salas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
