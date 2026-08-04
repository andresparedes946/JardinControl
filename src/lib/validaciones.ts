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

// ─────────────────────────── Asistencias ───────────────────────────

export const ESTADOS_ASISTENCIA = [
  "PRESENTE",
  "TARDE",
  "AUSENTE",
  "JUSTIFICADA",
  "LICENCIA",
] as const;

export const ETIQUETA_ESTADO_ASISTENCIA: Record<
  (typeof ESTADOS_ASISTENCIA)[number],
  string
> = {
  PRESENTE: "Presente",
  TARDE: "Tarde",
  AUSENTE: "Ausente",
  JUSTIFICADA: "Justificada",
  LICENCIA: "Licencia",
};

const periodoYYYYMM = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido");

/** Período "YYYY-MM" suelto, para las acciones que reciben solo eso. */
export const periodoSchema = periodoYYYYMM;

export const filtrosAsistenciasSchema = z.object({
  periodo: periodoYYYYMM.optional(),
  empleado: z.string().optional(),
  sala: z.string().optional(),
  estado: z.enum(ESTADOS_ASISTENCIA).optional(),
});

export type FiltrosAsistencias = z.infer<typeof filtrosAsistenciasSchema> & {
  periodo: string;
};

/**
 * Corrección manual de una jornada.
 *
 * Las horas se escriben en hora del jardín; el servidor las convierte al
 * instante UTC que corresponda. Vacías significan "sin registrar", que es
 * distinto de cero: una empleada que no fichó la salida no trabajó 0 minutos,
 * simplemente no se sabe.
 */
export const ajusteAsistenciaSchema = z
  .object({
    horaIngreso: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/, "Usá el formato HH:mm"),
    horaSalida: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/, "Usá el formato HH:mm"),
    estado: z.enum(ESTADOS_ASISTENCIA),
    observaciones: opcional(300),
  })
  .refine((v) => !(v.horaSalida && !v.horaIngreso), {
    message: "No puede haber salida sin entrada",
    path: ["horaIngreso"],
  })
  .refine((v) => !v.horaIngreso || !v.horaSalida || v.horaSalida > v.horaIngreso, {
    message: "La salida tiene que ser posterior a la entrada",
    path: ["horaSalida"],
  });

export type DatosAjusteAsistencia = z.infer<typeof ajusteAsistenciaSchema>;

// ─────────────────────────── Fichaje ───────────────────────────

/**
 * Lo que manda el navegador al fichar: un descriptor, la lectura del GPS y
 * los scores que produjo el modelo. Nada de esto se toma por bueno; el
 * servidor decide con estos valores pero validándolos primero.
 */
