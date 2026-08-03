import {
  ESTADOS_LICENCIA,
  ETIQUETA_ESTADO_LICENCIA,
  ETIQUETA_TIPO_LICENCIA,
  TIPOS_LICENCIA,
} from "@/lib/validaciones";

/**
 * Traducciones de los enums de licencia para pantalla.
 *
 * Viven acá y no en cada page porque un archivo `page.tsx` solo puede exportar
 * lo que Next.js espera (el default, `metadata`, y poco más): cualquier otro
 * export rompe la verificación de tipos de la ruta.
 */

export function etiquetaDeEstadoLicencia(estado: string): string {
  return (
    ETIQUETA_ESTADO_LICENCIA[estado as (typeof ESTADOS_LICENCIA)[number]] ??
    estado
  );
}

export function etiquetaDeTipoLicencia(tipo: string): string {
  return ETIQUETA_TIPO_LICENCIA[tipo as (typeof TIPOS_LICENCIA)[number]] ?? tipo;
}

export function colorDeEstadoLicencia(estado: string) {
  if (estado === "APROBADA") return "secondary" as const;
  if (estado === "RECHAZADA") return "destructive" as const;
  return "default" as const;
}
