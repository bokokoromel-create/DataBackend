import type { NextFunction, Request, Response } from "express";
import type { AdminUser } from "@prisma/client";
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

  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (!adminUser) {
    return res.status(403).json({
      message: "Accès réservé aux administrateurs.",
      error: "FORBIDDEN_NOT_ADMIN",
    });
  }

  (req as Request & { adminUser: AdminUser }).adminUser = adminUser;
  next();
}
