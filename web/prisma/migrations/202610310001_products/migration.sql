CREATE TYPE "ProductType" AS ENUM ('SOFTWARE', 'SERVICE', 'ADDON');

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'SOFTWARE',
    "salesPriceMinor" INTEGER NOT NULL,
    "costPriceMinor" INTEGER NOT NULL,
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_name_not_blank" CHECK (length(trim("name")) > 0),
    CONSTRAINT "Product_salesPriceMinor_range" CHECK ("salesPriceMinor" BETWEEN 0 AND 2000000000),
    CONSTRAINT "Product_costPriceMinor_range" CHECK ("costPriceMinor" BETWEEN 0 AND 2000000000)
);

CREATE INDEX "Product_createdAt_id_idx" ON "Product"("createdAt", "id");
