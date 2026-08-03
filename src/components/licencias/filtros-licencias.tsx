"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ESTADOS_LICENCIA,
  ETIQUETA_ESTADO_LICENCIA,
} from "@/lib/validaciones";

const TODOS = "todos";

export function FiltrosLicencias({
  empleadas,
}: {
  empleadas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function aplicar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams);

    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === "" || valor === TODOS) params.delete(clave);
      else params.set(clave, valor);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  const estado = searchParams.get("estado") ?? TODOS;
  const empleado = searchParams.get("empleado") ?? TODOS;
  const hayFiltros = estado !== TODOS || empleado !== TODOS;

  const opcionesEstado = {
    [TODOS]: "Todos los estados",
    ...ETIQUETA_ESTADO_LICENCIA,
  };
  const opcionesEmpleada = {
    [TODOS]: "Todas las empleadas",
    ...Object.fromEntries(empleadas.map((e) => [e.id, e.nombre])),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={opcionesEstado}
        value={estado}
        onValueChange={(v) => aplicar({ estado: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los estados</SelectItem>
          {ESTADOS_LICENCIA.map((e) => (
            <SelectItem key={e} value={e}>
              {ETIQUETA_ESTADO_LICENCIA[e]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={opcionesEmpleada}
        value={empleado}
        onValueChange={(v) => aplicar({ empleado: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por empleada">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(opcionesEmpleada).map(([id, nombre]) => (
            <SelectItem key={id} value={id}>
              {nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => aplicar({ estado: TODOS, empleado: TODOS })}
        >
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
