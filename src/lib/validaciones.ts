import { z } from "zod";

import { DIMENSION_DESCRIPTOR, MUESTRAS_ENROLAMIENTO } from "@/lib/rostro";

/**
 * Esquemas compartidos entre los formularios del cliente y las Server
 * Actions. La misma validación corre en los dos lados: el cliente para dar
 * feedback inmediato, el servidor porque es el único que no se puede
 * saltear.
 */

export const TURNOS = ["MANANA", "TARDE", "DOBLE"] as const;
export const ESTADOS_EMPLEADO = ["ACTIVO", "INACTIVO"] as const;

export const ETIQUETA_TURNO: Record<(typeof TURNOS)[number], string> = {
  MANANA: "Mañana",
  TARDE: "Tarde",
  DOBLE: "Doble",
};

const textoRequerido = (campo: string, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `Ingresá ${campo}`)
    .max(max, `${campo} es demasiado largo`);

/** Convierte "" en undefined: los inputs vacíos llegan como string vacío. */
const opcional = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

const horaHHmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usá el formato HH:mm, por ejemplo 08:00");

// ─────────────────────────── Empleados ───────────────────────────

export const empleadoSchema = z.object({
  nombre: textoRequerido("el nombre"),
  apellido: textoRequerido("el apellido"),
  email: z
    .string()
    .trim()
    .min(1, "Ingresá el email")
    .email("Email inválido")
    .toLowerCase(),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,9}$/, "El DNI son 7 a 9 dígitos, sin puntos"),
  legajo: textoRequerido("el legajo", 20),
  cargo: textoRequerido("el cargo"),
  turno: z.enum(TURNOS),
  salaId: z
    .string()
    .transform((v) => (v === "" || v === "sin-sala" ? null : v))
    .nullable(),
  valorHora: z.coerce
    .number({ message: "Ingresá un número" })
    .min(0, "No puede ser negativo")
    .max(9_999_999, "Valor demasiado alto"),
  telefono: opcional(30),
  direccion: opcional(),
  fechaNacimiento: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), {
      message: "Fecha inválida",
    }),
  estado: z.enum(ESTADOS_EMPLEADO),
});

export type DatosEmpleado = z.infer<typeof empleadoSchema>;

/** Al crear se genera una contraseña provisional que la empleada cambia después. */
export const nuevoEmpleadoSchema = empleadoSchema.extend({
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
});

export const filtrosEmpleadosSchema = z.object({
  q: z.string().trim().optional(),
  sala: z.string().optional(),
  turno: z.enum(TURNOS).optional(),
  estado: z.enum(ESTADOS_EMPLEADO).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type FiltrosEmpleados = z.infer<typeof filtrosEmpleadosSchema>;

// ─────────────────────────── Registro facial ───────────────────────────

/**
 * El descriptor lo calcula el navegador, así que llega como cualquier otro
 * dato del cliente: sin confianza. Se comprueba el largo exacto que produce
 * el modelo y que cada componente sea un número real.
 */
export const muestraFacialSchema = z.object({
  descriptor: z
    .array(z.number().finite("El descriptor tiene valores inválidos"))
    .length(
      DIMENSION_DESCRIPTOR,
      `El descriptor no mide ${DIMENSION_DESCRIPTOR} valores`,
    ),
  calidad: z.number().min(0).max(1),
});

export const enrolamientoSchema = z.object({
  muestras: z
    .array(muestraFacialSchema)
    .length(
      MUESTRAS_ENROLAMIENTO,
      `Hacen falta ${MUESTRAS_ENROLAMIENTO} muestras`,
    ),
});

export type MuestraFacial = z.infer<typeof muestraFacialSchema>;

// ─────────────────────────── Configuración ───────────────────────────

export const configuracionSchema = z.object({
  nombreJardin: textoRequerido("el nombre del jardín"),
  jardinLat: z.coerce
    .number({ message: "Ingresá un número" })
    .min(-90, "Latitud fuera de rango")
    .max(90, "Latitud fuera de rango"),
  jardinLng: z.coerce
    .number({ message: "Ingresá un número" })
    .min(-180, "Longitud fuera de rango")
    .max(180, "Longitud fuera de rango"),
  radioMetros: z.coerce
    .number()
    .int()
    .min(10, "Menos de 10 m no es realista para un GPS de celular")
    .max(5000, "Máximo 5000 m"),
  precisionMaximaMetros: z.coerce
    .number()
    .int()
    .min(5, "Mínimo 5 m")
    .max(500, "Máximo 500 m"),
  umbralFacial: z.coerce
    .number()
    .min(0.1, "Mínimo 0.1")
    .max(1.5, "Más de 1.5 acepta cualquier rostro"),
  umbralLiveness: z.coerce.number().min(0).max(1),
  umbralAntispoof: z.coerce.number().min(0).max(1),
  diasLaborales: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Elegí al menos un día laboral"),
});

export const horarioSchema = z
  .object({
    turno: z.enum(TURNOS),
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
    toleranciaMinutos: z.coerce
      .number()
      .int()
      .min(0, "No puede ser negativa")
      .max(120, "Máximo 120 minutos"),
  })
  .refine((h) => h.horaFin > h.horaInicio, {
    message: "La salida tiene que ser posterior a la entrada",
    path: ["horaFin"],
  });

export const horariosSchema = z.object({
  horarios: z.array(horarioSchema).length(3),
});

export const salaSchema = z.object({
  nombre: textoRequerido("el nombre de la sala", 50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Usá un color en formato #rrggbb"),
});

// ─────────────────────────── Contraseña ───────────────────────────

export const cambioPasswordSchema = z
  .object({
    actual: z.string().min(1, "Ingresá tu contraseña actual"),
    nueva: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(72, "Máximo 72 caracteres"),
    repetir: z.string().min(1, "Repetí la contraseña nueva"),
  })
  .refine((v) => v.nueva === v.repetir, {
    message: "Las contraseñas no coinciden",
    path: ["repetir"],
  })
  .refine((v) => v.nueva !== v.actual, {
    message: "La nueva tiene que ser distinta de la actual",
    path: ["nueva"],
  });
