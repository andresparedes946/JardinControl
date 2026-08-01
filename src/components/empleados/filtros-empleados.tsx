"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETIQUETA_TURNO, TURNOS } from "@/lib/validaciones";

const TODOS = "todos";

export function FiltrosEmpleados({
  salas,
}: {
  salas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");

  function aplicar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);

    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "" || valor === TODOS) params.delete(clave);
      else params.set(clave, valor);
    }

    // Cualquier cambio de filtro invalida la página en la que estabas.
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Se espera a que deje de tipear para no lanzar una consulta por tecla.
  useEffect(() => {
    const actual = searchParams.get("q") ?? "";
    if (busqueda === actual) return;

    const id = setTimeout(() => aplicar({ q: busqueda }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const turno = searchParams.get("turno") ?? TODOS;
  const sala = searchParams.get("sala") ?? TODOS;
  const estado = searchParams.get("estado") ?? TODOS;
  const hayFiltros =
    busqueda !== "" || turno !== TODOS || sala !== TODOS || estado !== TODOS;

  const opcionesSala = {
    [TODOS]: "Todas las salas",
    ...Object.fromEntries(salas.map((s) => [s.id, s.nombre])),
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, DNI o legajo"
          className="pl-8"
          aria-label="Buscar empleadas"
        />
      </div>

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
        items={{ [TODOS]: "Todos los turnos", ...ETIQUETA_TURNO }}
        value={turno}
        onValueChange={(v) => aplicar({ turno: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por turno">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los turnos</SelectItem>
          {TURNOS.map((t) => (
            <SelectItem key={t} value={t}>
              {ETIQUETA_TURNO[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={{
          [TODOS]: "Activas e inactivas",
          ACTIVO: "Solo activas",
          INACTIVO: "Solo inactivas",
        }}
        value={estado}
        onValueChange={(v) => aplicar({ estado: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por estado">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Activas e inactivas</SelectItem>
          <SelectItem value="ACTIVO">Solo activas</SelectItem>
          <SelectItem value="INACTIVO">Solo inactivas</SelectItem>
        </SelectContent>
      </Select>

      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setBusqueda("");
            router.push(pathname);
          }}
        >
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
