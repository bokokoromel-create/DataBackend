import "./loadEnv";
import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { readEnv } from "./lib/envRead";
import inscriptionRoutes from "./routes/inscription";
import profilRoutes from "./routes/profil";
import questionnaireRoutes from "./routes/questionnaire";
import adminRoutes from "./routes/admin/index";
import meEvenementsRoutes from "./routes/me/evenements";
import meSondagesRoutes from "./routes/me/sondages";
import meDiplomeRoutes from "./routes/me/diplome";
import mePublicationsRoutes from "./routes/me/publications";
import meGamificationRoutes from "./routes/me/gamification";
import meOpportunitesRoutes from "./routes/me/opportunites";
import { attachSseClient } from "./events/sse";
import { supabase } from "./lib/supabase";
import { prisma } from "./lib/prisma";

const API_VERSION = "1.3.0";

const app = express();

const corsOrigin =
  readEnv("CORS_ORIGIN") ||
  readEnv("FRONTEND_URL") ||
  "http://localhost:3000";

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: readEnv("JSON_BODY_LIMIT") || "1mb" }));

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

app.use("/inscription", inscriptionRoutes);
app.use("/me", profilRoutes);
app.use("/me/questionnaire", questionnaireRoutes);
app.use("/me/evenements", meEvenementsRoutes);
app.use("/me/sondages", meSondagesRoutes);
app.use("/me/diplome", meDiplomeRoutes);
app.use("/me/publications", mePublicationsRoutes);
app.use("/me/gamification", meGamificationRoutes);
app.use("/me/opportunites", meOpportunitesRoutes);
app.use("/admin", adminRoutes);

const jsonParseErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (
    err &&
    typeof err === "object" &&
    (err as { type?: string }).type === "entity.parse.failed"
  ) {
    return res.status(400).json({
      message: "JSON invalide. Vérifie le Content-Type et le corps de requête.",
      error: "INVALID_JSON",
    });
  }
  return next(err);
};
app.use(jsonParseErrorHandler);

/**
 * SSE temps réel (`GET /events`).
 *
 * - Dev (`NODE_ENV !== "production"`) sans `scope=admin` → flux public ouvert.
 * - Sinon → flux admin protégé : le navigateur ne peut pas fixer d'en-tête
 *   `Authorization` sur `EventSource`, on accepte donc le JWT en query
 *   (`?scope=admin&token=...` ou `?access_token=...`), avec fallback Bearer
 *   pour les clients qui le supportent.
 */
async function handleSseRequest(req: Request, res: Response): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  const wantsAdmin = String(req.query.scope || "").toLowerCase() === "admin";

  if (!isProd && !wantsAdmin) {
    attachSseClient(req, res, "public");
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const token =
    (typeof req.query.token === "string" ? req.query.token : "") ||
    (typeof req.query.access_token === "string"
      ? req.query.access_token
      : "") ||
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
        error?.message ?? "Jeton invalide ou expiré. Reconnecte-toi côté front.",
      error: "INVALID_OR_EXPIRED_TOKEN",
    });
    return;
  }

  const adminRow = await prisma.adminUser.findUnique({
    where: { supabaseId: data.user.id },
    select: { id: true },
  });
  if (!adminRow) {
    res.status(403).json({
      message: "Accès réservé aux administrateurs.",
      error: "FORBIDDEN_NOT_ADMIN",
    });
    return;
  }

  attachSseClient(req, res, "admin");
}

app.get("/events", handleSseRequest);

const PORT = Number(readEnv("PORT") || 4000);

const server = app.listen(PORT);

server.on("listening", () => {
  const addr = server.address();
  const label =
    addr && typeof addr === "object"
      ? `${addr.address}:${addr.port}`
      : String(PORT);
  console.log(`Backend démarré sur le port ${PORT} (${label})`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Impossible de démarrer : le port ${PORT} est déjà utilisé par un autre processus.`,
    );
    console.error(
      `Windows : netstat -ano | findstr :${PORT}  puis  taskkill /PID <pid> /F`,
    );
  } else {
    console.error("Erreur au démarrage du serveur :", err.message);
  }
  process.exit(1);
});
