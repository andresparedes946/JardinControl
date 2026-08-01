-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANANA', 'TARDE', 'DOBLE');

-- CreateEnum
CREATE TYPE "EstadoEmpleado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'TARDE', 'AUSENTE', 'JUSTIFICADA', 'LICENCIA');

-- CreateEnum
CREATE TYPE "TipoFichaje" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "ResultadoFichaje" AS ENUM ('ACEPTADO', 'RECHAZADO_ROSTRO', 'RECHAZADO_UBICACION', 'RECHAZADO_LIVENESS', 'RECHAZADO_SIN_ENROLAR', 'RECHAZADO_DUPLICADO');

-- CreateEnum
CREATE TYPE "TipoLicencia" AS ENUM ('ENFERMEDAD', 'VACACIONES', 'ESTUDIO', 'PERSONAL', 'MATERNIDAD', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoLicencia" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "fecha_nacimiento" DATE,
    "cargo" TEXT NOT NULL,
    "turno" "Turno" NOT NULL,
    "sala_id" TEXT,
    "foto_url" TEXT,
    "valor_hora" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "estado" "EstadoEmpleado" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descriptores_faciales" (
    "id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "descriptor" DOUBLE PRECISION[],
    "calidad" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descriptores_faciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_ingreso" TIMESTAMP(3),
    "hora_salida" TIMESTAMP(3),
    "minutos_trabajados" INTEGER,
    "minutos_tarde" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "ajustada_manual" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichajes" (
    "id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "asistencia_id" TEXT,
    "tipo" "TipoFichaje" NOT NULL,
    "resultado" "ResultadoFichaje" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "precision_metros" DOUBLE PRECISION,
    "distancia_metros" DOUBLE PRECISION,
    "score_facial" DOUBLE PRECISION,
    "score_liveness" DOUBLE PRECISION,
    "score_antispoof" DOUBLE PRECISION,
    "motivo_rechazo" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "fichajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencias" (
    "id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "tipo" "TipoLicencia" NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoLicencia" NOT NULL DEFAULT 'PENDIENTE',
    "revisada_por_id" TEXT,
    "revisada_en" TIMESTAMP(3),
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" TEXT NOT NULL,
    "licencia_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanio_bytes" INTEGER NOT NULL,
    "subido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id" TEXT NOT NULL,
    "turno" "Turno" NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fin" VARCHAR(5) NOT NULL,
    "tolerancia_minutos" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre_jardin" TEXT NOT NULL DEFAULT 'Mundo Feliz',
    "jardin_lat" DOUBLE PRECISION NOT NULL,
    "jardin_lng" DOUBLE PRECISION NOT NULL,
    "radio_metros" INTEGER NOT NULL DEFAULT 50,
    "precision_maxima_metros" INTEGER NOT NULL DEFAULT 100,
    "umbral_facial" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "umbral_liveness" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "umbral_antispoof" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "dias_laborales" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "empleado_id" TEXT NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "minutos_trabajados" INTEGER NOT NULL,
    "valor_hora" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "generada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "detalle" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,
    "navegador" TEXT,
    "dispositivo" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_usuario_id_key" ON "empleados"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_dni_key" ON "empleados"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_legajo_key" ON "empleados"("legajo");

-- CreateIndex
CREATE INDEX "empleados_sala_id_idx" ON "empleados"("sala_id");

-- CreateIndex
CREATE INDEX "empleados_estado_idx" ON "empleados"("estado");

-- CreateIndex
CREATE INDEX "descriptores_faciales_empleado_id_activo_idx" ON "descriptores_faciales"("empleado_id", "activo");

-- CreateIndex
CREATE INDEX "asistencias_fecha_idx" ON "asistencias"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_empleado_id_fecha_key" ON "asistencias"("empleado_id", "fecha");

-- CreateIndex
CREATE INDEX "fichajes_empleado_id_timestamp_idx" ON "fichajes"("empleado_id", "timestamp");

-- CreateIndex
CREATE INDEX "fichajes_resultado_idx" ON "fichajes"("resultado");

-- CreateIndex
CREATE INDEX "licencias_empleado_id_estado_idx" ON "licencias"("empleado_id", "estado");

-- CreateIndex
CREATE INDEX "licencias_fecha_inicio_fecha_fin_idx" ON "licencias"("fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "comprobantes_licencia_id_idx" ON "comprobantes"("licencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "salas_nombre_key" ON "salas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_turno_key" ON "horarios"("turno");

-- CreateIndex
CREATE UNIQUE INDEX "feriados_fecha_key" ON "feriados"("fecha");

-- CreateIndex
CREATE INDEX "liquidaciones_periodo_idx" ON "liquidaciones"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_empleado_id_periodo_key" ON "liquidaciones"("empleado_id", "periodo");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_fecha_idx" ON "auditoria"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_idx" ON "auditoria"("entidad", "entidad_id");

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descriptores_faciales" ADD CONSTRAINT "descriptores_faciales_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichajes" ADD CONSTRAINT "fichajes_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichajes" ADD CONSTRAINT "fichajes_asistencia_id_fkey" FOREIGN KEY ("asistencia_id") REFERENCES "asistencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_revisada_por_id_fkey" FOREIGN KEY ("revisada_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_licencia_id_fkey" FOREIGN KEY ("licencia_id") REFERENCES "licencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
