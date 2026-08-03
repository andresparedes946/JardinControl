import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { FiltrosEmpleados } from "@/lib/validaciones";

export const EMPLEADOS_POR_PAGINA = 10;

/**
 * Listado de empleadas con búsqueda, filtros y paginación.
 *
 * La búsqueda cubre nombre, apellido, email, DNI y legajo, que es lo que
 * una directora tiene a mano cuando busca a alguien.
 */
export async function listarEmpleados(filtros: FiltrosEmpleados) {
  const where: Prisma.EmpleadoWhereInput = {};

  if (filtros.q) {
    const q = filtros.q;
    where.OR = [
      { usuario: { nombre: { contains: q, mode: "insensitive" } } },
      { usuario: { apellido: { contains: q, mode: "insensitive" } } },
      { usuario: { email: { contains: q, mode: "insensitive" } } },
      { dni: { contains: q } },
      { legajo: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filtros.sala) where.salaId = filtros.sala;
  if (filtros.turno) where.turno = filtros.turno;
  if (filtros.estado) where.estado = filtros.estado;

  // El total se cuenta primero para poder acotar la página pedida. Sin esto,
  // un ?pagina=999 escrito a mano devolvería cero filas y un rango absurdo
  // ("mostrando 9981–4 de 4") en vez de la última página real.
  const total = await prisma.empleado.count({ where });
  const paginas = Math.max(1, Math.ceil(total / EMPLEADOS_POR_PAGINA));
  const pagina = Math.min(Math.max(1, filtros.pagina), paginas);

  const empleados = await prisma.empleado.findMany({
    where,
    include: {
      usuario: {
        select: { nombre: true, apellido: true, email: true, activo: true },
      },
      sala: { select: { nombre: true, color: true } },
      _count: { select: { descriptores: { where: { activo: true } } } },
    },
    orderBy: [{ usuario: { apellido: "asc" } }, { usuario: { nombre: "asc" } }],
    skip: (pagina - 1) * EMPLEADOS_POR_PAGINA,
    take: EMPLEADOS_POR_PAGINA,
  });

  return { empleados, total, paginas, pagina };
}

export type EmpleadoDeLista = Awaited<
  ReturnType<typeof listarEmpleados>
>["empleados"][number];

export async function obtenerEmpleado(id: string) {
  return prisma.empleado.findUnique({
    where: { id },
    include: {
      usuario: {
        select: { id: true, nombre: true, apellido: true, email: true },
      },
    },
  });
}

/**
 * Estado del enrolamiento facial: cuántas muestras vigentes hay y de cuándo.
 * Devuelve null si nunca se enroló, que es lo que impide fichar.
 */
export async function obtenerEnrolamiento(empleadoId: string) {
  const [muestras, ultima] = await Promise.all([
    prisma.descriptorFacial.count({ where: { empleadoId, activo: true } }),
    prisma.descriptorFacial.findFirst({
      where: { empleadoId, activo: true },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return ultima ? { muestras, fecha: ultima.createdAt } : null;
}

/** Lista breve para poblar selectores de filtro. */
export async function listarEmpleadosParaSelector() {
  const empleados = await prisma.empleado.findMany({
    select: {
      id: true,
      usuario: { select: { nombre: true, apellido: true } },
    },
    orderBy: [{ usuario: { apellido: "asc" } }, { usuario: { nombre: "asc" } }],
  });

  return empleados.map((e) => ({
    id: e.id,
    nombre: `${e.usuario.apellido}, ${e.usuario.nombre}`,
  }));
}

export async function listarSalas() {
  return prisma.sala.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { empleados: true } } },
  });
}

/** Fila única de configuración. Falla fuerte si falta: sin ella no hay geocerca. */
export async function obtenerConfiguracion() {
  const config = await prisma.configuracion.findUnique({ where: { id: 1 } });

  if (!config) {
    throw new Error(
      "No hay configuración cargada. Corré `npm run db:seed` para inicializarla.",
    );
  }

  return config;
}

export async function listarHorarios() {
  return prisma.horario.findMany({ orderBy: { turno: "asc" } });
}
