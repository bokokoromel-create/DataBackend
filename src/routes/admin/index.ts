import { Router, type Request } from "express";
import { Prisma, type AdminUser } from "@prisma/client";
import {
  statutDepuisReponses,
  statutsOrdonnesAggre,
} from "../../admin/participantStatut";
import { adminRegisterInvalidBody } from "../../lib/exampleCurls";
import { prisma } from "../../lib/prisma";
import { supabase } from "../../lib/supabase";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import type { AdminPatchProfil, DonneesInscriptionAdmin } from "../../types/front-contract";

type QuestionnaireExport = { createdAt: Date; reponses: unknown };
type UtilisateurPourExport = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  ville: string;
  createdAt: Date;
  questionnaire: QuestionnaireExport | null;
};
type AgregationParVille = { ville: string; _count: { id: number } };

const router = Router();

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
    console.error(err);
    return res.status(500).json({
      message:
        "Impossible d'enregistrer l'admin en base de données.",
      error: "PRISMA_CREATE",
    });
  }
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

    const { supabaseId: _s, ...publicAdmin } = updated;
    void _s;
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
router.get("/export", requireAuth, requireAdmin, async (_req, res) => {
  const users: UtilisateurPourExport[] = await prisma.user.findMany({
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      ville: true,
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

  const participants = users.map((u) => {
    const statut = u.questionnaire
      ? statutDepuisReponses(u.questionnaire.reponses)
      : "Non renseigné";

    nombreParStatut[statut] = (nombreParStatut[statut] ?? 0) + 1;

    return {
      idParticipant: u.id,
      prenom: u.prenom,
      nom: u.nom,
      email: u.email,
      ville: u.ville,
      statut,
      inscriptionAt: u.createdAt.toISOString(),
      questionnaireSoumisAt: u.questionnaire?.createdAt.toISOString() ?? null,
      questionnaireComplet: Boolean(u.questionnaire),
    };
  });

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

router.get("/stats", async (_req, res) => {
  const [totalUsers, totalQuestionnaires, parVille] = await Promise.all([
    prisma.user.count(),
    prisma.questionnaire.count(),
    prisma.user.groupBy({ by: ["ville"], _count: { id: true } }),
  ]);

  return res.json({
    totalUsers,
    totalQuestionnaires,
    parVille: parVille.map((v: AgregationParVille) => ({
      ville: v.ville,
      count: v._count.id,
    })),
  });
});

export default router;
