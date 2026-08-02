/**
 * Descarga los modelos de @vladmandic/human a public/models.
 * Uso: node scripts/descargar-modelos.mjs
 *
 * Human por defecto los baja del CDN del autor en cada carga. Acá se sirven
 * desde el mismo origen por tres motivos: el fichaje tiene que funcionar con
 * la conexión del jardín, la PWA los puede cachear para trabajar offline, y
 * un modelo servido por un tercero es un tercero que puede decidir qué rostro
 * reconoce el sistema.
 *
 * Es idempotente: lo ya descargado con el mismo tamaño no se vuelve a pedir.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://vladmandic.github.io/human-models/models/";

/** Solo los del pipeline facial: nada de cuerpo, manos ni objetos. */
const MODELOS = [
  ["blazeface.json", "detección del rostro"],
  ["facemesh.json", "malla facial (encuadre y rotación)"],
  ["faceres.json", "descriptor biométrico"],
  ["antispoof.json", "detección de foto de foto"],
  ["liveness.json", "prueba de vida"],
];

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "public", "models");

mkdirSync(destino, { recursive: true });

async function bajar(nombre) {
  const ruta = join(destino, nombre);

  const respuesta = await fetch(BASE + nombre);
  if (!respuesta.ok) {
    throw new Error(`${nombre}: HTTP ${respuesta.status} ${respuesta.statusText}`);
  }

  const bytes = Buffer.from(await respuesta.arrayBuffer());

  // Se compara el contenido, no solo la existencia: un archivo cortado por
  // una descarga interrumpida existe igual y después falla al cargar el modelo.
  if (existsSync(ruta) && statSync(ruta).size === bytes.length) {
    const previo = createHash("sha256").update(readFileSync(ruta)).digest("hex");
    if (previo === createHash("sha256").update(bytes).digest("hex")) {
      return { nombre, bytes: bytes.length, nuevo: false, contenido: bytes };
    }
  }

  writeFileSync(ruta, bytes);
  return { nombre, bytes: bytes.length, nuevo: true, contenido: bytes };
}

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;

let total = 0;
let descargados = 0;

for (const [json, para] of MODELOS) {
  console.log(`\n${json.replace(".json", "")} — ${para}`);

  const manifiesto = await bajar(json);
  total += manifiesto.bytes;
  if (manifiesto.nuevo) descargados += 1;
  console.log(`  ${manifiesto.nombre.padEnd(28)} ${kb(manifiesto.bytes).padStart(9)}${manifiesto.nuevo ? "" : "  (ya estaba)"}`);

  // Los pesos no se nombran por convención: el .json declara sus archivos en
  // weightsManifest, y algunos modelos los parten en varios.
  const { weightsManifest = [] } = JSON.parse(manifiesto.contenido.toString());
  const pesos = weightsManifest.flatMap((grupo) => grupo.paths ?? []);

  for (const peso of pesos) {
    const bin = await bajar(peso);
    total += bin.bytes;
    if (bin.nuevo) descargados += 1;
    console.log(`  ${bin.nombre.padEnd(28)} ${kb(bin.bytes).padStart(9)}${bin.nuevo ? "" : "  (ya estaba)"}`);
  }
}

console.log(
  `\nListo: ${descargados} archivo(s) descargado(s), ${kb(total)} en total en public/models.`,
);
