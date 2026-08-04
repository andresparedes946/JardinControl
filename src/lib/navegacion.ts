import {
  BarChart3,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  QrCode,
  ScrollText,
  Settings,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ItemNavegacion = {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
};

/**
 * El menú. Ya no está partido por rol: la única sesión posible es la de la
 * dirección, porque las maestras fichan por QR y no tienen cuenta.
 *
 * Es solo presentación: el control de acceso real está en `src/middleware.ts`
 * y en las guardas de `src/lib/session.ts`.
 */
export const NAVEGACION: ItemNavegacion[] = [
  { href: "/dashboard", etiqueta: "Dashboard", icono: LayoutDashboard },
  { href: "/codigo", etiqueta: "Código de fichaje", icono: QrCode },
  { href: "/empleados", etiqueta: "Empleados", icono: Users },
  { href: "/asistencias", etiqueta: "Asistencias", icono: CalendarCheck },
  { href: "/licencias", etiqueta: "Licencias", icono: FileText },
  { href: "/sueldos", etiqueta: "Sueldos", icono: Wallet },
  { href: "/reportes", etiqueta: "Reportes", icono: BarChart3 },
  { href: "/auditoria", etiqueta: "Auditoría", icono: ScrollText },
  { href: "/configuracion", etiqueta: "Configuración", icono: Settings },
  { href: "/perfil", etiqueta: "Mi perfil", icono: User },
];
