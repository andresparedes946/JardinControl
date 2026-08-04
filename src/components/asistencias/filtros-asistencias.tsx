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
import { nombreDePeriodo } from "@/lib/time";
import {
  ESTADOS_ASISTENCIA,
  ETIQUETA_ESTADO_ASISTENCIA,
} from "@/lib/validaciones";

const TODOS = "todos";

type Props = {
  periodos: string[];
  periodoActual: string;
  empleadas: { id: string; nombre: string }[];
  salas: { id: string; nombre: string }[];
};

export function FiltrosAsistencias({
  periodos,
  periodoActual,
  empleadas,
  salas,
}: Props) {
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

  const empleado = searchParams.get("empleado") ?? TODOS;
  const sala = searchParams.get("sala") ?? TODOS;
  const estado = searchParams.get("estado") ?? TODOS;
  const hayFiltros =
    empleado !== TODOS || sala !== TODOS || estado !== TODOS;

  const opcionesPeriodo = Object.fromEntries(
    periodos.map((p) => [p, nombreDePeriodo(p)]),
  );
  const opcionesEmpleada = {
    [TODOS]: "Todas las empleadas",
    ...Object.fromEntries(empleadas.map((e) => [e.id, e.nombre])),
  };
  const opcionesSala = {
    [TODOS]: "Todas las salas",
    ...Object.fromEntries(salas.map((s) => [s.id, s.nombre])),
  };
  const opcionesEstado = {
    [TODOS]: "Todos los estados",
    ...ETIQUETA_ESTADO_ASISTENCIA,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={opcionesPeriodo}
        value={periodoActual}
        onValueChange={(v) => aplicar({ periodo: String(v) })}
      >
        <SelectTrigger aria-label="Elegir mes">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodos.map((p) => (
            <SelectItem key={p} value={p}>
              {nombreDePeriodo(p)}
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

      <Select
        items={opcionesSala}
        value={sala}
        onValueChange={(v) => aplicar({ sala: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por sala">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(opcionesSala).map(([id, nombre]) => (
            <SelectItem key={id} value={id}>
              {nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
          {ESTADOS_ASISTENCIA.map((e) => (
            <SelectItem key={e} value={e}>
              {ETIQUETA_ESTADO_ASISTENCIA[e]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => aplicar({ empleado: TODOS, sala: TODOS, estado: TODOS })}
        >
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
