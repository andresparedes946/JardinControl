"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  actualizarSala,
  crearSala,
  eliminarSala,
} from "@/app/(app)/configuracion/acciones";
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

type Sala = {
  id: string;
  nombre: string;
  color: string;
  _count: { empleados: number };
};

const COLOR_POR_DEFECTO = "#94a3b8";

export function GestionSalas({ salas }: { salas: Sala[] }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [colorNuevo, setColorNuevo] = useState(COLOR_POR_DEFECTO);

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string; error?: string }>) {
    startTransition(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(r.mensaje);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salas</CardTitle>
        <CardDescription>
          El color se usa para identificar la sala de un vistazo en el listado
          de empleadas y en los reportes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="divide-y">
          {salas.map((sala) => (
            <li
              key={sala.id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0"
            >
              <Input
                type="color"
                defaultValue={sala.color}
                aria-label={`Color de ${sala.nombre}`}
                className="h-9 w-14 shrink-0 p-1"
                onBlur={(e) => {
                  if (e.target.value === sala.color) return;
                  ejecutar(() =>
                    actualizarSala(sala.id, {
                      nombre: sala.nombre,
                      color: e.target.value,
                    }),
                  );
                }}
              />

              <Input
                defaultValue={sala.nombre}
                aria-label={`Nombre de ${sala.nombre}`}
                className="min-w-[140px] flex-1"
                onBlur={(e) => {
                  const nombre = e.target.value.trim();
                  if (nombre === sala.nombre || nombre === "") {
                    e.target.value = sala.nombre;
                    return;
                  }
                  ejecutar(() =>
                    actualizarSala(sala.id, { nombre, color: sala.color }),
                  );
                }}
              />

              <span className="text-muted-foreground w-24 shrink-0 text-xs">
                {sala._count.empleados === 0
                  ? "sin empleadas"
                  : `${sala._count.empleados} empleada${sala._count.empleados > 1 ? "s" : ""}`}
              </span>

              <Button
                variant="ghost"
                size="icon"
                aria-label={`Eliminar ${sala.nombre}`}
                disabled={pendiente}
                onClick={() => ejecutar(() => eliminarSala(sala.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="color-nuevo">Color</Label>
            <Input
              id="color-nuevo"
              type="color"
              value={colorNuevo}
              onChange={(e) => setColorNuevo(e.target.value)}
              className="h-9 w-14 p-1"
            />
          </div>

          <div className="min-w-[160px] flex-1 space-y-2">
            <Label htmlFor="nombre-nuevo">Nueva sala</Label>
            <Input
              id="nombre-nuevo"
              value={nombreNuevo}
              placeholder="Sala de 1"
              onChange={(e) => setNombreNuevo(e.target.value)}
            />
          </div>

          <Button
            disabled={pendiente || nombreNuevo.trim() === ""}
            onClick={() =>
              ejecutar(async () => {
                const r = await crearSala({
                  nombre: nombreNuevo,
                  color: colorNuevo,
                });
                if (r.ok) {
                  setNombreNuevo("");
                  setColorNuevo(COLOR_POR_DEFECTO);
                }
                return r;
              })
            }
          >
            {pendiente ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
