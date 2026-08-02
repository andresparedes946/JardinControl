"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { generarPasswordProvisional } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  MUESTRAS_ENROLAMIENTO,
  SIMILITUD_MINIMA_ENTRE_MUESTRAS,
  similitud,
} from "@/lib/rostro";
import { requerirAdmin } from "@/lib/session";
import {
  empleadoSchema,
  enrolamientoSchema,
  nuevoEmpleadoSchema,
  type DatosEmpleado,
} from "@/lib/validaciones";

export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

/**
 * Traduce los choques de índice único de Postgres a un mensaje que se
 * entienda.
 *
 * Prisma 6 exponía el campo culpable en `meta.target`. Con los driver
 * adapters de Prisma 7 eso desapareció y ahora viene en
 * `meta.driverAdapterError.cause.constraint`. Se leen las dos formas, más el
 * mensaje como último recurso, para que un cambio de versión degrade a un
 * texto genérico en vez de romper.
 */
function errorDeDuplicado(error: unknown): string | null {
  const e = error as {
    code?: string;
    message?: string;
    meta?: {
      target?: string[] | string;
      driverAdapterError?: {
        cause?: { constraint?: { fields?: string[]; index?: string } };
      };
    };
  };

  if (e?.code !== "P2002") return null;

  const restriccion = e.meta?.driverAdapterError?.cause?.constraint;
  const objetivo = [
    Array.isArray(e.meta?.target) ? e.meta.target.join(",") : e.meta?.target,
    restriccion?.fields?.join(","),
    restriccion?.index,
    e.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (objetivo.includes("email")) return "Ya hay una cuenta con ese email.";
  if (objetivo.includes("dni")) return "Ya hay una empleada con ese DNI.";
  if (objetivo.includes("legajo")) return "Ese legajo ya está en uso.";
  return "Ya existe un registro con esos datos.";
}

function datosDeEmpleado(datos: DatosEmpleado) {
  return {
    dni: datos.dni,
    legajo: datos.legajo,
    cargo: datos.cargo,
    turno: datos.turno,
    salaId: datos.salaId,
    valorHora: datos.valorHora,
    telefono: datos.telefono ?? null,
    direccion: datos.direccion ?? null,
    fechaNacimiento: datos.fechaNacimiento
      ? new Date(datos.fechaNacimiento)
      : null,
    estado: datos.estado,
  };
}

export async function crearEmpleado(entrada: unknown): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = nuevoEmpleadoSchema.safeParse(entrada);
  if (!parseado.success) {
    return { ok: false, error: parseado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const datos = parseado.data;

  try {
    // Usuario y empleado se crean juntos o no se crea ninguno: un usuario
    // suelto sin empleado podría iniciar sesión sin poder fichar.
    const empleado = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          email: datos.email,
          password: await hash(datos.password, 10),
          rol: "EMPLEADO",
        },
      });

      return tx.empleado.create({
        data: { usuarioId: usuario.id, ...datosDeEmpleado(datos) },
      });
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "CREAR",
      entidad: "Empleado",
      entidadId: empleado.id,
      detalle: { email: datos.email, legajo: datos.legajo },
    });

    revalidatePath("/empleados");
    return { ok: true, mensaje: `${datos.nombre} ${datos.apellido} dada de alta.` };
  } catch (error) {
    const duplicado = errorDeDuplicado(error);
    if (duplicado) return { ok: false, error: duplicado };

    console.error("crearEmpleado:", error);
    return { ok: false, error: "No se pudo crear la empleada." };
  }
}

export async function actualizarEmpleado(
  id: string,
  entrada: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = empleadoSchema.safeParse(entrada);
  if (!parseado.success) {
    return { ok: false, error: parseado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const datos = parseado.data;

  try {
    await prisma.$transaction(async (tx) => {
      const empleado = await tx.empleado.update({
        where: { id },
        data: datosDeEmpleado(datos),
      });

      await tx.usuario.update({
        where: { id: empleado.usuarioId },
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          email: datos.email,
          // Dar de baja a la empleada también le corta el acceso: si no, una
          // empleada inactiva seguiría pudiendo iniciar sesión.
          activo: datos.estado === "ACTIVO",
        },
      });
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "ACTUALIZAR",
      entidad: "Empleado",
      entidadId: id,
      detalle: { email: datos.email, estado: datos.estado },
    });

    revalidatePath("/empleados");
    revalidatePath(`/empleados/${id}`);
    return { ok: true, mensaje: "Cambios guardados." };
  } catch (error) {
    const duplicado = errorDeDuplicado(error);
    if (duplicado) return { ok: false, error: duplicado };

    console.error("actualizarEmpleado:", error);
    return { ok: false, error: "No se pudieron guardar los cambios." };
  }
}

/**
 * Baja lógica. No se borra: las asistencias, licencias y liquidaciones
 * históricas tienen que seguir existiendo y apuntando a alguien.
 */
export async function cambiarEstadoEmpleado(
  id: string,
  estado: "ACTIVO" | "INACTIVO",
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  try {
    const empleado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.empleado.update({
        where: { id },
        data: { estado },
        include: { usuario: { select: { nombre: true, apellido: true } } },
      });

      await tx.usuario.update({
        where: { id: actualizado.usuarioId },
        data: { activo: estado === "ACTIVO" },
      });

      return actualizado;
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: estado === "ACTIVO" ? "REACTIVAR" : "DAR_DE_BAJA",
      entidad: "Empleado",
      entidadId: id,
    });

    revalidatePath("/empleados");
    const nombre = `${empleado.usuario.nombre} ${empleado.usuario.apellido}`;
    return {
      ok: true,
      mensaje:
        estado === "ACTIVO"
          ? `${nombre} reactivada.`
          : `${nombre} dada de baja. Ya no puede iniciar sesión.`,
    };
  } catch (error) {
    console.error("cambiarEstadoEmpleado:", error);
    return { ok: false, error: "No se pudo cambiar el estado." };
  }
}

