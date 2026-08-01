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
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default withSerwist(nextConfig);
