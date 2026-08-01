/**
 * Genera los íconos de la PWA a partir de un SVG.
 * Uso: node scripts/generar-iconos.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconos = join(raiz, "public", "icons");

const FONDO = "#0f172a";
const ACENTO = "#38bdf8";

/** `escala` = proporción del lienzo ocupada por el dibujo. */
const svg = (size, escala) => {
  const c = size / 2;
  const r = (size * escala) / 2;
  const grosor = r * 0.13;
  const p1 = [c - r * 0.42, c + r * 0.02];
  const p2 = [c - r * 0.12, c + r * 0.34];
  const p3 = [c + r * 0.45, c - r * 0.35];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${FONDO}"/>
  <circle cx="${c}" cy="${c}" r="${r - grosor / 2}" fill="none" stroke="${ACENTO}" stroke-width="${grosor}"/>
  <path d="M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]}"
        fill="none" stroke="#ffffff" stroke-width="${grosor}"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
};

const salidas = [
  [join(iconos, "icon-192.png"), 192, 0.74],
  [join(iconos, "icon-512.png"), 512, 0.74],
  // Android recorta el maskable en un círculo: el dibujo va más chico para
  // quedar dentro de la zona segura.
  [join(iconos, "icon-maskable-512.png"), 512, 0.56],
  [join(raiz, "src", "app", "apple-icon.png"), 180, 0.74],
  [join(raiz, "src", "app", "icon.png"), 64, 0.8],
];

for (const [ruta, size, escala] of salidas) {
  const png = await sharp(Buffer.from(svg(size, escala))).png().toBuffer();
  writeFileSync(ruta, png);
  console.log(`${ruta.replace(raiz, ".")}  ${size}px  ${png.length} bytes`);
}
