import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // En desarrollo el service worker molesta más de lo que ayuda: cachea
  // respuestas viejas y confunde el diagnóstico. Se prueba en build.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg"],
  // Por defecto el indicador de desarrollo se planta abajo a la izquierda,
  // justo encima del "Cerrar sesión" de la barra lateral, y se lo come.
  devIndicators: {
    position: "bottom-right",
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    // Los comprobantes de licencia viajan por una Server Action, y el tope por
    // defecto es 1 MB: la foto de un certificado sacada con un celular lo pasa
    // sola. Son hasta 3 archivos de 5 MB (ver TAMANIO_MAXIMO_COMPROBANTE),
    // más el resto del formulario.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default withSerwist(nextConfig);
