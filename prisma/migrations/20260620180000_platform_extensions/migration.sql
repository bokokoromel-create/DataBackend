-- User.lastActiveAt (MAU)
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- Evenement: image + catégorie
ALTER TABLE "Evenement" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Evenement" ADD COLUMN "categorie" TEXT;

-- Sondage.type
ALTER TABLE "Sondage" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'consultation';

-- Communauté (publications = Evenement)
CREATE TABLE "PublicationReaction" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationCommentaire" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicationCommentaire_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicationReaction_publicationId_userId_key"
ON "PublicationReaction"("publicationId", "userId");

ALTER TABLE "PublicationReaction" ADD CONSTRAINT "PublicationReaction_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationReaction" ADD CONSTRAINT "PublicationReaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationCommentaire" ADD CONSTRAINT "PublicationCommentaire_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationCommentaire" ADD CONSTRAINT "PublicationCommentaire_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Opportunités
CREATE TABLE "Opportunite" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "ville" TEXT,
    "echeanceAt" TIMESTAMP(3),
    "lien" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opportunite_pkey" PRIMARY KEY ("id")
);

-- Gamification
CREATE TABLE "UserGamification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicationsConsultees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consultationsCompletees" INTEGER NOT NULL DEFAULT 0,
    "membresInvites" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserGamification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserGamification_userId_key" ON "UserGamification"("userId");

ALTER TABLE "UserGamification" ADD CONSTRAINT "UserGamification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
