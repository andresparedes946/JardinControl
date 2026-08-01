import "dotenv/config";
import { defineConfig } from "prisma/config";

// El CLI de Prisma (migrate, studio, db push) debe hablar con la conexión
// DIRECTA de Supabase: el pooler en modo transaction no soporta las
// sentencias DDL ni los prepared statements que usan las migraciones.
// El runtime de la app, en cambio, usa la pooled (ver src/lib/prisma.ts).
const url = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url,
  },
});
