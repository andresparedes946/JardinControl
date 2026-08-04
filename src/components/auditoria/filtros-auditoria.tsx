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
  ETIQUETA_ACCION_AUDITORIA,
  ETIQUETA_ENTIDAD_AUDITORIA,
} from "@/lib/validaciones";

const TODOS = "todos";

/** Las acciones y entidades, ordenadas por cómo se leen y no por su clave. */
function porEtiqueta(mapa: Record<string, string>) {
  return Object.entries(mapa).sort((a, b) => a[1].localeCompare(b[1], "es"));
}

export function FiltrosAuditoria({
  periodos,
  periodoActual,
  usuarios,
}: {
  periodos: string[];
  periodoActual: string;
  usuarios: { id: string; nombre: string }[];
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

    // Cualquier cambio de filtro invalida la página en la que estabas.
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  const usuario = searchParams.get("usuario") ?? TODOS;
  const accion = searchParams.get("accion") ?? TODOS;
  const entidad = searchParams.get("entidad") ?? TODOS;
  const hayFiltros =
    usuario !== TODOS || accion !== TODOS || entidad !== TODOS;

  const opcionesPeriodo = Object.fromEntries(
    periodos.map((p) => [p, nombreDePeriodo(p)]),
  );
  const opcionesUsuario = {
    [TODOS]: "Todos los usuarios",
    ...Object.fromEntries(usuarios.map((u) => [u.id, u.nombre])),
  };
  const opcionesAccion = {
    [TODOS]: "Todas las acciones",
    ...ETIQUETA_ACCION_AUDITORIA,
  };
  const opcionesEntidad = {
    [TODOS]: "Todo el sistema",
    ...ETIQUETA_ENTIDAD_AUDITORIA,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={opcionesPeriodo}
        value={periodoActual}
        onValueChange={(v) => aplicar({ periodo: String(v) })}
      >
        <SelectTrigger aria-label="Elegir mes" className="w-52">
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
        items={opcionesUsuario}
        value={usuario}
        onValueChange={(v) => aplicar({ usuario: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por usuario">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(opcionesUsuario).map(([id, nombre]) => (
            <SelectItem key={id} value={id}>
              {nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={opcionesAccion}
        value={accion}
        onValueChange={(v) => aplicar({ accion: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por acción">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas las acciones</SelectItem>
          {porEtiqueta(ETIQUETA_ACCION_AUDITORIA).map(([clave, etiqueta]) => (
            <SelectItem key={clave} value={clave}>
              {etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={opcionesEntidad}
        value={entidad}
        onValueChange={(v) => aplicar({ entidad: String(v) })}
      >
        <SelectTrigger aria-label="Filtrar por sección">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todo el sistema</SelectItem>
          {porEtiqueta(ETIQUETA_ENTIDAD_AUDITORIA).map(([clave, etiqueta]) => (
            <SelectItem key={clave} value={clave}>
              {etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            aplicar({ usuario: TODOS, accion: TODOS, entidad: TODOS })
          }
        >
          <X className="size-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
