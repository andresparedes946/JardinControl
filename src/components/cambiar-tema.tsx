"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function CambiarTema() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);

  // El tema real solo se conoce en el cliente: renderizar el ícono antes de
  // montar produciría un mismatch de hidratación.
  useEffect(() => setMontado(true), []);

  // Hasta que monte, el servidor no sabe qué tema resolvió el cliente. Se
  // renderiza el estado neutro en TODO lo que dependa del tema —ícono y
  // aria-label— porque basta con que uno de los dos difiera para romper la
  // hidratación de la rama entera.
  const esOscuro = montado && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(esOscuro ? "light" : "dark")}
      aria-label={esOscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {esOscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
