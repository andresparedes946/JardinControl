/**
 * Datos iniciales del jardín.
 *
 * Idempotente: se puede correr las veces que haga falta. Usa `upsert`, así
 * que no pisa las contraseñas ni los datos que ya se hayan cambiado desde
 * la aplicación, salvo los campos que se listan explícitamente en `update`.
 *
 * Uso:  npx prisma db seed
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

// ─────────────── Datos del jardín ───────────────

const CONFIGURACION = {
  nombreJardin: "Mundo Feliz",
  jardinLat: -34.8079767699953,
  jardinLng: -58.33154172578223,
  radioMetros: 50,
  // Con un radio de 50 m conviene exigir buena señal: aceptar lecturas de
  // ±100 m volvería la geocerca casi decorativa.
  precisionMaximaMetros: 40,
  umbralFacial: 0.4,
  umbralLiveness: 0.7,
  umbralAntispoof: 0.7,
  diasLaborales: [1, 2, 3, 4, 5],
  zonaHoraria: "America/Argentina/Buenos_Aires",
};

const HORARIOS = [
  { turno: "MANANA" as const, horaInicio: "08:00", horaFin: "12:00", toleranciaMinutos: 10 },
  { turno: "TARDE" as const, horaInicio: "13:00", horaFin: "17:00", toleranciaMinutos: 10 },
  { turno: "DOBLE" as const, horaInicio: "08:00", horaFin: "17:00", toleranciaMinutos: 10 },
];

const SALAS = [
  { nombre: "Lactario", color: "#f472b6" },
  { nombre: "Sala de 2", color: "#facc15" },
  { nombre: "Sala de 3", color: "#4ade80" },
  { nombre: "Sala de 4", color: "#38bdf8" },
  { nombre: "Sala de 5", color: "#a78bfa" },
];

const ADMIN = {
  nombre: "Sandra",
  apellido: "",
  email: "corbalangiuliana11@gmail.com",
};

/** Maestras de arranque. La dirección después las edita y da de alta más. */
const MAESTRAS = [
  {
    nombre: "Maestra",
    apellido: "Uno",
    email: "maestra1@jardincontrol.local",
    dni: "30000001",
    legajo: "M-001",
    cargo: "Maestra de sala",
    turno: "MANANA" as const,
    sala: "Sala de 3",
    valorHora: 3500,
  },
  {
    nombre: "Maestra",
    apellido: "Dos",
    email: "maestra2@jardincontrol.local",
    dni: "30000002",
    legajo: "M-002",
    cargo: "Maestra de sala",
    turno: "TARDE" as const,
    sala: "Sala de 4",
    valorHora: 3500,
  },
  {
    nombre: "Maestra",
    apellido: "Tres",
    email: "maestra3@jardincontrol.local",
    dni: "30000003",
    legajo: "M-003",
    cargo: "Maestra de sala",
    turno: "DOBLE" as const,
    sala: "Sala de 5",
    valorHora: 3800,
  },
];

/**
 * Contraseñas provisionales. Se pueden fijar por entorno para no dejar
 * valores conocidos en una base real.
 */
const PASSWORD_ADMIN = process.env.SEED_PASSWORD_ADMIN ?? "Cambiar.2026";
const PASSWORD_MAESTRAS = process.env.SEED_PASSWORD_MAESTRAS ?? "Cambiar.2026";

// ─────────────── Ejecución ───────────────

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta DIRECT_URL (o DATABASE_URL) para correr el seed.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Configuración (fila única, id = 1)
  await prisma.configuracion.upsert({
    where: { id: 1 },
    create: { id: 1, ...CONFIGURACION },
    update: CONFIGURACION,
  });
  console.log(
    `✔ Configuración: radio ${CONFIGURACION.radioMetros} m sobre ` +
      `${CONFIGURACION.jardinLat}, ${CONFIGURACION.jardinLng}`,
  );

  for (const horario of HORARIOS) {
    await prisma.horario.upsert({
      where: { turno: horario.turno },
      create: horario,
      update: horario,
    });
  }
  console.log(`✔ Horarios: ${HORARIOS.map((h) => h.turno).join(", ")}`);

  const salas = new Map<string, string>();
  for (const sala of SALAS) {
    const creada = await prisma.sala.upsert({
      where: { nombre: sala.nombre },
      create: sala,
      update: { color: sala.color },
    });
    salas.set(creada.nombre, creada.id);
  }
  console.log(`✔ Salas: ${SALAS.length}`);

  // Administradora. `update` no toca la contraseña: si ya la cambió, se
  // respeta; solo se crea con la provisional la primera vez.
  const hashAdmin = await hash(PASSWORD_ADMIN, 10);
  await prisma.usuario.upsert({
    where: { email: ADMIN.email },
    create: {
      ...ADMIN,
      email: ADMIN.email.toLowerCase(),
      password: hashAdmin,
      rol: "ADMIN",
    },
    update: { nombre: ADMIN.nombre, rol: "ADMIN", activo: true },
  });
  console.log(`✔ Administradora: ${ADMIN.email}`);

  const hashMaestras = await hash(PASSWORD_MAESTRAS, 10);
  for (const m of MAESTRAS) {
    const usuario = await prisma.usuario.upsert({
      where: { email: m.email },
      create: {
        nombre: m.nombre,
        apellido: m.apellido,
        email: m.email.toLowerCase(),
        password: hashMaestras,
        rol: "EMPLEADO",
      },
      update: { nombre: m.nombre, apellido: m.apellido },
    });

    await prisma.empleado.upsert({
      where: { usuarioId: usuario.id },
      create: {
        usuarioId: usuario.id,
        dni: m.dni,
        legajo: m.legajo,
        cargo: m.cargo,
        turno: m.turno,
        salaId: salas.get(m.sala),
        valorHora: m.valorHora,
      },
      update: {
        cargo: m.cargo,
        turno: m.turno,
        salaId: salas.get(m.sala),
      },
    });
  }
  console.log(`✔ Maestras: ${MAESTRAS.length}`);

  console.log("\nContraseñas provisionales:");
  console.log(`  ${ADMIN.email} → ${PASSWORD_ADMIN}`);
  console.log(`  maestra1..3@jardincontrol.local → ${PASSWORD_MAESTRAS}`);
  console.log("\nCambiarlas en el primer ingreso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
