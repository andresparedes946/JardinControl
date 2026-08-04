"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { regenerarCodigo } from "@/app/(app)/codigo/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Regenerar pasa por una confirmación porque deja sin efecto el código que
 * puede estar proyectado en la pared: quien lo escanee después ve un error, y
 * eso no tiene que pasar por haber tocado un botón al lado del QR.
 */
export function RegenerarCodigo() {
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);

  function confirmar() {
    empezar(async () => {
      const r = await regenerarCodigo();
      if (r.ok) {
        toast.success("Código nuevo generado. El anterior dejó de servir.");
        setAbierto(false);
      } else {
        toast.error(r.error ?? "No se pudo generar el código.");
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <RefreshCw className="size-4" />
            Generar uno nuevo
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Generar un código nuevo?</DialogTitle>
          <DialogDescription>
            El que está a la vista deja de funcionar en el acto. Quien lo
            escanee después va a ver un aviso de código vencido, así que
            conviene hacerlo antes de que empiece el turno o después de que
            todas hayan fichado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button onClick={confirmar} disabled={pendiente}>
            {pendiente && <Loader2 className="size-4 animate-spin" />}
            Generar uno nuevo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
