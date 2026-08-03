"use client";

import { Loader2, Paperclip, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adjuntarComprobantes,
  cancelarLicencia,
} from "@/app/(app)/licencias/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACCEPT_COMPROBANTES,
  COMPROBANTES_MAXIMOS,
  problemaDelComprobante,
} from "@/lib/validaciones";

/**
 * Lo que la empleada puede hacer con un envío suyo todavía sin resolver:
 * sumarle la hoja que faltaba o darlo de baja.
 *
 * Las dos acciones desaparecen apenas la dirección lo revisa; el servidor lo
 * vuelve a comprobar igual, esto es solo para no ofrecer lo que no se puede.
 */
export function AccionesMiLicencia({
  id,
  enviado,
  comprobantes,
}: {
  id: string;
  enviado: string;
  comprobantes: number;
}) {
  const router = useRouter();
  const inputArchivos = useRef<HTMLInputElement>(null);
  const [subiendo, empezarSubida] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, empezarCancelacion] = useTransition();

  const lleno = comprobantes >= COMPROBANTES_MAXIMOS;

  function subir(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return;

    const formData = new FormData();

    for (const archivo of Array.from(archivos)) {
      const problema = problemaDelComprobante(archivo);
      if (problema) {
        toast.error(problema);
        if (inputArchivos.current) inputArchivos.current.value = "";
        return;
      }
      formData.append("archivos", archivo);
    }

    empezarSubida(async () => {
      const r = await adjuntarComprobantes(id, formData);
      if (inputArchivos.current) inputArchivos.current.value = "";

      if (!r.ok) {
        toast.error(r.error);
        return;
      }

      toast.success(r.mensaje);
      router.refresh();
    });
  }

  function cancelar() {
    empezarCancelacion(async () => {
      const r = await cancelarLicencia(id);

      if (!r.ok) {
        toast.error(r.error);
        return;
      }

      toast.success(r.mensaje);
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputArchivos}
        type="file"
        multiple
        accept={ACCEPT_COMPROBANTES}
        className="sr-only"
        onChange={(e) => subir(e.target.files)}
      />

      <Button
        variant="ghost"
        size="sm"
        disabled={subiendo || lleno}
        title={lleno ? `Ya tiene ${COMPROBANTES_MAXIMOS} comprobantes` : undefined}
        onClick={() => inputArchivos.current?.click()}
      >
        {subiendo ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
        Adjuntar
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Dar de baja el certificado enviado el ${enviado}`}
        onClick={() => setConfirmando(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja el envío</DialogTitle>
            <DialogDescription>
              Se borra el certificado que enviaste el {enviado} y los archivos
              adjuntos. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Volver
            </Button>
            <Button variant="destructive" disabled={cancelando} onClick={cancelar}>
              {cancelando && <Loader2 className="size-4 animate-spin" />}
              Dar de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
