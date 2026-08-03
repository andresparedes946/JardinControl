import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sesionDeApi } from "@/lib/session";
import { urlFirmadaComprobante } from "@/lib/supabase";

/**
 * Abre un comprobante de licencia.
 *
 * Es una ruta y no una Server Action porque así el navegador lo abre con un
 * `<a href target="_blank">` común: pedir la URL firmada con una acción y
 * después llamar a `window.open` cae en el bloqueador de pop-ups, que corta
 * cualquier ventana abierta después de un `await`.
 *
 * El bucket es privado, así que lo que se entrega es una redirección a una
 * URL firmada de un minuto. Puede verla quien tiene la licencia y la
 * dirección; nadie más, ni siquiera con el id en la mano.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await sesionDeApi();
  if (!sesion) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  const { id } = await params;

  const comprobante = await prisma.comprobante.findUnique({
    where: { id },
    select: { path: true, licencia: { select: { empleadoId: true } } },
  });

  // Un comprobante ajeno responde 404 y no 403: confirmar que existe ya sería
  // decir que esa empleada tiene una licencia cargada.
  const propio = sesion.user.empleadoId === comprobante?.licencia.empleadoId;
  const puede = sesion.user.rol === "ADMIN" || propio;

  if (!comprobante || !puede) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  try {
    const url = await urlFirmadaComprobante(comprobante.path, 60);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("abrir comprobante:", error);
    return NextResponse.json(
      { error: "No se pudo abrir el comprobante" },
      { status: 502 },
    );
  }
}
