/**
 * Constantes de ruteo compartidas entre el middleware (runtime edge), las
 * pages y el cliente. Este módulo no importa nada a propósito: cualquier
 * dependencia acá termina dentro del bundle del middleware.
 */

/** Secciones reservadas al rol ADMIN. */
export const RUTAS_ADMIN = [
  "/dashboard",
  "/codigo",
  "/empleados",
  "/asistencias",
  "/licencias",
  "/sueldos",
  "/reportes",
  "/configuracion",
  "/auditoria",
] as const;

/** Accesibles sin sesión. Con sesión activa no tienen sentido: se redirige. */
export const RUTAS_PUBLICAS = ["/login"] as const;

/**
 * Abiertas a cualquiera, con sesión o sin ella.
 *
 * La página del QR la abren maestras que no tienen cuenta, así que no puede
 * pedir sesión; y tampoco puede redirigir a quien sí la tenga, porque la
 * dirección necesita poder abrirla para probar que el código funciona.
 */
export const RUTAS_ABIERTAS = ["/f/"] as const;

/** Dónde cae cada rol al entrar sin destino explícito. */
export const INICIO_POR_ROL = {
  ADMIN: "/dashboard",
  EMPLEADO: "/fichar",
} as const;
