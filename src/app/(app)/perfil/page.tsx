import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requerirSesion } from "@/lib/session";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function PerfilPage() {
  const { user } = await requerirSesion();

  const datos = [
    { etiqueta: "Nombre", valor: user.name ?? "—" },
    { etiqueta: "Email", valor: user.email ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tus datos de acceso al sistema.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Cuenta
            <Badge variant="secondary">
              {user.rol === "ADMIN" ? "Administradora" : "Empleada"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Para cambiar estos datos, pedíselo a la dirección.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {datos.map(({ etiqueta, valor }) => (
              <div
                key={etiqueta}
                className="flex justify-between gap-4 py-2 text-sm first:pt-0 last:pb-0"
              >
                <dt className="text-muted-foreground">{etiqueta}</dt>
                <dd className="truncate font-medium">{valor}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
