import type { NextFunction, Request, Response } from "express";
import { Prisma, type AdminUser } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * À utiliser après `requireAuth`.
 * Associe la ligne Prisma {@link AdminUser} au compte Bearer courant (`supabaseId`).
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const supabaseUser = (
    req as Request & {
      supabaseUser?: { id: string };
    }
  ).supabaseUser;

  if (!supabaseUser) {
    return res.status(500).json({
      message: "Configuration serveur invalide : requireAdmin sans utilisateur JWT.",
      error: "MISSING_SESSION",
    });
  }

  let adminUser: AdminUser | null = null;
  try {
    adminUser = await prisma.adminUser.findUnique({
      where: { supabaseId: supabaseUser.id },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1000") {
      return res.status(500).json({
        message:
          "Connexion base de données impossible (identifiants invalides). Vérifie DATABASE_URL/DIRECT_URL sur le serveur.",
        error: "DB_AUTH_FAILED",
      });
    }
    console.error(err);
    return res.status(500).json({
      message: "Erreur serveur lors de la vérification admin.",
      error: "ADMIN_LOOKUP_FAILED",
    });
  }

  if (!adminUser) {
    return res.status(403).json({
      message: "Accès réservé aux administrateurs.",
      error: "FORBIDDEN_NOT_ADMIN",
    });
  }

  (req as Request & { adminUser: AdminUser }).adminUser = adminUser;
  next();
}
