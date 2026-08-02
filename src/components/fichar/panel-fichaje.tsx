"use client";

import { CheckCircle2, Clock, LogIn, LogOut, XCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RespuestaFichaje } from "@/app/(app)/fichar/acciones";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Mismo motivo que en el registro facial: el paquete de reconocimiento no
 * puede entrar al bundle del servidor, y no hay nada que renderizar ahí. */
const CapturaFichaje = dynamic(
  () => import("./captura-fichaje").then((m) => m.CapturaFichaje),
  {
    ssr: false,
    loading: () => (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Preparando la cámara…
      </p>
    ),
  },
);

type Props = {
  /** `null` cuando la jornada de hoy ya está cerrada. */
  proximo: "INGRESO" | "EGRESO" | null;
  sinEnrolar: boolean;
};

export function PanelFichaje({ proximo, sinEnrolar }: Props) {
  const router = useRouter();
  const [capturando, setCapturando] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaFichaje | null>(null);

  function cerrar() {
    setRespuesta(null);
    setCapturando(false);
    router.refresh();
  }

  if (respuesta) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          {respuesta.ok ? (
            <>
              <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-500" />
              <div className="space-y-1">
                <p className="text-xl font-semibold">
                  {respuesta.tipo === "INGRESO"
                    ? "Entrada registrada"
                    : "Salida registrada"}
                </p>
                <p className="text-3xl font-semibold tabular-nums">
                  {respuesta.hora}
                </p>
              </div>

              {respuesta.tipo === "INGRESO" && respuesta.minutosTarde > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  Llegaste {respuesta.minutosTarde} minutos tarde.
                </p>
              )}

              {respuesta.trabajadas && (
                <p className="text-muted-foreground text-sm">
                  Trabajaste {respuesta.trabajadas} hoy.
                </p>
              )}
            </>
          ) : (
            <>
              <XCircle className="text-destructive size-12" />
              <div className="space-y-1">
                <p className="text-lg font-semibold">No se pudo fichar</p>
                <p className="text-muted-foreground text-sm">
                  {respuesta.motivo}
                </p>
              </div>
            </>
          )}

          <Button className="w-full" onClick={cerrar}>
            {respuesta.ok ? "Listo" : "Volver a intentar"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (capturando && proximo) {
    return (
      <Card>
        <CardContent className="py-6">
          <CapturaFichaje
            accion={
              proximo === "INGRESO" ? "Registrar entrada" : "Registrar salida"
            }
            onResultado={setRespuesta}
            onCancelar={() => setCapturando(false)}
          />
        </CardContent>
      </Card>
    );
  }

  if (sinEnrolar) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <XCircle className="text-muted-foreground size-8" />
          <div>
            <p className="font-medium">Todavía no tenés el rostro registrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pedile a la dirección que te lo registre. Hasta entonces no vas a
              poder fichar.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (proximo === null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-500" />
          <div>
            <p className="font-medium">Tu jornada de hoy ya está cerrada</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Si falta corregir algo, hablalo con la dirección.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="bg-muted rounded-full p-4">
          {proximo === "INGRESO" ? (
            <LogIn className="text-muted-foreground size-8" />
          ) : (
            <LogOut className="text-muted-foreground size-8" />
          )}
        </div>

        <div>
          <p className="font-medium">
            {proximo === "INGRESO"
              ? "Registrá tu entrada"
              : "Registrá tu salida"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Vamos a pedirte la cámara y la ubicación. Solo se puede fichar
            dentro del radio del jardín.
          </p>
        </div>

        <Button size="lg" className="w-full" onClick={() => setCapturando(true)}>
          <Clock className="size-4" />
          {proximo === "INGRESO" ? "Fichar entrada" : "Fichar salida"}
        </Button>
      </CardContent>
    </Card>
  );
}
