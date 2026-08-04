-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResultadoFichaje" ADD VALUE 'RECHAZADO_TOKEN';
ALTER TYPE "ResultadoFichaje" ADD VALUE 'RECHAZADO_PIN';

-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "token_fichaje" TEXT,
ADD COLUMN     "token_generado_en" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "empleados" ADD COLUMN     "pin_fichaje" TEXT;
