/**
 * Mide los enrolamientos faciales guardados. Uso: npm run rostros
 *
 * Sirve para calibrar los umbrales con datos y no a ojo. Los dos números que
 * importan son la similitud de una persona consigo misma (cuánto tiene que
 * tolerar el sistema) y el máximo cruzado entre personas distintas (a partir
 * de dónde empieza a confundirlas). El umbral vive entre esos dos.
 *
 * No imprime ningún descriptor: solo estadísticas.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { similitud } from "../src/lib/rostro";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const r2 = (n: number) => n.toFixed(2);

async function main() {
  const empleados = await prisma.empleado.findMany({
    include: {
      usuario: { select: { nombre: true, apellido: true } },
      descriptores: { orderBy: { createdAt: "asc" } },
    },
  });

  const enrolados = empleados.filter((e) => e.descriptores.length > 0);

  for (const e of enrolados) {
    const ds = e.descriptores;
    const calidades = ds.map((d) => d.calidad ?? 0);
    const distintos = new Set(ds.map((d) => d.descriptor.join(","))).size;

    const vsPrimera = ds
      .slice(1)
      .map((d) => similitud(ds[0].descriptor, d.descriptor));

    let peorPar = 1;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        peorPar = Math.min(peorPar, similitud(ds[i].descriptor, ds[j].descriptor));
      }
    }

    console.log(`\n${e.usuario.nombre} ${e.usuario.apellido}`);
    console.log(`  guardado: ${ds[0].createdAt.toISOString()}`);
    console.log(`  muestras: ${ds.length}, distintas: ${distintos}`);
    console.log(
      `  calidad: ${r2(Math.min(...calidades))} a ${r2(Math.max(...calidades))}`,
    );
    console.log(
      `  vs primera: ${r2(Math.min(...vsPrimera))} a ${r2(Math.max(...vsPrimera))}`,
    );
    console.log(`  peor par interno: ${r2(peorPar)}`);
  }

  // El numero que decide el umbral del fichaje: al fichar se compara una
  // captura nueva contra TODAS las muestras de una persona y se toma la mejor.
  // Asi que el riesgo de falso positivo es el maximo cruzado, no el promedio.
  console.log("\n=== separacion entre personas ===");
  for (let a = 0; a < enrolados.length; a++) {
    for (let b = a + 1; b < enrolados.length; b++) {
      const A = enrolados[a];
      const B = enrolados[b];

      let max = 0;
      let suma = 0;
      let n = 0;
      for (const da of A.descriptores) {
        for (const db of B.descriptores) {
          const s = similitud(da.descriptor, db.descriptor);
          if (s > max) max = s;
          suma += s;
          n++;
        }
      }

      console.log(
        `${A.usuario.nombre} ${A.usuario.apellido} vs ${B.usuario.nombre} ${B.usuario.apellido}`,
      );
      console.log(`  maximo cruzado: ${r2(max)}   promedio: ${r2(suma / n)}`);
    }
  }

  const config = await prisma.configuracion.findUnique({ where: { id: 1 } });
  console.log(`\nsimilitudMinima configurada: ${config?.similitudMinima}`);

  await prisma.$disconnect();
}

main();
