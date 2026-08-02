import type { Config, Human } from "@vladmandic/human";

/**
 * Carga de Human en el navegador.
 *
 * La librería pesa varios megabytes entre código y modelos, así que se
 * importa recién cuando alguien abre la cámara y no al cargar la app. El
 * resultado se guarda en un módulo: si se vuelve a entrar a la pantalla, los
 * modelos ya están en memoria.
 */

/**
 * Todo lo que no sea el rostro va apagado: cada modelo activo es un archivo
 * más para bajar y milisegundos por frame que no se recuperan.
 */
const CONFIG: Partial<Config> = {
  // Servidos desde el propio origen (npm run modelos). El CDN del autor
  // dejaría el fichaje atado a la conexión y a un tercero.
  modelBasePath: "/models/",
  // Guarda los modelos en IndexedDB: la segunda vez arrancan sin red.
  cacheModels: true,
  // humangl es el WebGL propio de Human, con los ajustes que necesitan sus
  // modelos. Si el dispositivo no lo soporta, la librería cae sola a wasm.
  backend: "humangl",
  // El log de Human es ruidoso y en producción no aporta nada.
  debug: false,
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 2, return: false },
    mesh: { enabled: true },
    description: { enabled: true },
    // Antispoof rechaza la foto de una foto; liveness, un video grabado.
    // Los dos hacen falta cuando se ficha desde el celular personal.
    antispoof: { enabled: true },
    liveness: { enabled: true },
    iris: { enabled: false },
    emotion: { enabled: false },
    attention: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
  filter: { enabled: true, equalization: false },
};

let instancia: Promise<Human> | null = null;

/**
 * Devuelve la instancia de Human con los modelos ya cargados. Las llamadas
 * simultáneas comparten la misma carga.
 */
export function cargarHuman(): Promise<Human> {
  instancia ??= (async () => {
    // `dist/human.esm.js` trae TensorFlow.js adentro y es solo para el
    // navegador: importarlo arriba lo metería en el bundle del servidor.
    const { Human: ClaseHuman } = await import("@vladmandic/human");

    const human = new ClaseHuman(CONFIG);
    await human.load();
    // Compila los shaders con un tensor vacío. Sin esto, la primera
    // detección real tarda varios segundos y parece que se colgó.
    await human.warmup();

    return human;
  })().catch((error) => {
    // Un fallo de red no puede dejar la promesa rota para siempre: se limpia
    // para que el siguiente intento vuelva a probar.
    instancia = null;
    throw error;
  });

  return instancia;
}
