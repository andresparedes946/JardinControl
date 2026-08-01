/**
 * Geocerca del jardín.
 *
 * Funciones puras, sin acceso a base de datos ni a `navigator`, para que la
 * decisión de aceptar o rechazar un fichaje pueda ejecutarse en el servidor
 * y testearse sin montar nada.
 */

const RADIO_TIERRA_METROS = 6_371_008.8; // radio medio (IUGG)

export type Coordenada = {
  lat: number;
  lng: number;
};

export type Geocerca = {
  lat: number;
  lng: number;
  /** Radio permitido, en metros. */
  radioMetros: number;
  /** Si el GPS reporta una precisión peor que esto, el dato no es confiable. */
  precisionMaximaMetros: number;
};

export type LecturaGps = Coordenada & {
  /** `coords.accuracy` del navegador: radio de incertidumbre en metros. */
  precisionMetros: number;
};

export type ResultadoUbicacion =
  | { dentro: true; distanciaMetros: number }
  | { dentro: false; distanciaMetros: number | null; motivo: string };

const gradosARadianes = (grados: number) => (grados * Math.PI) / 180;

/**
 * Distancia sobre la superficie terrestre entre dos coordenadas (haversine).
 * Suficientemente exacta en las distancias cortas que nos interesan.
 */
export function distanciaEnMetros(a: Coordenada, b: Coordenada): number {
  const dLat = gradosARadianes(b.lat - a.lat);
  const dLng = gradosARadianes(b.lng - a.lng);
  const latA = gradosARadianes(a.lat);
  const latB = gradosARadianes(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(latA) * Math.cos(latB);

  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.sqrt(h));
}

export function esCoordenadaValida(c: Partial<Coordenada>): c is Coordenada {
  return (
    typeof c.lat === "number" &&
    typeof c.lng === "number" &&
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    Math.abs(c.lat) <= 90 &&
    Math.abs(c.lng) <= 180
  );
}

/**
 * Decide si una lectura de GPS habilita el fichaje.
 *
 * El GPS no devuelve un punto sino un círculo de incertidumbre de radio
 * `precisionMetros`. Se acepta cuando ese círculo se superpone con la
 * geocerca, y se descarta de entrada la lectura demasiado imprecisa como
 * para significar algo: sin ese corte, un `accuracy` enorme volvería la
 * geocerca inútil, porque siempre habría superposición.
 */
export function evaluarUbicacion(
  lectura: LecturaGps,
  cerca: Geocerca,
): ResultadoUbicacion {
  if (!esCoordenadaValida(lectura)) {
    return {
      dentro: false,
      distanciaMetros: null,
      motivo: "No se recibió una ubicación válida del dispositivo.",
    };
  }

  const precision = Number.isFinite(lectura.precisionMetros)
    ? Math.max(0, lectura.precisionMetros)
    : Number.POSITIVE_INFINITY;

  if (precision > cerca.precisionMaximaMetros) {
    return {
      dentro: false,
      distanciaMetros: null,
      motivo:
        `La señal GPS es demasiado imprecisa (±${Math.round(precision)} m). ` +
        "Salí al patio o a un lugar abierto y probá de nuevo.",
    };
  }

  const distanciaMetros = distanciaEnMetros(lectura, {
    lat: cerca.lat,
    lng: cerca.lng,
  });

  if (distanciaMetros - precision <= cerca.radioMetros) {
    return { dentro: true, distanciaMetros };
  }

  return {
    dentro: false,
    distanciaMetros,
    motivo: `Estás a ${formatearDistancia(distanciaMetros)} del jardín. Solo se puede fichar dentro de ${cerca.radioMetros} m.`,
  };
}

export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}
