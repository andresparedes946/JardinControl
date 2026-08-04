import { QrCode } from "lucide-react";
import type { Metadata } from "next";

import { FormularioQr } from "@/components/fichar/formulario-qr";
import { Card, CardContent } from "@/components/ui/card";
import { obtenerConfiguracion } from "@/lib/empleados";
import { tokenEsValido } from "@/lib/fichaje-qr";

export const metadata: Metadata = { title: "Fichar" };

// El código vence por día, así que esta página no se puede cachear: una
// versión guardada dejaría entrar con el token de ayer.
export const dynamic = "force-dynamic";

export default async function FicharPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const config = await obtenerConfiguracion();
  const valido = await tokenEsValido(token, config.zonaHoraria);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {config.nombreJardin}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Registrá tu entrada o tu salida.
        </p>
      </div>

      <Card>
        <CardContent className="py-6">
          {valido ? (
            <FormularioQr token={token} />
          ) : (
            <div className="space-y-3 text-center">
              <div className="bg-muted mx-auto w-fit rounded-full p-3">
                <QrCode className="text-muted-foreground size-6" aria-hidden />
              </div>
              <div>
                <p className="font-medium">Este código ya no sirve</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Los códigos valen un solo día. Escaneá el que está en la
                  entrada del jardín, o pedíselo a la dirección.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
