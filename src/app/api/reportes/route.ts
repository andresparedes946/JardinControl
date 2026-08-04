import { NextResponse } from "next/server";

import { registrarAuditoria } from "@/lib/auditoria";
import { obtenerConfiguracion } from "@/lib/empleados";
import {
  generarReporte,
  nombreDeArchivo,
  reporteACSV,
} from "@/lib/reportes";
import { sesionDeApi } from "@/lib/session";
import { filtrosReporteSchema } from "@/lib/validaciones";

/**
 * Descarga de un reporte en CSV.
 *
 * Es una ruta y no una Server Action para que el botón sea un `<a href>`
 * común: el navegador se encarga de la descarga, no hay que armar un blob ni
 * un enlace temporal en el cliente, y el archivo se puede volver a bajar
 * refrescando la URL.
 *
 * Los filtros llegan por query string, los mismos que usa la pantalla, y se
 * validan con el mismo esquema.
 */
export async function GET(request: Request) {
  const sesion = await sesionDeApi();

  // Los reportes cruzan datos de todo el personal: solo la dirección.
  if (!sesion || sesion.user.rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parseado = filtrosReporteSchema.safeParse(
    Object.fromEntries(searchParams),
  );

  if (!parseado.success) {
    return NextResponse.json(
      { error: parseado.error.issues[0]?.message ?? "Filtros inválidos" },
      { status: 400 },
    );
  }

  const filtros = parseado.data;

  try {
    const config = await obtenerConfiguracion();
    const reporte = await generarReporte(filtros, config.zonaHoraria);

    await registrarAuditoria({
      usuarioId: sesion.user.id,
      accion: "EXPORTAR_REPORTE",
      entidad: "Reporte",
      entidadId: filtros.tipo,
      detalle: { ...filtros, filas: reporte.filas.length },
    });

    return new NextResponse(reporteACSV(reporte), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreDeArchivo(reporte, filtros.periodo)}"`,
        // El reporte cambia con cada corrección de asistencia: que no quede
        // una versión vieja guardada en el navegador.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("exportar reporte:", error);
    return NextResponse.json(
      { error: "No se pudo generar el reporte" },
      { status: 500 },
    );
  }
}
