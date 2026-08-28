import { Router, type Request } from "express";
import { Prisma, type AdminUser } from "@prisma/client";
import {
  statutDepuisReponses,
  statutsOrdonnesAggre,
} from "../../admin/participantStatut";
import {
  aggreStatsQuestionnaires,
  besoinPrincipalDepuisReponses,
  obstaclesDepuisReponses,
} from "../../admin/questionnaireAggre";
import { aggreParThematique } from "../../admin/thematiquesAggre";
import {
  exportFilterFromQuery,
  matchesNiveauEtudeFilter,
} from "../../lib/exportDemographics";
import { niveauEtudeDepuisReponses } from "../../lib/questionnaireFields";
import { utilisateursActifsMensuels } from "../../lib/userActivity";
import { adminRegisterInvalidBody } from "../../lib/exampleCurls";
import { prisma } from "../../lib/prisma";
import { signInUserWithPassword, supabase } from "../../lib/supabase";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import type {
  AdminPatchProfil,
  DonneesInscriptionAdmin,
} from "../../types/front-contract";
import { broadcast } from "../../events/sse";
import evenementsRoutes from "./evenements";
import sondagesRoutes from "./sondages";
import diplomesRoutes from "./diplomes";
import opportunitesRoutes from "./opportunites";
import rapportsRoutes from "./rapports";
import zonesRoutes from "./zones";
import carteRoutes from "./carte";

const router = Router();

router.use("/evenements", evenementsRoutes);
router.use("/sondages", sondagesRoutes);
router.use("/diplomes", diplomesRoutes);
router.use("/opportunites", opportunitesRoutes);
router.use("/rapports", rapportsRoutes);
router.use("/zones", zonesRoutes);
router.use("/carte", carteRoutes);

router.post("/register", async (req, res) => {
  if (
    req.body == null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json(adminRegisterInvalidBody());
  }

  const {
    nomComplet,
    email,
    motDePasse,
    nomOrganisation,
    fonctionPoste,
    secteurInteret,
  } = req.body as DonneesInscriptionAdmin;

  const { data: authData, error } = await supabase.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });

  if (error) {
    return res.status(400).json({ message: error.message, error: "AUTH_CREATE" });
  }

  try {
    const admin = await prisma.adminUser.create({
      data: {
        supabaseId: authData.user.id,
        nomComplet,
        email,
        nomOrganisation,
        fonctionPoste,
        secteurInteret,
      },
    });

    return res.status(201).json({ id: admin.id });
  } catch (err: unknown) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1000") {
      return res.status(500).json({
        message:
          "Connexion base de données impossible (identifiants invalides). Mets à jour DATABASE_URL/DIRECT_URL (Supabase) sur le serveur.",
        error: "DB_AUTH_FAILED",
      });
    }
    console.error(err);
    return res.status(500).json({
      message:
        "Impossible d'enregistrer l'admin en base de données.",
      error: "PRISMA_CREATE",
    });
  }
});

// Login admin (front expects { access_token: "..." })
router.post("/login", async (req, res) => {
  if (
    req.body == null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(422).json({
      message:
        "Body invalide. Attendu: { email: string, motDePasse: string }",
      error: "INVALID_BODY",
    });
  }

  const { email, motDePasse } = req.body as {
    email?: unknown;
    motDePasse?: unknown;
  };

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof motDePasse !== "string" ||
    !motDePasse
  ) {
    return res.status(422).json({
      message:
        "Champs requis: email (string) et motDePasse (string).",
      error: "VALIDATION_MISSING_FIELDS",
    });
  }

  const { data, error } = await signInUserWithPassword(
    email.trim(),
    motDePasse,
  );

  if (error || !data.session || !data.user) {
    return res.status(401).json({
      message: error?.message ?? "Identifiants invalides.",
      error: "INVALID_CREDENTIALS",
    });
  }

  let adminRow: AdminUser | null = null;
  try {
    adminRow = await prisma.adminUser.findUnique({
      where: { supabaseId: data.user.id },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1000") {
      return res.status(500).json({
        message:
          "Connexion base de données impossible (identifiants invalides). Mets à jour DATABASE_URL/DIRECT_URL (Supabase) sur le serveur.",
        error: "DB_AUTH_FAILED",
      });
    }
    console.error(err);
    return res.status(500).json({
      message: "Erreur serveur lors de la vérification admin.",
      error: "ADMIN_LOOKUP_FAILED",
    });
  }
  if (!adminRow) {
    return res.status(403).json({
      message: "Accès réservé aux administrateurs.",
      error: "FORBIDDEN_NOT_ADMIN",
    });
  }

  return res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
  });
});

