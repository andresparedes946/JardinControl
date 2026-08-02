"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Crosshair, Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { guardarConfiguracion } from "@/app/(app)/configuracion/acciones";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { configuracionSchema } from "@/lib/validaciones";
import { z } from "zod";

/**
 * `z.coerce.number()` acepta cualquier cosa y devuelve number, así que el
 * tipo de ENTRADA del formulario (lo que escribe el usuario, siempre string)
 * no es el mismo que el de SALIDA (ya coercionado). React Hook Form modela
 * esa diferencia con dos genéricos distintos.
 */
type Entrada = z.input<typeof configuracionSchema>;
type Valores = z.output<typeof configuracionSchema>;

const DIAS = [
  { valor: 1, etiqueta: "Lun" },
  { valor: 2, etiqueta: "Mar" },
  { valor: 3, etiqueta: "Mié" },
  { valor: 4, etiqueta: "Jue" },
  { valor: 5, etiqueta: "Vie" },
  { valor: 6, etiqueta: "Sáb" },
  { valor: 0, etiqueta: "Dom" },
];

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && (
        <p className="text-muted-foreground text-xs">{ayuda}</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

export function FormularioGeocerca({ inicial }: { inicial: Valores }) {
  const [ubicando, setUbicando] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Entrada, unknown, Valores>({
    resolver: zodResolver(configuracionSchema),
    defaultValues: inicial,
  });

  const radio = Number(watch("radioMetros")) || 0;
  const precision = Number(watch("precisionMaximaMetros")) || 0;

  async function onSubmit(datos: Valores) {
    const r = await guardarConfiguracion(datos);
    if (r.ok) toast.success(r.mensaje);
    else toast.error(r.error);
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      toast.error("Este navegador no expone la ubicación.");
      return;
    }

    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicando(false);
        setValue("jardinLat", pos.coords.latitude, { shouldDirty: true });
        setValue("jardinLng", pos.coords.longitude, { shouldDirty: true });
        toast.success(
          `Ubicación tomada con una precisión de ±${Math.round(pos.coords.accuracy)} m.`,
        );
      },
      (error) => {
        setUbicando(false);
        toast.error(
          error.code === error.PERMISSION_DENIED
            ? "Permiso de ubicación denegado."
            : "No se pudo obtener la ubicación.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Datos del jardín</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Campo
            id="nombreJardin"
            etiqueta="Nombre"
            error={errors.nombreJardin?.message}
          >
            <Input id="nombreJardin" {...register("nombreJardin")} />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geocerca</CardTitle>
          <CardDescription>
            Define desde dónde se puede fichar. El servidor compara siempre
            contra estos valores, así que cambiarlos afecta a todos los
            fichajes desde el próximo intento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="jardinLat"
              etiqueta="Latitud"
              error={errors.jardinLat?.message}
            >
              <Input
                id="jardinLat"
                type="number"
                step="any"
                {...register("jardinLat")}
              />
            </Campo>

            <Campo
              id="jardinLng"
              etiqueta="Longitud"
              error={errors.jardinLng?.message}
            >
              <Input
                id="jardinLng"
                type="number"
                step="any"
                {...register("jardinLng")}
              />
            </Campo>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={usarMiUbicacion}
            disabled={ubicando}
          >
            {ubicando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Crosshair className="size-4" />
            )}
            Usar mi ubicación actual
          </Button>
          <p className="text-muted-foreground text-xs">
            Tocá esto parada en la puerta del jardín y las coordenadas quedan
            cargadas solas.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="radioMetros"
              etiqueta="Radio permitido (m)"
              error={errors.radioMetros?.message}
            >
              <Input
                id="radioMetros"
                type="number"
                min="10"
                {...register("radioMetros")}
              />
            </Campo>

            <Campo
              id="precisionMaximaMetros"
              etiqueta="Precisión GPS mínima exigida (m)"
              ayuda="Si el celular reporta una precisión peor, se rechaza el fichaje."
              error={errors.precisionMaximaMetros?.message}
            >
              <Input
                id="precisionMaximaMetros"
                type="number"
                min="5"
                {...register("precisionMaximaMetros")}
              />
            </Campo>
          </div>

          <Alert>
            <AlertDescription>
              El GPS no da un punto sino un círculo de error, y se acepta el
              fichaje cuando ese círculo toca la geocerca. Con estos valores,
              alguien con la peor señal admitida podría fichar estando hasta{" "}
              <strong>{radio + precision} m</strong> del jardín. Bajar la
              precisión exigida ajusta ese margen, pero aumenta los rechazos
              con mal clima o bajo techo.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reconocimiento facial</CardTitle>
          <CardDescription>
            Los tres van de 0 a 1 y en el mismo sentido: cuanto más alto, más
            exigente. Subirlos rechaza más fichajes legítimos; bajarlos deja
            pasar más ajenos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="similitudMinima"
            etiqueta="Similitud mínima"
            ayuda="Parecido exigido con el rostro registrado"
            error={errors.similitudMinima?.message}
          >
            <Input
              id="similitudMinima"
              type="number"
              step="0.05"
              {...register("similitudMinima")}
            />
          </Campo>

          <Campo
            id="umbralLiveness"
            etiqueta="Umbral liveness"
            ayuda="Score mínimo, de 0 a 1"
            error={errors.umbralLiveness?.message}
          >
            <Input
              id="umbralLiveness"
              type="number"
              step="0.05"
              {...register("umbralLiveness")}
            />
          </Campo>

          <Campo
            id="umbralAntispoof"
            etiqueta="Umbral antispoof"
            ayuda="Score mínimo, de 0 a 1"
            error={errors.umbralAntispoof?.message}
          >
            <Input
              id="umbralAntispoof"
              type="number"
              step="0.05"
              {...register("umbralAntispoof")}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Días laborales</CardTitle>
          <CardDescription>
            Solo en estos días se marca ausente a quien no fichó.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="diasLaborales"
            render={({ field }) => (
              <div className="flex flex-wrap gap-4">
                {DIAS.map((d) => {
                  const marcado = field.value?.includes(d.valor) ?? false;
                  return (
                    <label
                      key={d.valor}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(checked) => {
                          const actuales = field.value ?? [];
                          field.onChange(
                            checked
                              ? [...actuales, d.valor].sort()
                              : actuales.filter((v) => v !== d.valor),
                          );
                        }}
                      />
                      {d.etiqueta}
                    </label>
                  );
                })}
              </div>
            )}
          />
          {errors.diasLaborales && (
            <p className="text-destructive mt-2 text-sm">
              {errors.diasLaborales.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Guardar configuración
      </Button>
    </form>
  );
}
