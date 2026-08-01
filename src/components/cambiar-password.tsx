"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { cambiarPassword } from "@/app/(app)/perfil/acciones";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambioPasswordSchema } from "@/lib/validaciones";

type Valores = z.infer<typeof cambioPasswordSchema>;

export function CambiarPassword() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(cambioPasswordSchema),
    defaultValues: { actual: "", nueva: "", repetir: "" },
  });

  async function onSubmit(datos: Valores) {
    const r = await cambiarPassword(datos);

    if (r.ok) {
      toast.success(r.mensaje);
      reset();
    } else {
      toast.error(r.error);
    }
  }

  const campos = [
    {
      id: "actual" as const,
      etiqueta: "Contraseña actual",
      autoComplete: "current-password",
    },
    {
      id: "nueva" as const,
      etiqueta: "Contraseña nueva",
      autoComplete: "new-password",
    },
    {
      id: "repetir" as const,
      etiqueta: "Repetir la nueva",
      autoComplete: "new-password",
    },
  ];

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Si todavía usás la que te dieron al darte de alta, cambiala ahora.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {campos.map(({ id, etiqueta, autoComplete }) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id}>{etiqueta}</Label>
              <Input
                id={id}
                type="password"
                autoComplete={autoComplete}
                aria-invalid={!!errors[id]}
                {...register(id)}
              />
              {errors[id] && (
                <p className="text-destructive text-sm">{errors[id]?.message}</p>
              )}
            </div>
          ))}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Cambiar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
