import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";

import { RegenerarCodigo } from "@/components/codigo/panel-codigo";
import { Card, CardContent } from "@/components/ui/card";
import { obtenerConfiguracion } from "@/lib/empleados";
import { tokenVigente, urlDeFichaje } from "@/lib/fichaje-qr";
import { requerirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Código de fichaje" };

// El token se genera al abrir la pantalla si el del día todavía no existe,
// así que esta página escribe y no se puede cachear.
export const dynamic = "force-dynamic";

export default async function CodigoPage() {
  await requerirAdmin();

  const config = await obtenerConfiguracion();
  const token = await tokenVigente(config.zonaHoraria);

  // El origen sale de la request y no de una variable de entorno: así el QR
  // funciona igual en localhost, en la IP de la LAN y en el dominio de
  // producción, sin que nadie tenga que acordarse de configurarlo.
  const cabeceras = await headers();
  const host = cabeceras.get("host") ?? "localhost:3000";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? "http";
  const url = urlDeFichaje(`${protocolo}://${host}`, token);

  // SVG y no PNG: escala sin pixelarse, que es justo lo que hace falta cuando
  // esto se proyecta o se imprime en una hoja A4 para pegar en la puerta.
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Código de fichaje
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cada maestra lo escanea con la cámara de su celular para registrar
            entrada y salida.
          </p>
        </div>
        <RegenerarCodigo />
      </div>

      <Card className="no-imprimir-borde">
        <CardContent className="flex flex-col items-center gap-6 py-8">
          {/* Fondo blanco fijo: en tema oscuro un QR con los colores
              invertidos no lo lee la mitad de los teléfonos. */}
          <div
            className="w-full max-w-xs rounded-xl bg-white p-4 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <div className="text-center">
            <p className="font-medium">Válido solo hoy</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Mañana se renueva solo. Si alguien le sacó una foto, generá uno
              nuevo y el anterior deja de servir.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-muted-foreground space-y-2 py-5 text-sm">
          <p className="text-foreground font-medium">Cómo se usa</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Imprimí esta pantalla o dejala abierta en la entrada.</li>
            <li>La maestra apunta la cámara del celular al código.</li>
            <li>Escribe su DNI y su PIN, y confirma.</li>
          </ol>
          <p className="pt-1">
            El fichaje solo se acepta dentro del radio del jardín, así que
            escanear el código desde afuera no alcanza.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
