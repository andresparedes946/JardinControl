"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ajustarAsistencia } from "@/app/(app)/asistencias/acciones";
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
  ESTADOS_ASISTENCIA,
  ETIQUETA_ESTADO_ASISTENCIA,
  ajusteAsistenciaSchema,
  type DatosAjusteAsistencia,
} from "@/lib/validaciones";

type Props = {
  id: string;
  quien: string;
  dia: string;
  valores: {
    horaIngreso: string;
    horaSalida: string;
    estado: (typeof ESTADOS_ASISTENCIA)[number];
    observaciones: string;
  };
};

export function EditarAsistencia({ id, quien, dia, valores }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DatosAjusteAsistencia>({
    resolver: zodResolver(ajusteAsistenciaSchema),
    defaultValues: valores,
  });

  const estado = watch("estado");

  async function onSubmit(datos: DatosAjusteAsistencia) {
    const r = await ajustarAsistencia(id, datos);

    if (!r.ok) {
      toast.error(r.error);
      return;
    }

    toast.success(r.mensaje);
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Corregir la jornada de ${quien} del ${dia}`}
        onClick={() => {
          reset(valores);
          setAbierto(true);
        }}
      >
        <Pencil className="size-4" />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogHeader>
              <DialogTitle>Corregir jornada</DialogTitle>
              <DialogDescription>
                {quien} · {dia}. Las horas van en hora del jardín. Dejalas
                vacías si no hubo registro.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`ingreso-${id}`}>Entrada</Label>
                <Input
                  id={`ingreso-${id}`}
                  type="time"
                  {...register("horaIngreso")}
                />
                {errors.horaIngreso && (
                  <p className="text-destructive text-sm">
                    {errors.horaIngreso.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`salida-${id}`}>Salida</Label>
                <Input
                  id={`salida-${id}`}
                  type="time"
                  {...register("horaSalida")}
                />
                {errors.horaSalida && (
                  <p className="text-destructive text-sm">
                    {errors.horaSalida.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`estado-${id}`}>Estado</Label>
                <Select
                  items={ETIQUETA_ESTADO_ASISTENCIA}
                  value={estado}
                  onValueChange={(v) =>
                    setValue(
                      "estado",
                      v as (typeof ESTADOS_ASISTENCIA)[number],
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger id={`estado-${id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_ASISTENCIA.map((e) => (
                      <SelectItem key={e} value={e}>
                        {ETIQUETA_ESTADO_ASISTENCIA[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`obs-${id}`}>Observaciones</Label>
                <Textarea
                  id={`obs-${id}`}
                  rows={2}
                  placeholder="Por qué se corrigió"
                  {...register("observaciones")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
