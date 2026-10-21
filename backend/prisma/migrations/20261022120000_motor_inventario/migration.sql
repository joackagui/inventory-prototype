-- CreateEnum
CREATE TYPE "EstadoRecepcion" AS ENUM ('CONFORME', 'DANADO');

-- AlterTable
ALTER TABLE "AjusteInventario" ADD COLUMN     "capaId" INTEGER;

-- AlterTable
ALTER TABLE "CapaFifo" ADD COLUMN     "ordenTrasladoId" INTEGER;

-- AlterTable
ALTER TABLE "ConteoFisico" ADD COLUMN     "requiereRecuento" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LineaPedido" ADD COLUMN     "bonificacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promocionId" INTEGER;

-- AlterTable
ALTER TABLE "LineaTraslado" ADD COLUMN     "estadoRecepcion" "EstadoRecepcion";

-- AlterTable
-- L por artículo y almacén (sección 4); se inicializa con el L del almacén.
ALTER TABLE "ParametroArticuloAlmacen" ADD COLUMN     "leadTimeDias" INTEGER;
UPDATE "ParametroArticuloAlmacen" p SET "leadTimeDias" = a."leadTimeDias" FROM "Almacen" a WHERE a.id = p."almacenId";
ALTER TABLE "ParametroArticuloAlmacen" ALTER COLUMN "leadTimeDias" SET NOT NULL;

-- AlterTable
ALTER TABLE "PedidoSimulado" ADD COLUMN     "fechaDespacho" DATE;

-- AlterTable
ALTER TABLE "Promocion" ADD COLUMN     "capaId" INTEGER;

-- AddForeignKey
ALTER TABLE "CapaFifo" ADD CONSTRAINT "CapaFifo_ordenTrasladoId_fkey" FOREIGN KEY ("ordenTrasladoId") REFERENCES "OrdenTraslado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPedido" ADD CONSTRAINT "LineaPedido_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CapaFifo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CapaFifo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

