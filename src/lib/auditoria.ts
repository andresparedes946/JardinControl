import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

/**
 * Registro de auditoría.
 *
 * La pantalla para consultarlo llega en la Fase 8, pero las escrituras se
 * instrumentan desde ahora: agregarlas mientras se escribe cada mutación
 * cuesta una línea, y hacerlo después obliga a repasar todas de nuevo.
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
