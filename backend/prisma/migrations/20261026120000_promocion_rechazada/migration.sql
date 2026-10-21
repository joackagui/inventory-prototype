-- AlterEnum
ALTER TYPE "EstadoPromocion" ADD VALUE 'RECHAZADA';

-- AlterTable
ALTER TABLE "Promocion" ADD COLUMN     "comentarioResolucion" TEXT,
ADD COLUMN     "rechazadaPorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_rechazadaPorId_fkey" FOREIGN KEY ("rechazadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

