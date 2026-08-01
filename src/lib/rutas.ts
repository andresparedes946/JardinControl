/**
 * Constantes de ruteo compartidas entre el middleware (runtime edge), las
 * pages y el cliente. Este módulo no importa nada a propósito: cualquier
 * dependencia acá termina dentro del bundle del middleware.
 */

/** Secciones reservadas al rol ADMIN. */
export const RUTAS_ADMIN = [
  "/dashboard",
  "/empleados",
  "/asistencias",
  "/licencias",
  "/sueldos",
  "/reportes",
  "/configuracion",
  "/auditoria",
] as const;

/** Accesibles sin sesión. */
export const RUTAS_PUBLICAS = ["/login"] as const;

/** Dónde cae cada rol al entrar sin destino explícito. */
export const INICIO_POR_ROL = {
  ADMIN: "/dashboard",
  EMPLEADO: "/fichar",
} as const;
