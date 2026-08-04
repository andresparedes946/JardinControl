"use client";

import { useState } from "react";

import type { DiaDelMes } from "@/lib/dashboard";

/**
 * Asistencia día a día del mes.
 *
 * Columnas apiladas: abajo las jornadas que empezaron dentro del horario,
 * arriba las que llegaron tarde. Van apiladas y no lado a lado porque una
 * llegada tarde **es** una jornada presente, no otra cosa: la altura total de
 * la columna tiene que ser la gente que vino ese día.
 *
 * El color no es el único canal de identidad —hay leyenda, tooltip y tabla—,
 * porque la paleta de la app es monocroma y el ámbar está reservado para el
 * estado "tarde", el mismo que ya usan Mi historial y Sueldos.
 */

const ALTO_PLOT = 128;

export function AsistenciaDelMes({ dias }: { dias: DiaDelMes[] }) {
  const [encima, setEncima] = useState<number | null>(null);

  const maximo = Math.max(1, ...dias.map((d) => d.presentes));
  const hayDatos = dias.some((d) => d.presentes > 0);

  // Sin datos no se dibuja el gráfico vacío. Los ejes, la leyenda y el
  // "máximo 1" de un mes sin fichajes ocupan media pantalla para no decir
  // nada, y encima insinúan que hay algo que mirar.
  if (!hayDatos) {
    return (
      <p className="text-muted-foreground py-6 text-sm">
        Todavía no hay jornadas en este mes. Aparecen acá en cuanto alguien
        fiche.
      </p>
    );
  }

  return (
    <figure className="m-0 space-y-3">
      {/* El `pt-12` es la banda donde aparece el tooltip. Está reservada
          siempre, aunque nadie esté señalando nada: si el tooltip se dibujara
          encima de lo que hay arriba, taparía el título de la tarjeta. */}
      <div className="relative pt-12">
        {encima !== null && dias[encima] && (
          <Tooltip dia={dias[encima]} total={dias.length} indice={encima} />
        )}

        <div
          className="flex items-end gap-[2px]"
          style={{ height: ALTO_PLOT }}
          // Un solo handler sobre todo el plot en vez de uno por columna: con
          // 31 días cada columna mide unos 20 px y las barras bajas apenas 3,
          // así que se toma la columna más cercana al puntero. Además no deja
          // huecos muertos entre columnas.
          onMouseMove={(e) => {
            const caja = e.currentTarget.getBoundingClientRect();
            const proporcion = (e.clientX - caja.left) / caja.width;
            setEncima(
              Math.min(dias.length - 1, Math.max(0, Math.floor(proporcion * dias.length))),
            );
          }}
          onMouseLeave={() => setEncima(null)}
        >
          {dias.map((d, i) => {
            const aHorario = Math.max(0, d.presentes - d.tarde);
            const alto = (n: number) => (n / maximo) * ALTO_PLOT;

            return (
              <div
                key={d.dia}
                className="flex h-full flex-1 cursor-default flex-col justify-end gap-[2px]"
              >
                {/* La barra se topea en 24 px aunque la columna sea más ancha:
                    llenar todo el espacio disponible la vuelve un bloque. El
                    aire sobrante sigue siendo área sensible. */}
                {d.tarde > 0 && (
                  <div
                    className="mx-auto w-full max-w-6 rounded-t bg-amber-600 dark:bg-amber-500"
                    style={{ height: Math.max(3, alto(d.tarde)) }}
                  />
                )}
                {aHorario > 0 && (
                  <div
                    className={`bg-foreground/70 mx-auto w-full max-w-6 ${
                      d.tarde > 0 ? "" : "rounded-t"
                    } ${encima === i ? "opacity-100" : "opacity-90"}`}
                    style={{ height: Math.max(3, alto(aHorario)) }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="border-border mt-0 border-t" />

        <div className="mt-1 flex gap-[2px]">
          {dias.map((d) => (
            <span
              key={d.dia}
              className="text-muted-foreground flex-1 text-center text-[10px] tabular-nums"
            >
              {/* Etiquetar los 31 días llenaría el eje de números ilegibles. */}
              {d.dia === 1 || d.dia % 5 === 0 ? d.dia : ""}
            </span>
          ))}
        </div>
      </div>

      {/* La leyenda va abajo para dejar libre la banda del tooltip. */}
      <div className="flex items-center gap-4 pt-1">
        <Clave className="bg-foreground/70" etiqueta="A horario" />
        <Clave className="bg-amber-600 dark:bg-amber-500" etiqueta="Llegó tarde" />
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          máximo {maximo}
        </span>
      </div>

      <TablaDeDias dias={dias} />
    </figure>
  );
}

function Clave({ className, etiqueta }: { className: string; etiqueta: string }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <span className={`size-2.5 rounded-sm ${className}`} aria-hidden />
      {etiqueta}
    </span>
  );
}

function Tooltip({
  dia,
  indice,
  total,
}: {
  dia: DiaDelMes;
  indice: number;
  total: number;
}) {
  // Se ancla al centro de la columna y se corre hacia adentro en los bordes,
  // para no salirse de la tarjeta en el día 1 ni en el 31.
  const centro = ((indice + 0.5) / total) * 100;
  const alineacion =
    centro < 15 ? "translate-x-0" : centro > 85 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <div
      className="pointer-events-none absolute top-0 z-10"
      style={{ left: `${centro}%` }}
      role="status"
    >
      <div
        className={`bg-popover ring-foreground/10 rounded-lg px-2.5 py-1.5 text-xs shadow-md ring-1 ${alineacion}`}
      >
        <p className="font-medium whitespace-nowrap">
          {etiquetaDeDia(dia.fecha)}
        </p>
        <p className="text-muted-foreground whitespace-nowrap tabular-nums">
          {dia.presentes} {dia.presentes === 1 ? "presente" : "presentes"}
          {dia.tarde > 0 && ` · ${dia.tarde} tarde`}
          {dia.licencias > 0 && ` · ${dia.licencias} de licencia`}
        </p>
      </div>
    </div>
  );
}

/** El mismo dato sin depender del color ni del mouse. */
function TablaDeDias({ dias }: { dias: DiaDelMes[] }) {
  const conDatos = dias.filter((d) => d.presentes > 0 || d.licencias > 0);

  return (
    <details className="text-sm">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
        Ver los días como tabla
      </summary>

      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Día</th>
            <th className="py-1 text-right font-medium">Presentes</th>
            <th className="py-1 text-right font-medium">Tarde</th>
            <th className="py-1 text-right font-medium">Licencia</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {conDatos.map((d) => (
            <tr key={d.dia} className="border-border border-t">
              <td className="py-1">{etiquetaDeDia(d.fecha)}</td>
              <td className="py-1 text-right">{d.presentes}</td>
              <td className="py-1 text-right">{d.tarde || "—"}</td>
              <td className="py-1 text-right">{d.licencias || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * "lun 03/08". El día y el nombre del día se formatean por separado porque
 * pedirlos juntos devuelve "lun 03-08", con guión, y el resto de la app usa
 * barra. La fecha es @db.Date: su parte UTC ya es el día del jardín.
 */
function etiquetaDeDia(fecha: Date): string {
  const nombre = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(fecha);

  const numero = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(fecha);

  return `${nombre} ${numero}`;
}
