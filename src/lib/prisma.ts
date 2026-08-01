import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 exige un driver adapter: el motor Rust ya no corre en runtime.
// En runtime usamos la conexión POOLED de Supabase; las migraciones van por
// la directa (ver prisma.config.ts).
function crearCliente() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copiá .env.example a .env y completá la conexión de Supabase.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

// En desarrollo Next.js recarga los módulos en cada cambio; sin el singleton
// se abriría un pool nuevo por recarga hasta agotar las conexiones.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof crearCliente> | undefined;
};

export const prisma = globalForPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
