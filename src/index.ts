import "./loadEnv";
import express from "express";
import cors from "cors";
import { readEnv } from "./lib/envRead";
import authRoutes from "./routes/auth";
import inscriptionRoutes from "./routes/inscription";
import profilRoutes from "./routes/profil";
import questionnaireRoutes from "./routes/questionnaire";
import adminRoutes from "./routes/admin/index";
import meEvenementsRoutes from "./routes/me/evenements";
import meSondagesRoutes from "./routes/me/sondages";
import meDiplomeRoutes from "./routes/me/diplome";
import { attachSseClient } from "./events/sse";
import { supabase } from "./lib/supabase";
import { prisma } from "./lib/prisma";

const app = express();

const corsOrigin =
  readEnv("CORS_ORIGIN") ||
  readEnv("FRONTEND_URL") ||
  "http://localhost:3000";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: readEnv("JSON_BODY_LIMIT") || "1mb" }));

const API_VERSION = "1.0.1";

app.get("/", (_req, res) => {
  res.json({
    message: "Data Horizon API",
    status: "online",
    version: API_VERSION,
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: API_VERSION });
});

app.use("/auth", authRoutes);
app.use("/inscription", inscriptionRoutes);
app.use("/me", profilRoutes);
app.use("/me/questionnaire", questionnaireRoutes);
app.use("/me/evenements", meEvenementsRoutes);
app.use("/me/sondages", meSondagesRoutes);
app.use("/me/diplome", meDiplomeRoutes);
app.use("/admin", adminRoutes);

// JSON parse errors should return JSON (not HTML) for the frontend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "JSON invalide. Vérifie le Content-Type et le corps de requête.",
      error: "INVALID_JSON",
    });
  }
  return next(err);
});

// SSE (front listens on GET /events)
// Auth strategy:
// - Dev: allow unauthenticated (scope=public)
// - Prod: require admin Bearer token (scope=admin) for dashboard live updates
app.get("/events", async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const wantsAdmin = String(req.query.scope || "").toLowerCase() === "admin";

  if (!isProd && !wantsAdmin) {
    attachSseClient(req, res, "public");
    return;
  }

  // EventSource cannot send custom headers reliably from the browser,
  // so we accept a token in query string for now: /events?token=...&scope=admin
  // Le proxy Next relaie aussi `access_token` ou `Authorization: Bearer`.
  const authHeader = req.headers.authorization ?? "";
  const bearer =
    authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token =
    (typeof req.query.token === "string" ? req.query.token : "") ||
    (typeof req.query.access_token === "string" ? req.query.access_token : "") ||
    bearer;
  if (!token) {
    res.status(401).json({
      message:
        "Non authentifié : token manquant. En prod, utilisez /events?scope=admin&token=<ACCESS_TOKEN>.",
      error: "MISSING_TOKEN_QUERY",
    });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({
      message:
        error?.message ??
        "Jeton invalide ou expiré. Reconnecte-toi côté front.",
      error: "INVALID_OR_EXPIRED_TOKEN",
    });
    return;
  }

  const adminRow = await prisma.adminUser.findUnique({
    where: { supabaseId: data.user.id },
  });
  if (!adminRow) {
    res.status(403).json({
      message: "Accès réservé aux administrateurs.",
      error: "FORBIDDEN_NOT_ADMIN",
    });
    return;
  }

  attachSseClient(req, res, "admin");
});

const PORT = readEnv("PORT") || 4000;
app.listen(PORT, () => console.log(`Backend démarré sur le port ${PORT}`));