/** Invalide la session courante (refresh tokens). Le JWT access reste valide jusqu’à `exp`. */
router.post("/logout", requireAuth, requireAdmin, async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({
      message: "Non authentifié : en-tête Authorization Bearer manquant.",
      error: "MISSING_BEARER",
    });
  }

  const { error } = await supabase.auth.admin.signOut(token, "local");
  if (error) {
    return res.status(400).json({
      message: error.message,
      error: "LOGOUT_FAILED",
    });
  }

  return res.status(204).send();
});

/** Paramètres admin : Bearer obligatoire (alignement prod) + compte existant dans `AdminUser`. */
router.patch("/me", requireAuth, requireAdmin, async (req, res) => {
  if (
    req.body == null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      message:
        "Corps JSON invalide ou absent. En-tête Content-Type: application/json requis.",
      error: "INVALID_BODY",
    });
  }

  const {
    nomComplet,
    email,
    nomOrganisation,
    fonctionPoste,
    secteurInteret,
    motDePasse,
  } = req.body as AdminPatchProfil;

  const champsManquants = [
    ["nomComplet", nomComplet],
    ["email", email],
    ["nomOrganisation", nomOrganisation],
    ["fonctionPoste", fonctionPoste],
    ["secteurInteret", secteurInteret],
  ].filter(([, v]) => typeof v !== "string" || !String(v).trim());

  if (champsManquants.length > 0) {
    return res.status(400).json({
      message: `Champs obligatoires manquants ou vides : ${champsManquants.map(([n]) => n).join(", ")}.`,
      error: "VALIDATION_MISSING_FIELDS",
      champsManquants: champsManquants.map(([n]) => n),
    });
  }

  const admin = (req as Request & { adminUser: AdminUser }).adminUser;

  const authPayload: { email?: string; password?: string } = {};

  const emailNormalized = email.trim();

  const passwordChangeRequested =
    typeof motDePasse === "string" && motDePasse.length > 0;

  if (emailNormalized !== admin.email) {
    authPayload.email = emailNormalized;
  }
  if (passwordChangeRequested) {
    authPayload.password = motDePasse as string;
  }

  if (Object.keys(authPayload).length > 0) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(
      admin.supabaseId,
      authPayload,
    );
    if (authErr) {
      return res.status(400).json({
        message: authErr.message,
        error: "AUTH_UPDATE",
      });
    }
  }

  try {
    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        nomComplet: nomComplet.trim(),
        email: emailNormalized,
        nomOrganisation: nomOrganisation.trim(),
        fonctionPoste: fonctionPoste.trim(),
        secteurInteret: secteurInteret.trim(),
      },
    });

    const { supabaseId: _supabaseId, ...publicAdmin } = updated;
    void _supabaseId;
    broadcast(
      {
        type: "admin.profile.updated",
        data: { reason: "admin profile updated" },
      },
      { scope: "admin" },
    );
    return res.json(publicAdmin);
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res.status(409).json({
        message:
          "Cet e-mail est déjà utilisé par un autre compte (doublon en base).",
        error: "EMAIL_CONFLICT",
        meta: err.meta ?? undefined,
      });
    }
    console.error(err);
    return res.status(500).json({
      message: "Mise à jour du profil administrateur impossible.",
      error: "PRISMA_UPDATE",
    });
  }
});

