-- umbral_facial guardaba una "distancia euclidea maxima" con default 0.4,
-- pero @vladmandic/human no trabaja en esa escala: su distancia es
-- 25*suma((a-b)^2) y su similitud va normalizada de 0 a 1. Un 0.4 leido como
-- similitud significaria algo completamente distinto de lo que se quiso
-- configurar, asi que la columna se reemplaza en vez de convertirse: el valor
-- viejo no tiene traduccion posible al nuevo significado.
ALTER TABLE "configuracion" DROP COLUMN "umbral_facial";

ALTER TABLE "configuracion"
  ADD COLUMN "similitud_minima" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