export const fichajeSchema = z.object({
  descriptor: z
    .array(z.number().finite("El descriptor tiene valores inválidos"))
    .length(
      DIMENSION_DESCRIPTOR,
      `El descriptor no mide ${DIMENSION_DESCRIPTOR} valores`,
    ),
  calidad: z.number().min(0).max(1),
  scoreLiveness: z.number().min(0).max(1),
  scoreAntispoof: z.number().min(0).max(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Sin tope superior a propósito: una precisión malísima es un dato válido
  // que el servidor tiene que ver para poder rechazarla y dejarla registrada.
  precisionMetros: z.number().min(0),
});

export type DatosFichaje = z.infer<typeof fichajeSchema>;

// ─────────────────────────── Fichaje por QR ───────────────────────────

/** Cuatro dígitos: se teclea de pie, con una mano y a veces con guantes. */
export const PIN_LARGO = 4;

export const pinSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${PIN_LARGO}}$`), `El PIN son ${PIN_LARGO} dígitos`);

/**
 * Lo que manda la empleada desde la página del QR.
 *
 * El token viaja en la URL y se valida aparte. Acá van la identidad —DNI más
 * PIN— y la ubicación, que el servidor vuelve a medir contra la geocerca.
 */
export const fichajeQrSchema = z.object({
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,9}$/, "El DNI son 7 a 9 dígitos, sin puntos"),
  pin: pinSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Sin tope superior a propósito: una precisión malísima es un dato válido
  // que el servidor tiene que ver para poder rechazarla y dejarla registrada.
  precisionMetros: z.number().min(0),
});

export type DatosFichajeQr = z.infer<typeof fichajeQrSchema>;

// ─────────────────────────── Licencias ───────────────────────────

export const TIPOS_LICENCIA = [
  "ENFERMEDAD",
  "VACACIONES",
  "ESTUDIO",
  "PERSONAL",
  "MATERNIDAD",
  "OTRO",
] as const;

export const ETIQUETA_TIPO_LICENCIA: Record<
  (typeof TIPOS_LICENCIA)[number],
  string
> = {
  ENFERMEDAD: "Enfermedad",
  VACACIONES: "Vacaciones",
  ESTUDIO: "Estudio",
  PERSONAL: "Personal",
  MATERNIDAD: "Maternidad",
  OTRO: "Otro",
};

/**
 * Con qué tipo nace una licencia cuando la empleada solo manda el papel. La
 * dirección lo confirma o lo cambia al revisarla; casi todos los certificados
 * que llegan a un jardín son médicos.
 */
export const TIPO_LICENCIA_POR_DEFECTO = "ENFERMEDAD" as const;

export const ESTADOS_LICENCIA = ["PENDIENTE", "APROBADA", "RECHAZADA"] as const;

export const ETIQUETA_ESTADO_LICENCIA: Record<
  (typeof ESTADOS_LICENCIA)[number],
  string
> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

/** Tope de días de una licencia. Más que esto es un error de tipeo en la fecha. */
export const DIAS_MAXIMOS_LICENCIA = 365;

const fechaISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

/**
 * Lo que manda la empleada: el certificado y, si quiere, una aclaración.
 *
 * A propósito no pide tipo ni fechas. El período que cubre una licencia lo
 * dice el papel, no la maestra desde el celular, y quien lo lee y lo carga es
 * la dirección al revisarlo. Pedirle a la empleada que lo transcriba solo
 * agrega un dato para discutir después.
 */
export const certificadoSchema = z.object({
  detalle: opcional(500),
});

export type DatosCertificado = z.infer<typeof certificadoSchema>;

/**
 * Resolución de la dirección.
 *
 * Acá es donde se define de qué es la licencia y qué días cubre: al aprobar,
 * ese rango es el que queda marcado en las asistencias. Rechazar exige un
 * motivo, para que la empleada entienda qué le falta.
 */
export const revisionLicenciaSchema = z
  .object({
    estado: z.enum(["APROBADA", "RECHAZADA"]),
    tipo: z.enum(TIPOS_LICENCIA),
    fechaInicio: fechaISO,
    fechaFin: fechaISO,
    observaciones: opcional(300),
  })
  .refine((v) => v.fechaFin >= v.fechaInicio, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["fechaFin"],
  })
  .refine(
    (v) =>
      (Date.parse(v.fechaFin) - Date.parse(v.fechaInicio)) / 86_400_000 + 1 <=
      DIAS_MAXIMOS_LICENCIA,
    {
      message: `Una licencia no puede durar más de ${DIAS_MAXIMOS_LICENCIA} días`,
      path: ["fechaFin"],
    },
  )
  .refine((v) => v.estado !== "RECHAZADA" || !!v.observaciones, {
    message: "Escribí por qué se rechaza",
    path: ["observaciones"],
  });

export type DatosRevisionLicencia = z.infer<typeof revisionLicenciaSchema>;

export const filtrosLicenciasSchema = z.object({
  estado: z.enum(ESTADOS_LICENCIA).optional(),
  empleado: z.string().optional(),
});

export type FiltrosLicencias = z.infer<typeof filtrosLicenciasSchema>;

// ─────────────────────────── Comprobantes ───────────────────────────

/**
 * Restricciones de los archivos adjuntos. Se repiten en el bucket de Supabase
 * (ver `scripts/configurar-supabase.mjs`), pero se comprueban también acá: el
 * bucket devuelve un error genérico y esto da un mensaje que se entiende.
 */
export const MIME_COMPROBANTES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const TAMANIO_MAXIMO_COMPROBANTE = 5 * 1024 * 1024;
export const COMPROBANTES_MAXIMOS = 3;

/** Extensiones aceptadas por el `<input type="file">`. */
export const ACCEPT_COMPROBANTES = ".pdf,.jpg,.jpeg,.png,.webp";

export function problemaDelComprobante(archivo: {
  type: string;
  size: number;
  name: string;
}): string | null {
  if (!MIME_COMPROBANTES.includes(archivo.type as (typeof MIME_COMPROBANTES)[number])) {
    return `"${archivo.name}" no es un PDF ni una imagen.`;
  }

  if (archivo.size === 0) return `"${archivo.name}" está vacío.`;

  if (archivo.size > TAMANIO_MAXIMO_COMPROBANTE) {
    return `"${archivo.name}" pesa más de ${TAMANIO_MAXIMO_COMPROBANTE / 1024 / 1024} MB.`;
  }

  return null;
}

// ─────────────────────────── Reportes ───────────────────────────

export const TIPOS_REPORTE_VALIDOS = [
  "asistencias",
  "sueldos",
  "licencias",
] as const;

/**
 * Filtros de un reporte.
 *
 * Los mismos valores viajan en la URL de la pantalla y en la del archivo, así
 * que se parsean con este esquema en los dos lados: la vista previa y la
 * descarga no pueden terminar mirando recortes distintos.
 */
export const filtrosReporteSchema = z.object({
  tipo: z.enum(TIPOS_REPORTE_VALIDOS).default("asistencias"),
  periodo: periodoYYYYMM,
  empleado: z
    .string()
    .transform((v) => (v === "" || v === "todos" ? undefined : v))
    .optional(),
  sala: z
    .string()
    .transform((v) => (v === "" || v === "todos" ? undefined : v))
    .optional(),
  turno: z.enum(TURNOS).optional(),
  estado: z.enum(ESTADOS_LICENCIA).optional(),
});

export type FiltrosReporte = z.infer<typeof filtrosReporteSchema>;

// ─────────────────────────── Auditoría ───────────────────────────

/**
 * Cómo se lee cada acción en pantalla.
 *
 * La columna `accion` es texto libre a propósito: el registro no puede quedar
 * sujeto a una migración cada vez que aparece una operación nueva. Este mapa
 * es solo para mostrarla en castellano y para poblar el filtro; una acción que
 * no figure acá se muestra igual, con su nombre crudo.
 */
export const ETIQUETA_ACCION_AUDITORIA: Record<string, string> = {
  INICIAR_SESION: "Inició sesión",
  LOGIN_FALLIDO: "Intento de acceso fallido",
  CREAR: "Creó",
  ACTUALIZAR: "Modificó",
  ELIMINAR: "Eliminó",
  DAR_DE_BAJA: "Dio de baja",
  REACTIVAR: "Reactivó",
  RESTABLECER_PASSWORD: "Restableció la contraseña",
  CAMBIAR_PASSWORD: "Cambió su contraseña",
  ENROLAR_ROSTRO: "Registró el rostro",
  REENROLAR_ROSTRO: "Volvió a registrar el rostro",
  BORRAR_ROSTRO: "Borró el rostro",
  AJUSTAR_ASISTENCIA: "Corrigió una jornada",
  SUBIR_CERTIFICADO: "Envió un certificado",
  // Ya no se produce: la maestra manda el certificado y la dirección carga el
  // período al aprobarlo. Se traduce igual porque las filas viejas siguen ahí,
  // que es justamente lo que una auditoría existe para poder leer.
  SOLICITAR_LICENCIA: "Solicitó una licencia",
  ADJUNTAR_COMPROBANTE: "Adjuntó un comprobante",
  CANCELAR_LICENCIA: "Canceló una licencia",
  APROBAR_LICENCIA: "Aprobó una licencia",
  RECHAZAR_LICENCIA: "Rechazó una licencia",
  GENERAR_LIQUIDACION: "Generó la liquidación",
  EXPORTAR_REPORTE: "Exportó un reporte",
};

export const ETIQUETA_ENTIDAD_AUDITORIA: Record<string, string> = {
  Usuario: "Usuario",
  Empleado: "Empleada",
  Asistencia: "Asistencia",
  Licencia: "Licencia",
  Liquidacion: "Liquidación",
  Reporte: "Reporte",
  Configuracion: "Configuración",
  Horario: "Horario",
  Sala: "Sala",
};

/** Traduce una acción o una entidad, cayendo al valor crudo si no está mapeada. */
export function etiquetaDeAuditoria(
  mapa: Record<string, string>,
  valor: string,
): string {
  return mapa[valor] ?? valor;
}

export const filtrosAuditoriaSchema = z.object({
  periodo: periodoYYYYMM.optional(),
  usuario: z.string().optional(),
  // Se aceptan como texto por lo mismo que la columna lo es: restringirlas a
  // un enum dejaría sin filtro a cualquier acción agregada después.
  accion: z.string().trim().max(50).optional(),
  entidad: z.string().trim().max(50).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

export type FiltrosAuditoria = z.infer<typeof filtrosAuditoriaSchema> & {
  periodo: string;
};

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
  // Va al revés que la distancia que había antes: más alto, más estricto.
  // Por debajo de 0.3 entra cualquier cara; por encima de 0.9 no entra ni la
  // titular con otra luz.
  similitudMinima: z.coerce
    .number()
    .min(0.3, "Menos de 0.3 acepta casi cualquier rostro")
    .max(0.9, "Más de 0.9 rechaza hasta a la propia empleada"),
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
