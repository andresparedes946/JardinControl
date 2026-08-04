"use client";

import { LogOut, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Rol } from "@/generated/prisma/enums";
import { NAVEGACION } from "@/lib/navegacion";
import { cn } from "@/lib/utils";

type Props = {
  rol: Rol;
  nombre: string;
  email: string;
};

function Enlaces({
  rol,
  onNavegar,
}: {
  rol: Rol;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAVEGACION[rol].map(({ href, etiqueta, icono: Icono }) => {
        const activo = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavegar}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activo
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icono className="size-4 shrink-0" />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

function Encabezado() {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={28}
        height={28}
        className="rounded-md"
      />
      <span className="font-semibold tracking-tight">JardinControl</span>
    </div>
  );
}

function PiePerfil({ nombre, email }: { nombre: string; email: string }) {
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="px-3">
        <p className="truncate text-sm font-medium">{nombre}</p>
        <p className="text-muted-foreground truncate text-xs">{email}</p>
      </div>
      <Button
        variant="ghost"
        className="text-muted-foreground w-full justify-start gap-3"
        onClick={() => signOut({ redirectTo: "/login" })}
      >
        <LogOut className="size-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}

export function BarraLateral({ rol, nombre, email }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/* Escritorio: barra fija */}
      <aside className="bg-card no-imprimir hidden w-60 shrink-0 flex-col gap-4 border-r p-3 md:flex">
        <Encabezado />
        <div className="flex-1 overflow-y-auto">
          <Enlaces rol={rol} />
        </div>
        <PiePerfil nombre={nombre} email={email} />
      </aside>

      {/* Celular: barra superior con menú desplegable */}
      <header className="bg-card no-imprimir sticky top-0 z-40 flex items-center gap-2 border-b p-2 md:hidden">
        <Sheet open={abierto} onOpenChange={setAbierto}>
          {/* Base UI compone con `render`, no con `asChild`. */}
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Abrir menú" />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col gap-4 p-3">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <Encabezado />
            <div className="flex-1 overflow-y-auto">
              <Enlaces rol={rol} onNavegar={() => setAbierto(false)} />
            </div>
            <PiePerfil nombre={nombre} email={email} />
          </SheetContent>
        </Sheet>
        <Encabezado />
      </header>
    </>
  );
}
