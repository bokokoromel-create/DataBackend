import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";

/**
 * Exige `Authorization: Bearer <JWT access token Supabase>`.
 * Valide le jeton via le SDK (client service role) ; le `sub`/`id` correspond au compte participant.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({
      message: "Non authentifié : en-tête Authorization Bearer manquant.",
      error: "MISSING_BEARER",
    });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({
      message:
        error?.message ??
        "Jeton invalide ou expiré. Reconnecte-toi via signInWithPassword (ou refresh).",
      error: "INVALID_OR_EXPIRED_TOKEN",
    });
  }

  (req as Request & { supabaseUser: NonNullable<typeof data.user> }).supabaseUser =
    data.user;
  next();
}
