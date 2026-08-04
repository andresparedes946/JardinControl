/**
 * Muestra los ultimos intentos de fichaje. Uso: npm run fichajes
 *
 * Existe porque la pantalla solo dice si se pudo fichar o no, y para calibrar
 * hace falta ver los numeros que hubo detras: cuanto se parecio el rostro,
 * que dijeron antispoof y liveness, a que distancia estaba y con cuanta
 * precision lo midio el telefono. Los rechazos son los que mas informan.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CUANTOS = Number(process.argv[2] ?? 20);

const n = (v: number | null, dec = 2) => (v == null ? "—" : v.toFixed(dec));

async function main() {
  const fichajes = await prisma.fichaje.findMany({
    orderBy: { timestamp: "desc" },
    take: CUANTOS,
    include: {
      empleado: {
        select: { usuario: { select: { nombre: true, apellido: true } } },
      },
    },
  });

  if (fichajes.length === 0) {
    console.log("Todavia no hay ningun intento de fichaje.");
    await prisma.$disconnect();
    return;
  }

  for (const f of fichajes) {
    const quien = `${f.empleado.usuario.nombre} ${f.empleado.usuario.apellido}`;
    console.log(`\n${f.timestamp.toISOString()}  ${quien}`);
    console.log(`  ${f.tipo} → ${f.resultado}`);
    console.log(
      `  rostro ${n(f.scoreFacial)}   antispoof ${n(f.scoreAntispoof)}   liveness ${n(f.scoreLiveness)}`,
    );
    console.log(
      `  distancia ${n(f.distanciaMetros, 0)} m   precision GPS ±${n(f.precisionMetros, 0)} m`,
    );
    if (f.lat != null && f.lng != null) {
      console.log(`  coordenadas ${f.lat}, ${f.lng}`);
    }
    if (f.motivoRechazo) console.log(`  motivo: ${f.motivoRechazo}`);
  }

  const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
  console.log(
    `\ngeocerca: ${config?.radioMetros} m sobre ${config?.jardinLat}, ${config?.jardinLng}` +
      `  (precision maxima ±${config?.precisionMaximaMetros} m)`,
  );
  await prisma.$disconnect();
}

main();