/** Export agrégé (tous utilisateurs depuis la BDD). Auth admin comme `PATCH /admin/me`. */
router.get("/export", requireAuth, requireAdmin, async (req, res) => {
  const { filter, prismaWhere, error } = exportFilterFromQuery(
    req.query as Record<string, unknown>,
  );
  if (error) {
    return res.status(422).json({ message: error, error: "INVALID_QUERY" });
  }

  const users = await prisma.user.findMany({
    where: prismaWhere,
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      ville: true,
      arrondissement: true,
      age: true,
      sexe: true,
      createdAt: true,
      questionnaire: {
        select: { createdAt: true, reponses: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const nombreParStatut: Record<string, number> = {};
  for (const s of statutsOrdonnesAggre()) {
    nombreParStatut[s] = 0;
  }

  const participants = users
    .map((u) => {
      const reponses = u.questionnaire?.reponses ?? null;
      const statut = u.questionnaire
        ? statutDepuisReponses(reponses)
        : "Non renseigné";

      const besoinPrincipal = besoinPrincipalDepuisReponses(reponses);
      const obstaclesArr = obstaclesDepuisReponses(reponses);
      const niveauEtude = niveauEtudeDepuisReponses(reponses);
      const inscriptionAt = u.createdAt.toISOString();

      return {
        idParticipant: u.id,
        prenom: u.prenom,
        nom: u.nom,
        email: u.email,
        ville: u.ville,
        arrondissement: u.arrondissement,
        age: u.age,
        sexe: u.sexe,
        niveauEtude,
        statut,
        besoinPrincipal,
        obstacles: obstaclesArr,
        obstaclesText: obstaclesArr.join(" ; "),
        inscriptionAt,
        enregistreLe: inscriptionAt,
        questionnaireSoumisAt: u.questionnaire?.createdAt.toISOString() ?? null,
        questionnaireComplet: Boolean(
          reponses && (besoinPrincipal || (statut && statut !== "Non renseigné")),
        ),
        // Forme imbriquée acceptée par certains fronts (MAJ-2026-08-23)
        questionnaire: u.questionnaire
          ? {
              reponses: {
                statut,
                niveauEtude,
                besoinPrincipal,
                obstacles: obstaclesArr,
                ...(typeof reponses === "object" &&
                reponses &&
                !Array.isArray(reponses)
                  ? (reponses as Record<string, unknown>)
                  : {}),
              },
              soumisAt: u.questionnaire.createdAt.toISOString(),
            }
          : null,
      };
    })
    .filter((p) => matchesNiveauEtudeFilter(p.niveauEtude, filter.niveauEtude));

  for (const p of participants) {
    nombreParStatut[p.statut] = (nombreParStatut[p.statut] ?? 0) + 1;
  }

  const parStatut = statutsOrdonnesAggre().map((statut) => ({
    statut,
    nombre: nombreParStatut[statut] ?? 0,
  }));

  return res.json({
    message: "ok",
    generatedAt: new Date().toISOString(),
    parStatut,
    participants,
    note:
      'Le champ statut déduit utilise les clés fréquentes dans `Questionnaire.reponses` (statutProfessionnel, situationProfessionnelle, etc.). Sinon "Non renseigné".',
  });
});

router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  const { filter, prismaWhere, error } = exportFilterFromQuery(
    req.query as Record<string, unknown>,
  );
  if (error) {
    return res.status(422).json({ message: error, error: "INVALID_QUERY" });
  }

  const users = await prisma.user.findMany({
    where: prismaWhere,
    select: {
      id: true,
      ville: true,
      diplome: { select: { id: true } },
      questionnaire: { select: { reponses: true } },
    },
  });

  const filtered = users.filter((u) =>
    matchesNiveauEtudeFilter(
      niveauEtudeDepuisReponses(u.questionnaire?.reponses ?? null),
      filter.niveauEtude,
    ),
  );

  const questionnaires = filtered
    .filter((u) => u.questionnaire)
    .map((u) => ({
      ville: u.ville,
      reponses: u.questionnaire!.reponses,
    }));

  const detail = aggreStatsQuestionnaires(questionnaires);
  const parThematique = aggreParThematique(
    filtered
      .filter((u) => u.questionnaire)
      .map((u) => ({ reponses: u.questionnaire!.reponses })),
  );

  const parVilleMap = new Map<string, number>();
  for (const u of filtered) {
    const ville = u.ville.trim() || "Non renseigné";
    parVilleMap.set(ville, (parVilleMap.get(ville) ?? 0) + 1);
  }

  const parVille = [...parVilleMap.entries()]
    .map(([ville, count]) => ({ ville, count }))
    .sort((a, b) => a.ville.localeCompare(b.ville, "fr"));

  const mau = await utilisateursActifsMensuels(
    Object.keys(filter).length > 0 || filtered.length !== users.length
      ? filtered.map((u) => u.id)
      : undefined,
  );

  return res.json({
    totalUsers: filtered.length,
    totalQuestionnaires: detail.totalQuestionnairesActifs,
    totalDiplomes: filtered.filter((u) => u.diplome).length,
    parVille,
    totalObstaclesSelectionnes: detail.totalObstaclesSelectionnes,
    besoinsParType: detail.besoinsParType,
    prioritesParZone: detail.prioritesParZone,
    utilisateursActifsMensuels: mau,
    parThematique,
  });
});

export default router;