/**
 * Guarda el enrolamiento facial de una empleada.
 *
 * Las fotos del enrolamiento nunca salen del navegador: lo que viaja y se
 * guarda son los vectores, que no permiten reconstruir la cara. Es también
 * la razón por la que el descriptor lo calcula el cliente.
 *
 * Ese mismo reparto obliga a desconfiar de lo que llega: el navegador puede
 * mandar diez vectores cualesquiera. Contra eso, el servidor comprueba que
 * todas se parezcan a la primera, que es la que se toma mirando de frente.
 */
export async function guardarDescriptores(
  id: string,
  entrada: unknown,
): Promise<Resultado> {
  const sesion = await requerirAdmin();

  const parseado = enrolamientoSchema.safeParse(entrada);
  if (!parseado.success) {
    return {
      ok: false,
      error: parseado.error.issues[0]?.message ?? "Muestras inválidas",
    };
  }

  const { muestras } = parseado.data;

  // La referencia es la primera muestra, tomada de frente. No se comparan
  // todas contra todas a propósito: en un enrolamiento real medido, las
  // muestras extremas de los giros a izquierda y derecha quedaron a 0.41
  // entre sí, muy por debajo del umbral, aun siendo de la misma persona.
  // Exigir coherencia de a pares rechazaría enrolamientos legítimos.
  const referencia = muestras[0].descriptor;
  const dispar = muestras
    .slice(1)
    .some(
      (m) =>
        similitud(referencia, m.descriptor) < SIMILITUD_MINIMA_ENTRE_MUESTRAS,
    );

  if (dispar) {
    return {
      ok: false,
      error:
        "Las muestras no parecen ser de la misma persona. Repetí la captura con una sola cara frente a la cámara.",
    };
  }

  try {
    const empleado = await prisma.empleado.findUnique({
      where: { id },
      select: { usuario: { select: { nombre: true, apellido: true } } },
    });

    if (!empleado) return { ok: false, error: "No se encontró la empleada." };

    const previos = await prisma.$transaction(async (tx) => {
      // Un enrolamiento nuevo reemplaza al anterior en vez de sumarse: los
      // vectores viejos son datos biométricos que ya no hacen falta, y
      // dejarlos activos ampliaría para siempre lo que da por buena la cara.
      const { count } = await tx.descriptorFacial.deleteMany({
        where: { empleadoId: id },
      });

      await tx.descriptorFacial.createMany({
        data: muestras.map((m) => ({
          empleadoId: id,
          descriptor: m.descriptor,
          calidad: m.calidad,
        })),
      });

      return count;
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: previos > 0 ? "REENROLAR_ROSTRO" : "ENROLAR_ROSTRO",
      entidad: "Empleado",
      entidadId: id,
      detalle: { muestras: muestras.length, reemplazadas: previos },
    });

    revalidatePath("/empleados");
    revalidatePath(`/empleados/${id}/rostro`);

    const nombre = `${empleado.usuario.nombre} ${empleado.usuario.apellido}`;
    return {
      ok: true,
      mensaje: `Rostro de ${nombre} registrado con ${muestras.length} muestras.`,
    };
  } catch (error) {
    console.error("guardarDescriptores:", error);
    return { ok: false, error: "No se pudo guardar el registro facial." };
  }
}

/** Borra el enrolamiento. Deja a la empleada sin poder fichar hasta repetirlo. */
export async function borrarDescriptores(id: string): Promise<Resultado> {
  const sesion = await requerirAdmin();

  try {
    const { count } = await prisma.descriptorFacial.deleteMany({
      where: { empleadoId: id },
    });

    if (count === 0) {
      return { ok: false, error: "Esa empleada no tiene rostro registrado." };
    }

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "BORRAR_ROSTRO",
      entidad: "Empleado",
      entidadId: id,
      detalle: { muestras: count },
    });

    revalidatePath("/empleados");
    revalidatePath(`/empleados/${id}/rostro`);

    return {
      ok: true,
      mensaje: `Registro facial borrado. Hay que volver a tomar las ${MUESTRAS_ENROLAMIENTO} muestras para que pueda fichar.`,
    };
  } catch (error) {
    console.error("borrarDescriptores:", error);
    return { ok: false, error: "No se pudo borrar el registro facial." };
  }
}

/** Genera una contraseña nueva para cuando una empleada se la olvida. */
export async function restablecerPassword(id: string): Promise<
  Resultado & { password?: string }
> {
  const sesion = await requerirAdmin();

  try {
    const empleado = await prisma.empleado.findUnique({
      where: { id },
      select: { usuarioId: true },
    });

    if (!empleado) return { ok: false, error: "No se encontró la empleada." };

    const nueva = generarPasswordProvisional();

    await prisma.usuario.update({
      where: { id: empleado.usuarioId },
      data: { password: await hash(nueva, 10) },
    });

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "RESTABLECER_PASSWORD",
      entidad: "Empleado",
      entidadId: id,
    });

    return {
      ok: true,
      mensaje: "Contraseña restablecida.",
      password: nueva,
    };
  } catch (error) {
    console.error("restablecerPassword:", error);
    return { ok: false, error: "No se pudo restablecer la contraseña." };
  }
}
