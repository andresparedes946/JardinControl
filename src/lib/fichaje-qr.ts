import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { diaLocal } from "@/lib/time";

/**
 * Código QR de fichaje.
 *
 * Hay un solo token vigente por vez y vale el día en que se generó. Al día
 * siguiente deja de servir solo, sin que nadie tenga que acordarse de nada, y
 * la dirección puede regenerarlo cuando quiera —si alguien fotografió el
 * cartel, por ejemplo— con lo que el anterior muere en el acto.
 *
 * Es lo único que separa un fichaje hecho en la puerta del jardín de uno hecho
 * con una captura de pantalla de ayer. La otra mitad la pone la geocerca: el
 * token dice "hoy", el GPS dice "acá".
 */

/** 128 bits en base64url: entra cómodo en un QR y no se adivina. */
function nuevoToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * El token de hoy, generándolo si no hay ninguno o si el que hay es de otro
 * día. Lo llama la pantalla que muestra el QR, así que abrirla a la mañana ya
 * deja el código del día listo sin ningún paso extra.
 */
export async function tokenVigente(zonaHoraria: string): Promise<string> {
  const config = await prisma.configuracion.findUnique({
    where: { id: 1 },
    select: { tokenFichaje: true, tokenGeneradoEn: true },
  });

  if (
    config?.tokenFichaje &&
    config.tokenGeneradoEn &&
    esDeHoy(config.tokenGeneradoEn, zonaHoraria)
  ) {
    return config.tokenFichaje;
  }

  return regenerarToken();
}

/** Fuerza un token nuevo. El anterior deja de valer en el acto. */
export async function regenerarToken(): Promise<string> {
  const token = nuevoToken();

  await prisma.configuracion.update({
    where: { id: 1 },
    data: { tokenFichaje: token, tokenGeneradoEn: new Date() },
  });

  return token;
}

/**
 * Si el token que trae la URL es el vigente y es de hoy.
 *
 * La comparación es contra el token guardado y no contra una firma: al ser un
 * valor aleatorio de 128 bits que vive en la base, regenerarlo alcanza para
 * invalidar todo lo anterior. Con un token firmado habría que llevar además
 * una lista de revocados.
 */
export async function tokenEsValido(
  token: string,
  zonaHoraria: string,
): Promise<boolean> {
  if (!token) return false;

  const config = await prisma.configuracion.findUnique({
    where: { id: 1 },
    select: { tokenFichaje: true, tokenGeneradoEn: true },
  });

  if (!config?.tokenFichaje || !config.tokenGeneradoEn) return false;
  if (config.tokenFichaje !== token) return false;

  return esDeHoy(config.tokenGeneradoEn, zonaHoraria);
}

function esDeHoy(instante: Date, zonaHoraria: string): boolean {
  return (
    diaLocal(instante, zonaHoraria).getTime() ===
    diaLocal(new Date(), zonaHoraria).getTime()
  );
}

/** La URL que se codifica en el QR. */
export function urlDeFichaje(base: string, token: string): string {
  return `${base.replace(/\/$/, "")}/f/${token}`;
}
