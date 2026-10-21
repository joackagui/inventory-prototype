-- CreateEnum
CREATE TYPE "TipoAlmacen" AS ENUM ('PLANTA', 'TRANSITO');

-- CreateEnum
CREATE TYPE "ClaseAbc" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "EstadoCapa" AS ENUM ('DISPONIBLE', 'CUARENTENA', 'AGOTADA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'RESERVA', 'LIBERACION_RESERVA', 'TRASLADO_SALIDA', 'TRASLADO_ENTRADA', 'AJUSTE', 'MERMA', 'CONTEO', 'CUARENTENA', 'ENVASE_ENTREGA', 'ENVASE_DEVOLUCION', 'BONIFICACION');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE_REVISION', 'CONFIRMADO', 'DESPACHADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoTraslado" AS ENUM ('EMITIDA', 'EN_TRANSITO', 'RECIBIDA', 'CON_DIFERENCIA');

-- CreateEnum
CREATE TYPE "TipoConteo" AS ENUM ('CICLICO', 'GENERAL');

-- CreateEnum
CREATE TYPE "MotivoAjuste" AS ENUM ('ROTURA', 'VENCIMIENTO', 'DIFERENCIA_CONTEO', 'PERDIDA_ROBO', 'ERROR_REGISTRO', 'PROMOCION');

-- CreateEnum
CREATE TYPE "EstadoAjuste" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoPromocion" AS ENUM ('DESCUENTO_FESTIVO', 'BONIFICACION', 'LIQUIDACION_VENCIMIENTO', 'ROTACION_EXCESO');

-- CreateEnum
CREATE TYPE "EstadoPromocion" AS ENUM ('BORRADOR', 'ACTIVA', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "ColorAlerta" AS ENUM ('AMARILLO', 'ROJO', 'AZUL');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('ABIERTA', 'ATENDIDA');

-- AlterTable
ALTER TABLE "Almacen" DROP CONSTRAINT "Almacen_pkey",
ADD COLUMN     "almacenTransitoId" INTEGER,
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "tipo" "TipoAlmacen" NOT NULL DEFAULT 'PLANTA',
ALTER COLUMN "leadTimeDias" SET DEFAULT 0,
ADD CONSTRAINT "Almacen_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" SERIAL NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "vendible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Articulo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "vidaUtilDias" INTEGER NOT NULL,
    "costoFifoInicial" DECIMAL(12,4) NOT NULL,
    "esRetornable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroArticuloAlmacen" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "demandaDiaria" INTEGER NOT NULL,
    "desviacionDemanda" DOUBLE PRECISION NOT NULL,
    "claseAbc" "ClaseAbc" NOT NULL,
    "nivelServicio" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,
    "diasRevision" INTEGER NOT NULL,
    "stockSeguridad" INTEGER NOT NULL,
    "rop" INTEGER NOT NULL,
    "loteTraslado" INTEGER NOT NULL,
    "stockMaximo" INTEGER NOT NULL,
    "ultimoConteo" DATE,

    CONSTRAINT "ParametroArticuloAlmacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rolCodigo" TEXT NOT NULL,
    "almacenId" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaFifo" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "lote" TEXT NOT NULL,
    "fechaEntrada" DATE NOT NULL,
    "fechaElaboracion" DATE NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "cantidadInicial" INTEGER NOT NULL,
    "cantidadRestante" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(12,4) NOT NULL,
    "estado" "EstadoCapa" NOT NULL DEFAULT 'DISPONIBLE',

    CONSTRAINT "CapaFifo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "capaId" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(12,4) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "fechaOperacion" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "documentoTipo" TEXT,
    "documentoId" INTEGER,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoSimulado" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "estado" "EstadoPedido" NOT NULL,
    "fechaOperacion" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "PedidoSimulado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaPedido" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "LineaPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenTraslado" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "origenId" INTEGER NOT NULL,
    "destinoId" INTEGER NOT NULL,
    "estado" "EstadoTraslado" NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "fechaDespacho" DATE,
    "fechaRecepcion" DATE,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "OrdenTraslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaTraslado" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidadDespachada" INTEGER NOT NULL,
    "cantidadRecibida" INTEGER,
    "observacion" TEXT,

    CONSTRAINT "LineaTraslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConteoFisico" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoConteo" NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "cantidadSistema" INTEGER NOT NULL,
    "cantidadContada" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "fechaOperacion" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConteoFisico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AjusteInventario" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "motivo" "MotivoAjuste" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "observacion" TEXT,
    "estado" "EstadoAjuste" NOT NULL DEFAULT 'PENDIENTE',
    "conteoId" INTEGER,
    "registradoPorId" INTEGER NOT NULL,
    "fechaRegistro" DATE NOT NULL,
    "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadoPorId" INTEGER,
    "fechaResolucion" DATE,

    CONSTRAINT "AjusteInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoEnvase" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "cantidadEntregada" INTEGER NOT NULL,
    "cantidadDevuelta" INTEGER NOT NULL DEFAULT 0,
    "fechaEntrega" DATE NOT NULL,

    CONSTRAINT "SaldoEnvase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promocion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPromocion" NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "almacenId" INTEGER,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "topeCajas" INTEGER NOT NULL,
    "cajasUsadas" INTEGER NOT NULL DEFAULT 0,
    "descuentoPct" DOUBLE PRECISION,
    "estado" "EstadoPromocion" NOT NULL,

    CONSTRAINT "Promocion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fiesta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "diasFiesta" INTEGER NOT NULL,
    "zonas" TEXT[],
    "factor" DOUBLE PRECISION NOT NULL,
    "semanasPreparacion" INTEGER NOT NULL,

    CONSTRAINT "Fiesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "color" "ColorAlerta" NOT NULL,
    "almacenId" INTEGER NOT NULL,
    "articuloId" INTEGER,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'ABIERTA',
    "fechaOperacion" DATE NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaPorId" INTEGER,
    "atendidaEn" TIMESTAMP(3),
    "resultado" TEXT,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionSistema" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "descripcion" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionSistema_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "RegistroCambio" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNuevo" JSONB,
    "fechaOperacion" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroCambio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ubicacion_almacenId_codigo_key" ON "Ubicacion"("almacenId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Articulo_codigo_key" ON "Articulo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroArticuloAlmacen_articuloId_almacenId_key" ON "ParametroArticuloAlmacen"("articuloId", "almacenId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_codigo_key" ON "Usuario"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_codigo_key" ON "Cliente"("codigo");

-- CreateIndex
CREATE INDEX "CapaFifo_articuloId_almacenId_estado_fechaEntrada_idx" ON "CapaFifo"("articuloId", "almacenId", "estado", "fechaEntrada");

-- CreateIndex
CREATE INDEX "Movimiento_articuloId_almacenId_fechaOperacion_idx" ON "Movimiento"("articuloId", "almacenId", "fechaOperacion");

-- CreateIndex
CREATE INDEX "Movimiento_capaId_idx" ON "Movimiento"("capaId");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoSimulado_numero_key" ON "PedidoSimulado"("numero");

-- CreateIndex
CREATE INDEX "PedidoSimulado_almacenId_estado_idx" ON "PedidoSimulado"("almacenId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTraslado_numero_key" ON "OrdenTraslado"("numero");

-- CreateIndex
CREATE INDEX "OrdenTraslado_estado_idx" ON "OrdenTraslado"("estado");

-- CreateIndex
CREATE INDEX "ConteoFisico_articuloId_almacenId_fechaOperacion_idx" ON "ConteoFisico"("articuloId", "almacenId", "fechaOperacion");

-- CreateIndex
CREATE INDEX "AjusteInventario_estado_idx" ON "AjusteInventario"("estado");

-- CreateIndex
CREATE INDEX "SaldoEnvase_clienteId_articuloId_idx" ON "SaldoEnvase"("clienteId", "articuloId");

-- CreateIndex
CREATE INDEX "Alerta_estado_almacenId_idx" ON "Alerta"("estado", "almacenId");

-- CreateIndex
CREATE UNIQUE INDEX "Almacen_codigo_key" ON "Almacen"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Almacen_almacenTransitoId_key" ON "Almacen"("almacenTransitoId");

-- AddForeignKey
ALTER TABLE "Almacen" ADD CONSTRAINT "Almacen_almacenTransitoId_fkey" FOREIGN KEY ("almacenTransitoId") REFERENCES "Almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ubicacion" ADD CONSTRAINT "Ubicacion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroArticuloAlmacen" ADD CONSTRAINT "ParametroArticuloAlmacen_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroArticuloAlmacen" ADD CONSTRAINT "ParametroArticuloAlmacen_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolCodigo_fkey" FOREIGN KEY ("rolCodigo") REFERENCES "Rol"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaFifo" ADD CONSTRAINT "CapaFifo_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaFifo" ADD CONSTRAINT "CapaFifo_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaFifo" ADD CONSTRAINT "CapaFifo_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CapaFifo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoSimulado" ADD CONSTRAINT "PedidoSimulado_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoSimulado" ADD CONSTRAINT "PedidoSimulado_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoSimulado" ADD CONSTRAINT "PedidoSimulado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPedido" ADD CONSTRAINT "LineaPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoSimulado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPedido" ADD CONSTRAINT "LineaPedido_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTraslado" ADD CONSTRAINT "OrdenTraslado_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTraslado" ADD CONSTRAINT "OrdenTraslado_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTraslado" ADD CONSTRAINT "OrdenTraslado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaTraslado" ADD CONSTRAINT "LineaTraslado_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTraslado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaTraslado" ADD CONSTRAINT "LineaTraslado_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoFisico" ADD CONSTRAINT "ConteoFisico_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoFisico" ADD CONSTRAINT "ConteoFisico_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoFisico" ADD CONSTRAINT "ConteoFisico_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoFisico" ADD CONSTRAINT "ConteoFisico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_conteoId_fkey" FOREIGN KEY ("conteoId") REFERENCES "ConteoFisico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteInventario" ADD CONSTRAINT "AjusteInventario_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEnvase" ADD CONSTRAINT "SaldoEnvase_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEnvase" ADD CONSTRAINT "SaldoEnvase_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEnvase" ADD CONSTRAINT "SaldoEnvase_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "Almacen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_atendidaPorId_fkey" FOREIGN KEY ("atendidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCambio" ADD CONSTRAINT "RegistroCambio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Libro mayor inmutable: los movimientos no se editan ni se borran (ver CLAUDE.md).
CREATE FUNCTION impedir_cambios_movimiento() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los movimientos de inventario son inmutables (% no permitido)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER movimiento_inmutable
  BEFORE UPDATE OR DELETE ON "Movimiento"
  FOR EACH ROW EXECUTE FUNCTION impedir_cambios_movimiento();
