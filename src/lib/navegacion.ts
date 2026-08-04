import {
  BarChart3,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  ScanFace,
  ScrollText,
  Settings,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Rol } from "@/generated/prisma/enums";

export type ItemNavegacion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
};

/**
 * Menú por rol. Es solo presentación: el control de acceso real está en
 * `src/middleware.ts` y en las guardas de `src/lib/session.ts`.
 */
export const NAVEGACION: Record<Rol, ItemNavegacion[]> = {
  ADMIN: [
    { href: "/dashboard", etiqueta: "Dashboard", icono: LayoutDashboard },
    { href: "/empleados", etiqueta: "Empleados", icono: Users },
    { href: "/asistencias", etiqueta: "Asistencias", icono: CalendarCheck },
    { href: "/licencias", etiqueta: "Licencias", icono: FileText },
    { href: "/sueldos", etiqueta: "Sueldos", icono: Wallet },
    { href: "/reportes", etiqueta: "Reportes", icono: BarChart3 },
    { href: "/auditoria", etiqueta: "Auditoría", icono: ScrollText },
    { href: "/configuracion", etiqueta: "Configuración", icono: Settings },
    // La dirección también tiene contraseña y también la cambia. Faltaba el
    // enlace: la pantalla existía desde la Fase 1 y solo la veían las
    // maestras, así que la única forma de llegar era escribir la URL.
    { href: "/perfil", etiqueta: "Mi perfil", icono: User },
  ],
  EMPLEADO: [
    { href: "/fichar", etiqueta: "Fichar", icono: ScanFace },
    { href: "/mi-historial", etiqueta: "Mi historial", icono: CalendarCheck },
    { href: "/mis-licencias", etiqueta: "Mis licencias", icono: FileText },
    { href: "/perfil", etiqueta: "Mi perfil", icono: User },
  ],
};
