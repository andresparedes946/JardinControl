"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { guardarHorarios } from "@/app/(app)/configuracion/acciones";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ETIQUETA_TURNO, horariosSchema } from "@/lib/validaciones";

// Ver la nota sobre entrada/salida en formulario-geocerca.tsx.
type Entrada = z.input<typeof horariosSchema>;
type Valores = z.output<typeof horariosSchema>;

export function FormularioHorarios({ inicial }: { inicial: Valores }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Entrada, unknown, Valores>({
    resolver: zodResolver(horariosSchema),
    defaultValues: inicial,
  });

  async function onSubmit(datos: Valores) {
    const r = await guardarHorarios(datos);
    if (r.ok) toast.success(r.mensaje);
    else toast.error(r.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Horarios por turno</CardTitle>
          <CardDescription>
            La tolerancia es el margen antes de contar la llegada como tarde:
            con entrada 08:00 y 10 minutos, llegar 08:10 todavía es puntual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {inicial.horarios.map((h, i) => {
            const errorFila = errors.horarios?.[i];

            return (
              <div key={h.turno} className="space-y-3">
                <p className="text-sm font-medium">
                  Turno {ETIQUETA_TURNO[h.turno]}
                </p>
                <input type="hidden" {...register(`horarios.${i}.turno`)} />

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`inicio-${i}`}>Entrada</Label>
                    <Input
                      id={`inicio-${i}`}
                      type="time"
                      {...register(`horarios.${i}.horaInicio`)}
                    />
                    {errorFila?.horaInicio && (
                      <p className="text-destructive text-sm">
                        {errorFila.horaInicio.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`fin-${i}`}>Salida</Label>
                    <Input
                      id={`fin-${i}`}
                      type="time"
                      {...register(`horarios.${i}.horaFin`)}
                    />
                    {errorFila?.horaFin && (
                      <p className="text-destructive text-sm">
                        {errorFila.horaFin.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`tolerancia-${i}`}>Tolerancia (min)</Label>
                    <Input
                      id={`tolerancia-${i}`}
                      type="number"
                      min="0"
                      max="120"
                      {...register(`horarios.${i}.toleranciaMinutos`)}
                    />
                    {errorFila?.toleranciaMinutos && (
                      <p className="text-destructive text-sm">
                        {errorFila.toleranciaMinutos.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Guardar horarios
      </Button>
    </form>
  );
}
