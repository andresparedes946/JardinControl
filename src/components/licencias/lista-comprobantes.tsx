import { FileText, ImageIcon, Paperclip } from "lucide-react";

/**
 * Los comprobantes adjuntos de una licencia.
 *
 * Cada uno es un enlace común a `/api/comprobantes/[id]`, que comprueba quién
 * pide y redirige a una URL firmada de un minuto. El archivo nunca se sirve
 * desde una URL pública: son certificados médicos.
 */
export function ListaComprobantes({
  comprobantes,
}: {
  comprobantes: {
    id: string;
    nombreOriginal: string;
    mimeType: string;
    tamanioBytes: number;
  }[];
}) {
  if (comprobantes.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Paperclip className="size-3" />
        Sin comprobantes
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {comprobantes.map((c) => {
        const Icono = c.mimeType === "application/pdf" ? FileText : ImageIcon;

        return (
          <li key={c.id}>
            <a
              href={`/api/comprobantes/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex max-w-56 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors focus-visible:ring-3 focus-visible:outline-none"
            >
              <Icono className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{c.nombreOriginal}</span>
              <span className="text-muted-foreground shrink-0">
                {pesoLegible(c.tamanioBytes)}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** 1048576 → "1 MB". Los certificados van de unos KB a unos pocos MB. */
export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
