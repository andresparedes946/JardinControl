/**
 * Verifica la configuración de Supabase y crea lo que falte.
 *
 * - Valida que las variables de .env estén completas.
 * - Prueba las dos conexiones a Postgres (pooled y directa).
 * - Crea el bucket privado de comprobantes si no existe.
 *
 * No imprime ningún secreto: solo dice si funciona o no.
 *
 * Uso: npm run supabase:check
 */
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const PENDIENTE = "⬅ COMPLETAR";
let errores = 0;

const ok = (m) => console.log(`  ✔ ${m}`);
const mal = (m) => {
  console.log(`  ✘ ${m}`);
  errores++;
};

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.includes(PENDIENTE) || valor.includes("PROYECTO")) {
    mal(`${nombre} sin completar en .env`);
    return null;
  }
  return valor;
}

console.log("\nVariables de entorno");
const databaseUrl = requerida("DATABASE_URL");
const directUrl = requerida("DIRECT_URL");
const supabaseUrl = requerida("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = requerida("SUPABASE_SERVICE_ROLE_KEY");
requerida("AUTH_SECRET");

if (databaseUrl && !databaseUrl.includes("6543")) {
  mal("DATABASE_URL no apunta al puerto 6543: tiene que ser la pooled");
}
if (databaseUrl && !databaseUrl.includes("pgbouncer=true")) {
  mal("A DATABASE_URL le falta ?pgbouncer=true");
}
if (directUrl && directUrl.includes("6543")) {
  mal("DIRECT_URL apunta al 6543: tiene que ser la directa (5432)");
}
if (databaseUrl && databaseUrl.includes("[YOUR-PASSWORD]")) {
  mal("Falta reemplazar [YOUR-PASSWORD] en DATABASE_URL");
}
if (directUrl && directUrl.includes("[YOUR-PASSWORD]")) {
  mal("Falta reemplazar [YOUR-PASSWORD] en DIRECT_URL");
}
if (errores === 0) ok("todas presentes y con la forma esperada");

async function probarConexion(etiqueta, url) {
  if (!url) return;
  const cliente = new pg.Client({ connectionString: url });
  try {
    await cliente.connect();
    const { rows } = await cliente.query("select current_database() as db");
    ok(`${etiqueta}: conecta (base "${rows[0].db}")`);
  } catch (e) {
    mal(`${etiqueta}: ${e.message}`);
  } finally {
    await cliente.end().catch(() => {});
  }
}

console.log("\nConexión a Postgres");
await probarConexion("pooled (app)", databaseUrl);
await probarConexion("directa (migraciones)", directUrl);

console.log("\nStorage");
if (supabaseUrl && serviceKey) {
  const nombreBucket = process.env.SUPABASE_BUCKET_COMPROBANTES ?? "comprobantes";
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    mal(`no se pudo listar los buckets: ${error.message}`);
  } else {
    const existente = buckets.find((b) => b.name === nombreBucket);

    if (existente) {
      ok(
        `bucket "${nombreBucket}" ya existe (${existente.public ? "PÚBLICO ⚠" : "privado"})`,
      );
      if (existente.public) {
        mal(
          `"${nombreBucket}" es público: los certificados médicos quedarían accesibles por URL`,
        );
      }
    } else {
      const { error: errorCrear } = await supabase.storage.createBucket(
        nombreBucket,
        {
          public: false,
          fileSizeLimit: "10MB",
          allowedMimeTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
        },
      );

      if (errorCrear) mal(`no se pudo crear el bucket: ${errorCrear.message}`);
      else ok(`bucket "${nombreBucket}" creado (privado, máx. 10 MB)`);
    }
  }
} else {
  mal("sin URL o service_role key no se puede tocar Storage");
}

console.log("");
if (errores > 0) {
  console.log(`${errores} problema(s). Revisá .env y volvé a correr.\n`);
  process.exitCode = 1;
} else {
  console.log("Todo listo. Siguiente:  npm run db:migrate && npm run db:seed\n");
}
