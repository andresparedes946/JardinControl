"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generarPasswordProvisional } from "@/lib/password";
import {
  ESTADOS_EMPLEADO,
  ETIQUETA_TURNO,
  TURNOS,
  empleadoSchema,
  nuevoEmpleadoSchema,
  type DatosEmpleado,
} from "@/lib/validaciones";

type Sala = { id: string; nombre: string };

/**
 * Alta y edición comparten formulario. La única diferencia real es la
 * contraseña provisional, que solo existe al dar de alta; de ahí que el
 * tipo del formulario sea el de empleado con `password` opcional.
 */
type ValoresFormulario = Omit<DatosEmpleado, "valorHora" | "salaId"> & {
  valorHora: number | string;
  salaId: string;
  password?: string;
};

type Props = {
  salas: Sala[];
  /** Sin `empleadoId` el formulario da de alta; con él, edita. */
  empleadoId?: string;
  valoresIniciales?: Partial<ValoresFormulario>;
  onGuardar: (datos: ValoresFormulario) => Promise<{
    ok: boolean;
    mensaje?: string;
    error?: string;
  }>;
};

const SIN_SALA = "sin-sala";

function Campo({
  id,
  etiqueta,
  error,
  children,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
  ayuda?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && (
        <p className="text-muted-foreground text-xs">{ayuda}</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

export function FormularioEmpleado({
  salas,
  empleadoId,
  valoresIniciales,
  onGuardar,
}: Props) {
  const router = useRouter();
  const esAlta = !empleadoId;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ValoresFormulario>({
    resolver: zodResolver(
      esAlta ? nuevoEmpleadoSchema : empleadoSchema,
    ) as Resolver<ValoresFormulario>,
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      dni: "",
      legajo: "",
      cargo: "Maestra de sala",
      turno: "MANANA",
      salaId: SIN_SALA,
      valorHora: 0,
      telefono: "",
      direccion: "",
      fechaNacimiento: "",
      estado: "ACTIVO",
      ...(esAlta ? { password: generarPasswordProvisional() } : {}),
      ...valoresIniciales,
    },
  });

  const password = watch("password");

  async function onSubmit(datos: ValoresFormulario) {
    const resultado = await onGuardar(datos);

    if (!resultado.ok) {
      toast.error(resultado.error ?? "No se pudo guardar");
      return;
    }

    toast.success(resultado.mensaje ?? "Guardado");
    router.push("/empleados");
    router.refresh();
  }

  const salasConVacio = [{ id: SIN_SALA, nombre: "Sin sala asignada" }, ...salas];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo id="nombre" etiqueta="Nombre" error={errors.nombre?.message}>
            <Input id="nombre" autoComplete="off" {...register("nombre")} />
          </Campo>

          <Campo
            id="apellido"
            etiqueta="Apellido"
            error={errors.apellido?.message}
          >
            <Input id="apellido" autoComplete="off" {...register("apellido")} />
          </Campo>

          <Campo id="dni" etiqueta="DNI" error={errors.dni?.message} ayuda="Sin puntos">
            <Input id="dni" inputMode="numeric" {...register("dni")} />
          </Campo>

          <Campo
            id="fechaNacimiento"
            etiqueta="Fecha de nacimiento"
            error={errors.fechaNacimiento?.message}
          >
            <Input
              id="fechaNacimiento"
              type="date"
              {...register("fechaNacimiento")}
            />
          </Campo>

          <Campo
            id="telefono"
            etiqueta="Teléfono"
            error={errors.telefono?.message}
          >
            <Input id="telefono" inputMode="tel" {...register("telefono")} />
          </Campo>

          <Campo
            id="direccion"
            etiqueta="Dirección"
            error={errors.direccion?.message}
          >
            <Input id="direccion" {...register("direccion")} />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos laborales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo id="legajo" etiqueta="Legajo" error={errors.legajo?.message}>
            <Input id="legajo" {...register("legajo")} />
          </Campo>

          <Campo id="cargo" etiqueta="Cargo" error={errors.cargo?.message}>
            <Input id="cargo" {...register("cargo")} />
          </Campo>

          <Campo id="turno" etiqueta="Turno" error={errors.turno?.message}>
            <Controller
              control={control}
              name="turno"
              render={({ field }) => (
                <Select
                  items={ETIQUETA_TURNO}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="turno" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TURNOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ETIQUETA_TURNO[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <Campo id="salaId" etiqueta="Sala" error={errors.salaId?.message}>
            <Controller
              control={control}
              name="salaId"
              render={({ field }) => (
                <Select
                  items={Object.fromEntries(
                    salasConVacio.map((s) => [s.id, s.nombre]),
                  )}
                  value={field.value ?? SIN_SALA}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="salaId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salasConVacio.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <Campo
            id="valorHora"
            etiqueta="Valor hora"
            error={errors.valorHora?.message}
            ayuda="En pesos. Se usa para liquidar el sueldo del mes."
          >
            <Input
              id="valorHora"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...register("valorHora")}
            />
          </Campo>

          <Campo id="estado" etiqueta="Estado" error={errors.estado?.message}>
            <Controller
              control={control}
              name="estado"
              render={({ field }) => (
                <Select
                  items={{ ACTIVO: "Activa", INACTIVO: "Inactiva" }}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="estado" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_EMPLEADO.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e === "ACTIVO" ? "Activa" : "Inactiva"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acceso al sistema</CardTitle>
          <CardDescription>
            {esAlta
              ? "Con estos datos va a poder entrar a la app y fichar."
              : "La contraseña se restablece desde el listado de empleadas."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo id="email" etiqueta="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              {...register("email")}
            />
          </Campo>

          {esAlta && (
            <Campo
              id="password"
              etiqueta="Contraseña provisional"
              error={errors.password?.message}
              ayuda="Dictásela a la empleada. La cambia desde su perfil al entrar."
            >
              <div className="flex gap-2">
                <Input id="password" {...register("password")} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Generar otra contraseña"
                  onClick={() =>
                    setValue("password", generarPasswordProvisional(), {
                      shouldValidate: true,
                    })
                  }
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </Campo>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {esAlta ? "Dar de alta" : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/empleados")}
        >
          Cancelar
        </Button>
        {esAlta && password && (
          <p className="text-muted-foreground w-full text-xs">
            Anotá la contraseña antes de guardar: no se vuelve a mostrar.
          </p>
        )}
      </div>
    </form>
  );
}
