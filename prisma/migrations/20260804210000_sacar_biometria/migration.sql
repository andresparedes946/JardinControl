-- El fichaje pasó de reconocimiento facial a QR más DNI y PIN. Se borran los
-- vectores faciales y los umbrales que los gobernaban: mientras un embedding
-- exista en la base sigue siendo un dato biométrico guardado, con todo lo que
-- eso implica, para una función que ya no se usa.
--
-- Borra 20 filas de descriptores. Es irreversible y está pedido.

-- DropForeignKey
ALTER TABLE "descriptores_faciales" DROP CONSTRAINT "descriptores_faciales_empleado_id_fkey";

-- AlterTable
ALTER TABLE "configuracion" DROP COLUMN "similitud_minima",
DROP COLUMN "umbral_antispoof",
DROP COLUMN "umbral_liveness";

-- DropTable
DROP TABLE "descriptores_faciales";
