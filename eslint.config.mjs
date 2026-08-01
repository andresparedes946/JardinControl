import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Código generado: el service worker que empaqueta Serwist y el
      // cliente de Prisma. Ninguno se edita a mano, y sus 86 avisos tapaban
      // los problemas reales del código propio.
      "public/sw.js",
      "public/swe-worker-*.js",
      "src/generated/**",
    ],
  },
];

export default eslintConfig;
