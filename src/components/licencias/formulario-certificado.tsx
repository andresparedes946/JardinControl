"use client";

import { Loader2, Paperclip, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { subirCertificado } from "@/app/(app)/licencias/acciones";
import { pesoLegible } from "@/components/licencias/lista-comprobantes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPT_COMPROBANTES,
  COMPROBANTES_MAXIMOS,
  problemaDelComprobante,
} from "@/lib/validaciones";

/**
 * Envío de un certificado.
 *
 * Es lo único que hace la empleada acá: adjuntar el papel y, si quiere,
 * aclarar algo. No elige tipo ni fechas porque eso lo dice el certificado, y
 * quien lo lee y lo carga es la dirección al revisarlo.
 *
 * El formulario está siempre a la vista, sin un botón que abra un diálogo:
 * es la acción de la pantalla, no una opción entre varias.
 */
export function FormularioCertificado() {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [detalle, setDetalle] = useState("");
  const [enviando, empezarEnvio] = useTransition();
  const inputArchivos = useRef<HTMLInputElement>(null);

  function agregarArchivos(nuevos: FileList | null) {
    if (!nuevos) return;

    const aceptados: File[] = [];

    for (const archivo of Array.from(nuevos)) {
      const problema = problemaDelComprobante(archivo);
      if (problema) {
        toast.error(problema);
        continue;
      }
      aceptados.push(archivo);
    }

    setArchivos((previos) => {
      const total = [...previos, ...aceptados];
      if (total.length > COMPROBANTES_MAXIMOS) {
        toast.error(`Se pueden adjuntar hasta ${COMPROBANTES_MAXIMOS} archivos.`);
        return total.slice(0, COMPROBANTES_MAXIMOS);
      }
      return total;
    });

    // Sin esto, volver a elegir el mismo archivo no dispara `change`.
    if (inputArchivos.current) inputArchivos.current.value = "";
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (archivos.length === 0) {
      toast.error("Adjuntá el certificado antes de enviarlo.");
      return;
    }

    const formData = new FormData();
    formData.set("detalle", detalle);
    for (const archivo of archivos) formData.append("archivos", archivo);

    empezarEnvio(async () => {
      const r = await subirCertificado(formData);

      if (!r.ok) {
        toast.error(r.error);
        return;
      }

      toast.success(r.mensaje);
      setArchivos([]);
      setDetalle("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <h2 className="font-medium">Enviar un certificado</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Sacale una foto o subí el PDF. La dirección lo revisa y carga los
              días que corresponden.
            </p>
          </div>

          <div className="space-y-2">
            <input
              ref={inputArchivos}
              id="certificado"
              type="file"
              multiple
              accept={ACCEPT_COMPROBANTES}
              className="sr-only"
              onChange={(e) => agregarArchivos(e.target.files)}
            />

            <Button
              type="button"
              variant="outline"
              disabled={archivos.length >= COMPROBANTES_MAXIMOS}
              onClick={() => inputArchivos.current?.click()}
            >
              <Paperclip className="size-4" />
              Adjuntar archivo
            </Button>

            {archivos.length > 0 && (
              <ul className="space-y-1 pt-1">
                {archivos.map((archivo, i) => (
                  <li
                    key={`${archivo.name}-${i}`}
                    className="text-muted-foreground flex items-center gap-2 text-xs"
                  >
                    <span className="truncate">{archivo.name}</span>
                    <span className="shrink-0">{pesoLegible(archivo.size)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Quitar ${archivo.name}`}
                      onClick={() =>
                        setArchivos((previos) => previos.filter((_, j) => j !== i))
                      }
                    >
                      <X className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted-foreground text-xs">
              PDF o imagen, hasta {COMPROBANTES_MAXIMOS} archivos de 5 MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle">
              Aclaración <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="detalle"
              rows={2}
              maxLength={500}
              placeholder="Algo que la dirección tenga que saber"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={enviando || archivos.length === 0}>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Enviar certificado
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
