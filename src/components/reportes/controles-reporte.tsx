"use client";

import { Download, Printer } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { nombreDePeriodo } from "@/lib/time";
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
  ETIQUETA_TURNO,
  TURNOS,
} from "@/lib/validaciones";

const TODOS = "todos";

const ETIQUETA_TIPO: Record<string, string> = {
  asistencias: "Asistencias",
  sueldos: "Sueldos",
  licencias: "Licencias",
};

/**
 * Los filtros del reporte, en una sola fila arriba de la vista previa.
 *
 * Cada cambio va a la URL, y de la URL salen las dos cosas: lo que se muestra
 * y lo que se descarga. El botón de descarga es un `<a>` a la misma query, así
 * que lo que baja es exactamente lo que está en pantalla.
 */
export function ControlesReporte({
  tipo,
  periodo,
  periodos,
  empleadas,
  salas,
}: {
  tipo: string;
  periodo: string;
  periodos: string[];
  empleadas: { id: string; nombre: string }[];
  salas: { id: string; nombre: string }[];
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

  const empleado = searchParams.get("empleado") ?? TODOS;
  const sala = searchParams.get("sala") ?? TODOS;
  const turno = searchParams.get("turno") ?? TODOS;
  const estado = searchParams.get("estado") ?? TODOS;

  const descarga = new URLSearchParams(searchParams);
  descarga.set("tipo", tipo);
  descarga.set("periodo", periodo);

  const opcionesEmpleada = {
    [TODOS]: "Todas las empleadas",
    ...Object.fromEntries(empleadas.map((e) => [e.id, e.nombre])),
  };
  const opcionesSala = {
    [TODOS]: "Todas las salas",
    ...Object.fromEntries(salas.map((s) => [s.id, s.nombre])),
  };
  const opcionesTurno = { [TODOS]: "Todos los turnos", ...ETIQUETA_TURNO };
  const opcionesEstado = { [TODOS]: "Todos los estados", ...ETIQUETA_ESTADO_LICENCIA };
  const opcionesPeriodo = Object.fromEntries(
    periodos.map((p) => [p, nombreDePeriodo(p)]),
  );

  return (
    <div className="no-imprimir flex flex-wrap items-center gap-2">
      <Select
        items={ETIQUETA_TIPO}
        value={tipo}
        onValueChange={(v) => aplicar({ tipo: String(v) })}
      >
        <SelectTrigger aria-label="Tipo de reporte">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ETIQUETA_TIPO).map(([clave, etiqueta]) => (
            <SelectItem key={clave} value={clave}>
              {etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={opcionesPeriodo}
        value={periodo}
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

      {/* La sala no filtra sueldos ni licencias: esas dos se leen por
          empleada, y un selector que no hace nada confunde más de lo que
          suma. */}
      {tipo === "asistencias" && (
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
      )}

      {tipo !== "licencias" && (
        <Select
          items={opcionesTurno}
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
      )}

      {tipo === "licencias" && (
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
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir o PDF
        </Button>

        {/* Base UI compone con `render` y los hijos van afuera. `nativeButton`
            en false porque acá el botón es un enlace: sin eso avisa que le
            está sacando la semántica de <button> a algo que no lo es. */}
        <Button
          nativeButton={false}
          render={<a href={`/api/reportes?${descarga.toString()}`} download />}
        >
          <Download className="size-4" />
          Descargar CSV
        </Button>
      </div>
    </div>
  );
}
