import { Router } from "express";
import {
  besoinPrincipalDepuisReponses,
  obstaclesDepuisReponses,
} from "../../admin/questionnaireAggre";
import { statutDepuisReponses } from "../../admin/participantStatut";
import { aggreParThematique } from "../../admin/thematiquesAggre";
import { aggreStatsQuestionnaires } from "../../admin/questionnaireAggre";
import { niveauEtudeDepuisReponses } from "../../lib/questionnaireFields";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";

const router = Router();

function parsePeriode(periode: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periode);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return { start, end };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

router.get("/:periode", requireAuth, requireAdmin, async (req, res) => {
  const periode = String(req.params.periode);
  const range = parsePeriode(periode);
  if (!range) {
    return res.status(422).json({
      message: "Période invalide (attendu YYYY-MM, ex. 2026-06).",
      error: "INVALID_PERIODE",
    });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { createdAt: { gte: range.start, lte: range.end } },
        { questionnaire: { createdAt: { gte: range.start, lte: range.end } } },
      ],
    },
    select: {
      prenom: true,
      nom: true,
      email: true,
      ville: true,
      arrondissement: true,
      age: true,
      sexe: true,
      createdAt: true,
      questionnaire: { select: { reponses: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "email",
    "prenom",
    "nom",
    "ville",
    "arrondissement",
    "age",
    "sexe",
    "enregistreLe",
    "statut",
    "niveauEtude",
    "besoinPrincipal",
    "obstacles",
  ];

  const lines = [headers.join(",")];
  for (const u of users) {
    const reponses = u.questionnaire?.reponses ?? null;
    const obstacles = obstaclesDepuisReponses(reponses);
    lines.push(
      [
        u.email,
        u.prenom,
        u.nom,
        u.ville,
        u.arrondissement ?? "",
        u.age != null ? String(u.age) : "",
        u.sexe ?? "",
        u.createdAt.toISOString(),
        u.questionnaire ? statutDepuisReponses(reponses) : "Non renseigné",
        niveauEtudeDepuisReponses(reponses),
        besoinPrincipalDepuisReponses(reponses),
        obstacles.join(" ; "),
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }

  const questionnaires = users
    .filter((u) => u.questionnaire)
    .map((u) => ({ reponses: u.questionnaire!.reponses }));

  const statsDetail = aggreStatsQuestionnaires(
    users
      .filter((u) => u.questionnaire)
      .map((u) => ({ ville: u.ville, reponses: u.questionnaire!.reponses })),
  );
  const parThematique = aggreParThematique(questionnaires);

  lines.push("");
  lines.push("Statistiques période");
  lines.push(`Inscriptions,${users.length}`);
  lines.push(`Questionnaires actifs,${statsDetail.totalQuestionnairesActifs}`);
  lines.push(`Obstacles sélectionnés,${statsDetail.totalObstaclesSelectionnes}`);
  for (const t of parThematique) {
    lines.push(`${csvEscape(t.thematique)},${t.count}`);
  }

  const csv = `\uFEFF${lines.join("\r\n")}`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="rapport-${periode}.csv"`,
  );
  return res.send(csv);
});

export default router;
