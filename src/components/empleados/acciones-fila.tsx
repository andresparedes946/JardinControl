"use client";

import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  ScanFace,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  cambiarEstadoEmpleado,
  restablecerPassword,
} from "@/app/(app)/empleados/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  id: string;
  nombre: string;
  estado: "ACTIVO" | "INACTIVO";
};

export function AccionesFila({ id, nombre, estado }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const [passwordNueva, setPasswordNueva] = useState<string | null>(null);

  const activa = estado === "ACTIVO";

  function alternarEstado() {
    startTransition(async () => {
      const r = await cambiarEstadoEmpleado(id, activa ? "INACTIVO" : "ACTIVO");
      setConfirmarBaja(false);

      if (r.ok) {
        toast.success(r.mensaje);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function restablecer() {
    startTransition(async () => {
      const r = await restablecerPassword(id);

      if (r.ok && r.password) setPasswordNueva(r.password);
      else toast.error("error" in r ? r.error : "No se pudo restablecer");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Acciones para ${nombre}`}
              disabled={pendiente}
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/empleados/${id}`} />}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={`/empleados/${id}/rostro`} />}>
            <ScanFace className="size-4" />
            Registro facial
          </DropdownMenuItem>
          <DropdownMenuItem onClick={restablecer}>
            <KeyRound className="size-4" />
            Restablecer contraseña
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => (activa ? setConfirmarBaja(true) : alternarEstado())}
          >
            {activa ? (
              <>
                <UserX className="size-4" />
                Dar de baja
              </>
            ) : (
              <>
                <UserCheck className="size-4" />
                Reactivar
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmarBaja} onOpenChange={setConfirmarBaja}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Dar de baja a {nombre}?</DialogTitle>
            <DialogDescription>
              No se borra nada: sus asistencias, licencias y liquidaciones
              quedan en el historial. Deja de poder iniciar sesión y de
              aparecer entre las activas. Se puede reactivar cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarBaja(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={alternarEstado}
              disabled={pendiente}
            >
              Dar de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordNueva !== null}
        onOpenChange={() => setPasswordNueva(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña nueva de {nombre}</DialogTitle>
            <DialogDescription>
              Anotala o dictásela ahora: no se vuelve a mostrar. Al entrar, va
              a poder cambiarla desde su perfil.
            </DialogDescription>
          </DialogHeader>
          <p className="bg-muted rounded-md px-4 py-3 text-center font-mono text-lg tracking-wide">
            {passwordNueva}
          </p>
          <DialogFooter>
            <Button onClick={() => setPasswordNueva(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
