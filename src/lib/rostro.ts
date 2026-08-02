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

/** Confianza mínima de la detección para tomar la muestra como buena. */
export const CALIDAD_MINIMA = 0.6;

/**
 * Similitud mínima entre las muestras de un mismo enrolamiento.
 *
 * Es la guarda contra enrolar a dos personas en el mismo legajo: si alguien
 * se cruza delante de la cámara a mitad de la captura, su muestra no se
 * parece a las anteriores y se descarta.
 */
export const SIMILITUD_MINIMA_ENTRE_MUESTRAS = 0.5;

/** Lado mínimo del rostro, en proporción del alto del video. Filtra a quien
 * pasa de fondo y a quien está demasiado lejos para dar un descriptor útil. */
export const PROPORCION_MINIMA_ROSTRO = 0.25;

/** Grados de giro tolerados en cada eje al enrolar. Deja lugar a los giros
 * que la pantalla va pidiendo, sin llegar al perfil, donde el descriptor
 * pierde la mitad de la cara. */
export const GIRO_MAXIMO_GRADOS = 25;

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
