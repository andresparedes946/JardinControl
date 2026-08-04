"use client";

import { Loader2, Lock, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generarLiquidacion } from "@/app/(app)/sueldos/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Congela el mes.
 *
 * Pide confirmación incluso la primera vez: la liquidación es el número que
 * después se paga, y regenerarla pisa lo que ya estaba guardado. El diálogo
 * dice cuántas empleadas y cuánta plata, para que se pueda contrastar contra
 * lo que muestra la tabla antes de apretar.
 */
export function GenerarLiquidacion({
  periodo,
  nombrePeriodo,
  empleadas,
  total,
  yaGenerada,
  desactualizadas,
}: {
  periodo: string;
  nombrePeriodo: string;
  empleadas: number;
  total: string;
  yaGenerada: boolean;
  desactualizadas: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [generando, empezar] = useTransition();

  function confirmar() {
    empezar(async () => {
      const r = await generarLiquidacion(periodo);

      if (!r.ok) {
        toast.error(r.error);
        return;
      }

      toast.success(r.mensaje);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={desactualizadas > 0 || !yaGenerada ? "default" : "outline"}
        disabled={empleadas === 0}
        onClick={() => setAbierto(true)}
      >
        {yaGenerada ? <RefreshCw className="size-4" /> : <Lock className="size-4" />}
        {yaGenerada ? "Regenerar" : "Generar liquidación"}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {yaGenerada ? "Regenerar la liquidación" : "Generar la liquidación"}
            </DialogTitle>
            <DialogDescription>
              {nombrePeriodo}: {empleadas}{" "}
              {empleadas === 1 ? "empleada" : "empleadas"} por {total} en total.
              El valor hora de cada una queda congelado en la liquidación, así
              que un aumento posterior no va a cambiar este mes.
            </DialogDescription>
          </DialogHeader>

          {yaGenerada && (
            <p className="border-border text-muted-foreground mt-2 rounded-lg border border-dashed px-3 py-2 text-xs">
              Este mes ya estaba liquidado. Regenerarlo pisa los importes
              guardados con los de ahora.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Volver
            </Button>
            <Button disabled={generando} onClick={confirmar}>
              {generando && <Loader2 className="size-4 animate-spin" />}
              {yaGenerada ? "Regenerar" : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
