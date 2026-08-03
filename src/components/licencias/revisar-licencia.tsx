"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { revisarLicencia } from "@/app/(app)/licencias/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ETIQUETA_TIPO_LICENCIA,
  revisionLicenciaSchema,
  TIPOS_LICENCIA,
  type DatosRevisionLicencia,
} from "@/lib/validaciones";

type Decision = "APROBADA" | "RECHAZADA";

/**
 * Resolución de un certificado.
 *
 * Acá la dirección carga lo que dice el papel —de qué es la licencia y qué
 * días cubre— y recién entonces la aprueba o la rechaza. Aprobar y rechazar
 * abren el mismo diálogo con la decisión ya tomada: el botón dice qué va a
 * pasar, en vez de obligar a elegir dos veces lo mismo.
 */
export function RevisarLicencia({
  id,
  quien,
  estado,
  valores,
  sinComprobantes,
}: {
  id: string;
  quien: string;
  estado: string;
  valores: {
    tipo: (typeof TIPOS_LICENCIA)[number];
    fechaInicio: string;
    fechaFin: string;
  };
  sinComprobantes: boolean;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DatosRevisionLicencia>({
    resolver: zodResolver(revisionLicenciaSchema),
    defaultValues: { ...valores, estado: "APROBADA", observaciones: undefined },
  });

  const tipo = watch("tipo");

  function abrir(nueva: Decision) {
    reset({ ...valores, estado: nueva, observaciones: undefined });
    setDecision(nueva);
  }

  async function onSubmit(datos: DatosRevisionLicencia) {
    const r = await revisarLicencia(id, datos);

    if (!r.ok) {
      toast.error(r.error);
      return;
    }

    toast.success(r.mensaje);
    setDecision(null);
    router.refresh();
  }

  const aprobada = decision === "APROBADA";

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={() => abrir("APROBADA")}>
          <Check className="size-3.5" />
          {estado === "APROBADA" ? "Corregir" : "Aprobar"}
        </Button>
        {estado !== "RECHAZADA" && (
          <Button
            size="sm"
            variant={estado === "APROBADA" ? "outline" : "destructive"}
            onClick={() => abrir("RECHAZADA")}
          >
            <X className="size-3.5" />
            Rechazar
          </Button>
        )}
      </div>

      <Dialog open={decision !== null} onOpenChange={(v) => !v && setDecision(null)}>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <input type="hidden" {...register("estado")} />

            <DialogHeader>
              <DialogTitle>
                {aprobada ? "Aprobar licencia" : "Rechazar licencia"}
              </DialogTitle>
              <DialogDescription>
                {quien}.{" "}
                {aprobada
                  ? "Cargá de qué es y qué días cubre según el certificado: esos días laborales quedan marcados como licencia en las asistencias."
                  : estado === "APROBADA"
                    ? "Estaba aprobada: al rechazarla se quitan las marcas de licencia de esos días."
                    : "Contale por qué, así puede volver a enviar lo que falte."}
              </DialogDescription>
            </DialogHeader>

            {aprobada && sinComprobantes && (
              <p className="border-border text-muted-foreground mt-2 rounded-lg border border-dashed px-3 py-2 text-xs">
                Ojo: este envío no tiene ningún certificado adjunto.
              </p>
            )}

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`tipo-${id}`}>Tipo</Label>
                <Select
                  items={ETIQUETA_TIPO_LICENCIA}
                  value={tipo}
                  onValueChange={(v) =>
                    setValue("tipo", v as (typeof TIPOS_LICENCIA)[number], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id={`tipo-${id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_LICENCIA.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ETIQUETA_TIPO_LICENCIA[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`desde-${id}`}>Desde</Label>
                <Input id={`desde-${id}`} type="date" {...register("fechaInicio")} />
                {errors.fechaInicio && (
                  <p className="text-destructive text-sm">
                    {errors.fechaInicio.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`hasta-${id}`}>Hasta</Label>
                <Input id={`hasta-${id}`} type="date" {...register("fechaFin")} />
                {errors.fechaFin && (
                  <p className="text-destructive text-sm">
                    {errors.fechaFin.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`obs-licencia-${id}`}>
                  Observaciones{" "}
                  {aprobada && <span className="text-muted-foreground">(opcional)</span>}
                </Label>
                <Textarea
                  id={`obs-licencia-${id}`}
                  rows={2}
                  placeholder={
                    aprobada
                      ? "Algo que quede registrado con la aprobación"
                      : "Qué falta o por qué no corresponde"
                  }
                  {...register("observaciones")}
                />
                {errors.observaciones && (
                  <p className="text-destructive text-sm">
                    {errors.observaciones.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDecision(null)}>
                Volver
              </Button>
              <Button
                type="submit"
                variant={aprobada ? "default" : "destructive"}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {aprobada ? "Aprobar" : "Rechazar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
