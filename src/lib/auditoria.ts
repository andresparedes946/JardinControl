import "server-only";

import { headers } from "next/headers";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  diaLocal,
  periodoDe,
  periodoSiguiente,
  rangoDelPeriodoEnInstantes,
} from "@/lib/time";
import type { FiltrosAuditoria } from "@/lib/validaciones";

/**
 * Registro de auditoría: escrituras y consulta.
 *
 * Las escrituras se instrumentan desde la Fase 1 y la pantalla llega en la
 * Fase 9. Fue a propósito: agregar la línea mientras se escribe cada mutación
 * cuesta nada, y hacerlo después obliga a repasarlas todas de nuevo.
 *
 * Nunca hace fallar la operación que audita: si el registro falla, se avisa
 * por consola y la acción del usuario sigue su curso.
 */
export async function registrarAuditoria(entrada: {
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  detalle?: Record<string, unknown>;
}) {
  try {
    const cabeceras = await headers();
    const userAgent = cabeceras.get("user-agent");

    await prisma.auditoria.create({
      data: {
        usuarioId: entrada.usuarioId,
        accion: entrada.accion,
        entidad: entrada.entidad,
        entidadId: entrada.entidadId ?? null,
        detalle: entrada.detalle
          ? JSON.parse(JSON.stringify(entrada.detalle))
          : undefined,
        // x-forwarded-for puede traer varias IPs encadenadas; la primera es
        // la del cliente.
        ip:
          cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          cabeceras.get("x-real-ip"),
        userAgent,
        navegador: detectarNavegador(userAgent),
        dispositivo: detectarDispositivo(userAgent),
      },
    });
  } catch (error) {
    console.error("No se pudo registrar la auditoría:", error);
  }
}

export const AUDITORIA_POR_PAGINA = 25;

export type FilaAuditoria = {
  id: string;
  dia: string;
  hora: string;
  usuario: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle: string | null;
  ip: string | null;
  navegador: string | null;
  dispositivo: string | null;
  sistemaOperativo: string | null;
};

/**
 * Listado del registro, del más reciente al más viejo.
 *
 * Se pagina y no se acumula en scroll infinito porque una auditoría se lee
 * buscando algo puntual —quién tocó tal cosa, qué pasó tal día— y para eso el
 * filtro sirve más que el volumen.
 */
export async function listarAuditoria(
  filtros: FiltrosAuditoria,
  zonaHoraria: string,
) {
  const where: Prisma.AuditoriaWhereInput = {};

  const rango = rangoDelPeriodoEnInstantes(filtros.periodo, zonaHoraria);
  if (rango) where.fecha = { gte: rango.desde, lt: rango.hasta };

  if (filtros.usuario) where.usuarioId = filtros.usuario;
  if (filtros.accion) where.accion = filtros.accion;
  if (filtros.entidad) where.entidad = filtros.entidad;

  // Igual que en empleados: el total se cuenta primero para acotar la página
  // pedida y que un ?pagina=999 escrito a mano caiga en la última real.
  const total = await prisma.auditoria.count({ where });
  const paginas = Math.max(1, Math.ceil(total / AUDITORIA_POR_PAGINA));
  const pagina = Math.min(Math.max(1, filtros.pagina), paginas);

  const crudas = await prisma.auditoria.findMany({
    where,
    include: { usuario: { select: { nombre: true, apellido: true } } },
    orderBy: { fecha: "desc" },
    skip: (pagina - 1) * AUDITORIA_POR_PAGINA,
    take: AUDITORIA_POR_PAGINA,
  });

  return {
    filas: crudas.map((a) => aFila(a, zonaHoraria)),
    total,
    paginas,
    pagina,
  };
}

type AuditoriaCruda = Prisma.AuditoriaGetPayload<{
  include: { usuario: { select: { nombre: true; apellido: true } } };
}>;

