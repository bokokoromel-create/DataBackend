-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "debutAt" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sondage" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sondage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SondageReponse" (
    "id" TEXT NOT NULL,
    "sondageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SondageReponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SondageReponse_sondageId_userId_key" ON "SondageReponse"("sondageId", "userId");

-- AddForeignKey
ALTER TABLE "SondageReponse" ADD CONSTRAINT "SondageReponse_sondageId_fkey" FOREIGN KEY ("sondageId") REFERENCES "Sondage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SondageReponse" ADD CONSTRAINT "SondageReponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
