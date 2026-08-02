/**
 * Constantes y matemática del reconocimiento facial.
 *
 * A propósito no lleva `server-only`: el descriptor lo calcula el navegador
 * y lo valida el servidor, y las dos puntas tienen que hacer exactamente la
 * misma cuenta o los umbrales significan cosas distintas en cada lado.
 */

/** Largo del vector que devuelve el modelo faceres (capa global_pooling/Mean). */
export const DIMENSION_DESCRIPTOR = 1024;

/**
 * Muestras que se toman al enrolar. Varias, y no una, para cubrir cambios de
 * luz y de ángulo: al fichar alcanza con parecerse a la más cercana.
 */
export const MUESTRAS_ENROLAMIENTO = 10;

/**
 * Confianza mínima de la detección para tomar la muestra como buena.
 *
 * Se mide contra el mínimo entre `boxScore` (detección) y `faceScore` (malla),
 * no contra `face.score`: ese último es `faceScore` redondeado a dos decimales
 * y satura en 1.00 con cualquier cara pasable, así que compararlo contra un
 * umbral no filtraba nada. El primer enrolamiento real dio 1.000 en las diez
 * muestras, que fue justamente lo que delató el problema.
 *
 * Con la métrica arreglada y enrolando de frente, dos enrolamientos reales
 * dieron entre 0.83 y 0.92. El piso en 0.70 descarta las capturas flojas sin
 * volver eterna la toma.
 */
export const CALIDAD_MINIMA = 0.7;

/**
 * Similitud mínima que se le exige a cada muestra contra la primera.
 *
 * Es la guarda contra enrolar a dos personas en el mismo legajo: si alguien
 * se cruza delante de la cámara a mitad de la captura, su muestra no se
 * parece a la de referencia y se descarta.
 *
 * Medido sobre dos rostros reales enrolados de frente (`npm run rostros`):
 *
 *   misma persona, contra su muestra frontal   0.54 a 0.93
 *   personas distintas, máximo cruzado         0.19
 *
 * Cualquier valor entre 0.25 y 0.5 cumple la función. Queda en 0.45, que deja
 * margen de los dos lados: bien por encima de lo que puede alcanzar una cara
 * ajena y por debajo del piso legítimo observado.
 *
 * Son dos personas, no una muestra estadística. Si aparecieran rechazos al
 * enrolar, este es el primer número a revisar.
 */
export const SIMILITUD_MINIMA_ENTRE_MUESTRAS = 0.45;

/** Lado mínimo del rostro, en proporción del alto del video. Filtra a quien
 * pasa de fondo y a quien está demasiado lejos para dar un descriptor útil. */
export const PROPORCION_MINIMA_ROSTRO = 0.25;

/**
 * Grados de giro tolerados en cada eje al enrolar.
 *
 * Empezó en 25 para dejar lugar a giros amplios, con la idea de que más
 * variedad de pose era mejor. Medido, resultó al revés: con dos rostros
 * enrolados, las muestras de tres cuartos quedaron a 0.40 de la frontal de su
 * propia dueña, mientras que el máximo entre personas distintas trepó a 0.39.
 * Una cara girada lleva menos información de identidad, así que se parece
 * poco a sí misma y bastante a cualquier otra: es la peor combinación
 * posible. La variedad que sirve al enrolar es de luz y de gesto, no de
 * ángulo.
 *
 * Rehechos los mismos dos enrolamientos siempre de frente, el piso propio
 * subió de 0.40 a 0.53 y el máximo cruzado bajó de 0.39 a 0.19: de un
 * centésimo de separación a 0.34.
 */
export const GIRO_MAXIMO_GRADOS = 15;

/**
 * Mínimo de antispoof y de prueba de vida exigido al enrolar.
 *
 * Es más flojo que el del fichaje (que sale de la configuración del jardín)
 * porque el enrolamiento lo hace la directora con la empleada delante: acá
 * el control solo atrapa el error honesto de encuadrar una foto impresa.
 */
export const REAL_MINIMO_ENROLAMIENTO = 0.5;

/** Espera entre muestras. Sin ella se guardarían diez veces el mismo frame. */
export const MS_ENTRE_MUESTRAS = 700;

/**
 * Distancia entre dos descriptores, en la escala de Human: la suma de
 * cuadrados multiplicada por 25. No es la distancia euclídea cruda; se
 * replica tal cual la de la librería para que un umbral tomado de su
 * documentación signifique lo mismo acá.
 */
export function distancia(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;

  let suma = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    suma += d * d;
  }

  return Math.round(100 * 25 * suma) / 100;
}

/**
 * Similitud normalizada a 0..1, donde 1 es el mismo rostro. Equivale a
 * `human.match.similarity(a, b)` con sus opciones por defecto (el rango
 * útil 0.2..0.8 estirado a 0..1), que es la escala sobre la que la
 * documentación de Human da sus recomendaciones.
 */
export function similitud(a: readonly number[], b: readonly number[]): number {
  const dist = distancia(a, b);
  if (dist === 0) return 1;

  const normalizada = (1 - Math.sqrt(dist) / 100 - 0.2) / 0.6;
  return Math.round(100 * Math.min(Math.max(normalizada, 0), 1)) / 100;
}

/** Similitud contra el descriptor más parecido del conjunto. */
export function similitudMaxima(
  descriptor: readonly number[],
  conjunto: readonly (readonly number[])[],
): number {
  let mejor = 0;
  for (const otro of conjunto) {
    const s = similitud(descriptor, otro);
    if (s > mejor) mejor = s;
  }
  return mejor;
}