function aFila(a: AuditoriaCruda, zonaHoraria: string): FilaAuditoria {
  // El día se arma a mano y no con Intl: pedirle día y mes en dos dígitos a
  // `es-AR` devuelve igual "3/8", y una columna de fechas sin alinear se lee
  // peor que una con ceros de más.
  const dia = diaLocal(a.fecha, zonaHoraria);

  return {
    id: a.id,
    dia: `${String(dia.getUTCDate()).padStart(2, "0")}/${String(dia.getUTCMonth() + 1).padStart(2, "0")}`,
    // Con segundos: dos correcciones seguidas sobre la misma jornada se
    // distinguen por el segundo, y el orden importa para entender qué quedó.
    hora: new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: zonaHoraria,
    }).format(a.fecha),
    // Puede no haber usuario: la relación es SetNull, así que borrar una
    // cuenta deja su rastro sin nombre en vez de borrarlo.
    usuario: a.usuario ? `${a.usuario.apellido}, ${a.usuario.nombre}` : null,
    accion: a.accion,
    entidad: a.entidad,
    entidadId: a.entidadId,
    detalle: resumirDetalle(a.detalle),
    ip: a.ip,
    navegador: a.navegador,
    dispositivo: a.dispositivo,
    sistemaOperativo: detectarSistemaOperativo(a.userAgent),
  };
}

/** El JSON de `detalle` como una línea legible: "legajo: 12 · email: a@b.com". */
function resumirDetalle(detalle: Prisma.JsonValue): string | null {
  if (!detalle || typeof detalle !== "object" || Array.isArray(detalle)) {
    return null;
  }

  const partes = Object.entries(detalle).map(
    ([clave, valor]) => `${clave}: ${valorLegible(valor)}`,
  );

  return partes.length > 0 ? partes.join(" · ") : null;
}

function valorLegible(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (Array.isArray(valor)) return valor.join(", ");
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

/** Los meses que abarca el registro, para poblar el selector. */
export async function periodosConAuditoria(
  zonaHoraria: string,
): Promise<string[]> {
  // Se enumeran los meses desde el primer registro en vez de leer la tabla
  // entera como hace `periodosConDatos`: la auditoría suma una fila por cada
  // acción del sistema y no hace falta traerla toda para saber desde cuándo hay.
  const primera = await prisma.auditoria.findFirst({
    orderBy: { fecha: "asc" },
    select: { fecha: true },
  });

  const actual = periodoDe(new Date(), zonaHoraria);
  const periodos = new Set<string>([actual]);
  if (!primera) return [actual];

  let p = periodoDe(primera.fecha, zonaHoraria);
  // Tope defensivo: si un reloj desfasado dejara una fila en el futuro, el
  // bucle no tiene que quedarse girando.
  for (let i = 0; p <= actual && i < 600; i++) {
    periodos.add(p);
    p = periodoSiguiente(p);
  }

  return [...periodos].sort().reverse();
}

/** Los usuarios que aparecen en el registro, para poblar el filtro. */
export async function usuariosConAuditoria() {
  const filas = await prisma.auditoria.findMany({
    where: { usuarioId: { not: null } },
    distinct: ["usuarioId"],
    select: { usuario: { select: { id: true, nombre: true, apellido: true } } },
  });

  return filas
    .map((f) => f.usuario)
    .filter((u) => u !== null)
    .map((u) => ({ id: u.id, nombre: `${u.apellido}, ${u.nombre}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function detectarNavegador(ua: string | null): string | null {
  if (!ua) return null;
  // El orden importa: Edge y Opera también dicen "Chrome" en su user-agent.
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Otro";
}

function detectarDispositivo(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Celular";
  return "Escritorio";
}

/**
 * Sistema operativo. A diferencia del navegador y del dispositivo no tiene
 * columna propia: se deriva al mostrar, del `user_agent` que ya está guardado.
 * Agregar la columna solo serviría de acá en adelante y dejaría en blanco todo
 * lo registrado desde la Fase 1, que es justamente lo que se va a consultar.
 */
export function detectarSistemaOperativo(ua: string | null): string | null {
  if (!ua) return null;
  // El orden importa: el user-agent de Android también dice "Linux", y el de
  // iPadOS 13 en adelante se anuncia como "Macintosh".
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Otro";
}
