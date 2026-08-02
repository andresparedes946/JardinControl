"use client";

import { Camera, Check, Loader2, ScanFace, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { borrarDescriptores } from "@/app/(app)/empleados/acciones";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MUESTRAS_ENROLAMIENTO } from "@/lib/rostro";

/**
 * La captura se carga aparte y solo en el navegador.
 *
 * `ssr: false` no es una optimización: el paquete de reconocimiento facial
 * resuelve su build de Node cuando lo compila el servidor, y ese build pide
 * @tensorflow/tfjs-node, que no está ni tiene por qué estar. Dejarlo fuera
 * del renderizado del servidor además evita bajar varios megabytes de
 * TensorFlow a quien solo entró a mirar si el rostro ya estaba registrado.
 */
const CapturaFacial = dynamic(
  () => import("./captura-facial").then((m) => m.CapturaFacial),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Preparando la cámara…
      </div>
    ),
  },
);

type Props = {
  empleadoId: string;
  nombre: string;
  /** Enrolamiento vigente, si ya lo tiene. */
  registrado: { muestras: number; fecha: string } | null;
};

export function RegistroFacial({ empleadoId, nombre, registrado }: Props) {
  const router = useRouter();

  const [capturando, setCapturando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  async function borrar() {
    setBorrando(true);
    setConfirmarBorrado(false);

    const resultado = await borrarDescriptores(empleadoId);
    setBorrando(false);

    if (resultado.ok) {
      toast.success(resultado.mensaje);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Registro facial</CardTitle>
          <CardDescription>
            Se toman {MUESTRAS_ENROLAMIENTO} capturas y se guarda únicamente el
            vector que las describe. Las fotos no salen de este dispositivo ni
            quedan almacenadas en ningún lado.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {capturando ? (
            <CapturaFacial
              empleadoId={empleadoId}
              onGuardado={() => {
                setCapturando(false);
                router.refresh();
              }}
              onCancelar={() => setCapturando(false)}
            />
          ) : (
            <>
              <div className="bg-muted/50 flex items-start gap-3 rounded-lg border p-4">
                {registrado ? (
                  <>
                    <Check className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-500" />
                    <div className="text-sm">
                      <p className="font-medium">Rostro registrado</p>
                      <p className="text-muted-foreground">
                        {registrado.muestras} muestras, del {registrado.fecha}.
                        Volver a registrar reemplaza las anteriores.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ScanFace className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">
                        Todavía no tiene rostro registrado
                      </p>
                      <p className="text-muted-foreground">
                        Hasta que lo tenga no va a poder fichar.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setCapturando(true)} disabled={borrando}>
                  <Camera className="size-4" />
                  {registrado ? "Volver a registrar" : "Registrar rostro"}
                </Button>

                {registrado && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmarBorrado(true)}
                    disabled={borrando}
                  >
                    {borrando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Borrar registro
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar el registro facial de {nombre}?</DialogTitle>
            <DialogDescription>
              Deja de poder fichar hasta que le tomes las{" "}
              {MUESTRAS_ENROLAMIENTO} capturas de nuevo. Sus asistencias
              anteriores no se tocan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmarBorrado(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={borrar}>
              Borrar registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
