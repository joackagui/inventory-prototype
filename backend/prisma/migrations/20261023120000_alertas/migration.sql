-- CreateEnum
CREATE TYPE "TipoHistorialAlerta" AS ENUM ('CREADA', 'CAMBIO_COLOR', 'ATENDIDA', 'ESCALADA', 'RESUELTA');

-- CreateEnum
CREATE TYPE "EstadoEventoIntegracion" AS ENUM ('REINTENTO', 'COLA_ERRORES', 'PROCESADO');

-- AlterEnum
ALTER TYPE "EstadoAlerta" ADD VALUE 'RESUELTA';

-- AlterEnum
ALTER TYPE "EstadoPromocion" ADD VALUE 'PROPUESTA';

-- AlterEnum
ALTER TYPE "MotivoAjuste" ADD VALUE 'DIFERENCIA_RECEPCION';

-- DropForeignKey
ALTER TABLE "Alerta" DROP CONSTRAINT "Alerta_almacenId_fkey";

-- AlterTable
ALTER TABLE "AjusteInventario" ADD COLUMN     "ordenTrasladoId" INTEGER;

-- AlterTable
ALTER TABLE "Alerta" ADD COLUMN     "accionSugerida" TEXT NOT NULL,
ADD COLUMN     "clave" TEXT NOT NULL,
ADD COLUMN     "comentario" TEXT,
ADD COLUMN     "datos" JSONB NOT NULL,
ADD COLUMN     "fechaAtencion" DATE,
ADD COLUMN     "fechaColor" DATE NOT NULL,
ADD COLUMN     "fechaResolucion" DATE,
ADD COLUMN     "nivelEscalamiento" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referenciaId" INTEGER,
ADD COLUMN     "referenciaTipo" TEXT NOT NULL,
ADD COLUMN     "rolesResponsables" TEXT[],
ALTER COLUMN "almacenId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Promocion" ADD COLUMN     "aprobadoPorId" INTEGER,
ADD COLUMN     "propuestaPorId" INTEGER,
ADD COLUMN     "referenciaCorreo" TEXT;

-- CreateTable
CREATE TABLE "HistorialAlerta" (
    "id" SERIAL NOT NULL,
    "alertaId" INTEGER NOT NULL,
    "tipo" "TipoHistorialAlerta" NOT NULL,
    "colorAnterior" "ColorAlerta",
    "colorNuevo" "ColorAlerta",
    "nivel" INTEGER,
    "detalle" TEXT,
    "usuarioId" INTEGER,
    "fechaOperacion" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoIntegracion" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "estado" "EstadoEventoIntegracion" NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 1,
    "fechaOperacion" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesadoEn" TIMESTAMP(3),

    CONSTRAINT "EventoIntegracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alerta_clave_idx" ON "Alerta"("clave");

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_ordenTrasladoId_fkey" FOREIGN KEY ("ordenTrasladoId") REFERENCES "OrdenTraslado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_propuestaPorId_fkey" FOREIGN KEY ("propuestaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAlerta" ADD CONSTRAINT "HistorialAlerta_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "Alerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAlerta" ADD CONSTRAINT "HistorialAlerta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Una sola alerta abierta por clave; las RESUELTA quedan como historial (el valor nuevo del enum no se puede usar en la misma transacción).
CREATE UNIQUE INDEX "Alerta_clave_abierta_key" ON "Alerta"("clave") WHERE "estado" IN ('ABIERTA', 'ATENDIDA');
