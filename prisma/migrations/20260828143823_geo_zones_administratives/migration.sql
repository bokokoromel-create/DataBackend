-- CreateEnum
CREATE TYPE "TypeZoneAdministrative" AS ENUM ('SECTEUR', 'QUARTIER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "zoneAdministrativeId" TEXT;

-- CreateTable
CREATE TABLE "ZoneAdministrative" (
    "id" TEXT NOT NULL,
    "type" "TypeZoneAdministrative" NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "parentId" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneAdministrative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZoneAdministrative_parentId_idx" ON "ZoneAdministrative"("parentId");

-- CreateIndex
CREATE INDEX "ZoneAdministrative_ville_type_idx" ON "ZoneAdministrative"("ville", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneAdministrative_ville_type_nom_key" ON "ZoneAdministrative"("ville", "type", "nom");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_zoneAdministrativeId_fkey" FOREIGN KEY ("zoneAdministrativeId") REFERENCES "ZoneAdministrative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneAdministrative" ADD CONSTRAINT "ZoneAdministrative_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ZoneAdministrative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
