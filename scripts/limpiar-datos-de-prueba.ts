/**
 * Borra los movimientos generados probando, para arrancar en el jardín con la
 * base vacía de historia pero con el padrón ya cargado.
 *
 * Se van:  fichajes, asistencias, licencias (con sus comprobantes, también los
 *          archivos del bucket), liquidaciones y auditoría.
 * Se quedan: usuarios, empleadas, rostros enrolados, salas, horarios, feriados
 *          y la configuración del jardín.
 *
 * Los rostros se conservan a propósito: enrolarlos cuesta diez capturas por
 * persona y el vector no es un dato de prueba, es la misma cara.
 *
 * Uso:  npm run limpiar -- --si
 *
 * Sin `--si` no borra nada: cuenta lo que hay y lo muestra. Es una operación
 * irreversible sobre la base de producción, así que el paso destructivo se
 * pide aparte y a mano.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CONFIRMADO = process.argv.includes("--si");

async function main() {
  const [fichajes, asistencias, licencias, comprobantes, liquidaciones, auditoria] =
    await Promise.all([
      prisma.fichaje.count(),
      prisma.asistencia.count(),
      prisma.licencia.count(),
      prisma.comprobante.count(),
      prisma.liquidacion.count(),
      prisma.auditoria.count(),
    ]);

  console.log("\nSe va a borrar:");
  console.log(`  fichajes        ${fichajes}`);
  console.log(`  asistencias     ${asistencias}`);
  console.log(`  licencias       ${licencias}`);
  console.log(`  comprobantes    ${comprobantes}`);
  console.log(`  liquidaciones   ${liquidaciones}`);
  console.log(`  auditoría       ${auditoria}`);

  const [empleados, conPin, salas] = await Promise.all([
    prisma.empleado.count(),
    prisma.empleado.count({ where: { pinFichaje: { not: null } } }),
    prisma.sala.count(),
  ]);

  console.log("\nSe conserva:");
  console.log(`  empleadas       ${empleados}`);
  console.log(`  con PIN         ${conPin}`);
  console.log(`  salas           ${salas}`);
  console.log(`  horarios, feriados y configuración del jardín`);

  if (!CONFIRMADO) {
    console.log("\nNada borrado. Para hacerlo de verdad:");
    console.log("  npm run limpiar -- --si\n");
    await prisma.$disconnect();
    return;
  }

  // Los archivos van antes que las filas: al revés se perderían los paths y
  // los certificados quedarían para siempre en el bucket sin nada que los
  // referencie.
  await borrarArchivosDeComprobantes();

  // El orden respeta las claves foráneas. `comprobantes` cae por cascada al
  // borrar la licencia, pero se borra explícito para que el conteo no mienta.
  const borrados = await prisma.$transaction([
    prisma.fichaje.deleteMany(),
    prisma.asistencia.deleteMany(),
    prisma.comprobante.deleteMany(),
    prisma.licencia.deleteMany(),
    prisma.liquidacion.deleteMany(),
    prisma.auditoria.deleteMany(),
  ]);

  const total = borrados.reduce((suma, r) => suma + r.count, 0);
  console.log(`\n✔ ${total} filas borradas.`);
  console.log("Revisá la geocerca en Configuración antes de usarlo.\n");

  await prisma.$disconnect();
}

async function borrarArchivosDeComprobantes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET_COMPROBANTES ?? "comprobantes";

  const paths = (
    await prisma.comprobante.findMany({ select: { path: true } })
  ).map((c) => c.path);

  if (paths.length === 0) return;

  if (!url || !serviceKey) {
    console.log(
      `\n⚠ Faltan las variables de Supabase: quedan ${paths.length} archivos en el bucket.`,
    );
    return;
  }

  const { error } = await createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
    .storage.from(bucket)
    .remove(paths);

  // No se corta: un archivo huérfano en un bucket privado es menos grave que
  // dejar la base a medio limpiar.
  if (error) console.log(`\n⚠ No se pudieron borrar los archivos: ${error.message}`);
  else console.log(`\n✔ ${paths.length} archivos borrados del bucket.`);
}

main();
