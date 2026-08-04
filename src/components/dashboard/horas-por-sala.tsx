/**
 * Horas trabajadas por sala en el mes.
 *
 * Una sola serie —horas—, así que todas las barras van del mismo color: pintar
 * cada una del color de su sala haría que el tono repita lo que ya dice el
 * largo, y encima esos colores los elige la dirección en Configuración y no
 * hay forma de garantizar que se distingan entre sí. El color de la sala
 * queda donde sirve, en el punto que acompaña al nombre, igual que en el
 * resto de la app.
 *
 * Cada fila lleva su valor al final de la barra, así que no hace falta pasar
 * el mouse por ningún lado para leer el número.
 */
export function HorasPorSala({
  salas,
}: {
  salas: { sala: string; color: string; minutos: number; horas: string }[];
}) {
  if (salas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay horas cargadas en este mes.
      </p>
    );
  }

  const maximo = Math.max(...salas.map((s) => s.minutos));

  return (
    <ul className="space-y-3">
      {salas.map((s) => (
        <li key={s.sala} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="truncate">{s.sala}</span>
            </span>
            <span className="shrink-0 tabular-nums">{s.horas}</span>
          </div>

          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-foreground/70 h-full rounded-full"
              style={{ width: `${(s.minutos / maximo) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
