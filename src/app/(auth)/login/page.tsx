import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

import { FormularioLogin } from "@/components/auth/formulario-login";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={56}
            height={56}
            className="rounded-xl"
            priority
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              JardinControl
            </h1>
            <p className="text-muted-foreground text-sm">
              Gestión de personal del jardín
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ingresar</CardTitle>
            <CardDescription>
              Usá el email y la contraseña que te dio la dirección.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-56 w-full" />}>
              <FormularioLogin />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
