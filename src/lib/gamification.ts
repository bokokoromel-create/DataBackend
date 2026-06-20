import { prisma } from "./prisma";
import { questionnaireEstComplet } from "./questionnaireFields";

export type GamificationBadge = {
  id: string;
  label: string;
  obtenu: boolean;
};

export async function ensureGamification(userId: string) {
  return prisma.userGamification.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export function parseMembresInvites(reponses: unknown): number {
  if (!reponses || typeof reponses !== "object" || Array.isArray(reponses)) {
    return 0;
  }
  const raw = (reponses as Record<string, unknown>).nombreInvites;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

export async function syncMembresInvitesFromQuestionnaire(userId: string): Promise<void> {
  const q = await prisma.questionnaire.findUnique({
    where: { userId },
    select: { reponses: true },
  });
  if (!q) return;
  const n = parseMembresInvites(q.reponses);
  await ensureGamification(userId);
  await prisma.userGamification.update({
    where: { userId },
    data: { membresInvites: n },
  });
}

export function computeBadges(input: {
  questionnaireComplet: boolean;
  diplomeVerifie: boolean;
  publicationsConsultees: number;
  consultationsCompletees: number;
  membresInvites: number;
}): GamificationBadge[] {
  return [
    {
      id: "profil_certifie",
      label: "Profil certifié",
      obtenu: input.questionnaireComplet,
    },
    {
      id: "diplome_depose",
      label: "Diplôme déposé",
      obtenu: input.diplomeVerifie,
    },
    {
      id: "lecteur_assidu",
      label: "Lecteur assidu",
      obtenu: input.publicationsConsultees >= 5,
    },
    {
      id: "citoyen_actif",
      label: "Citoyen actif",
      obtenu: input.consultationsCompletees >= 1,
    },
    {
      id: "ambassadeur",
      label: "Ambassadeur",
      obtenu: input.membresInvites >= 1,
    },
  ];
}

export async function recordPublicationView(
  userId: string,
  publicationId: string,
): Promise<void> {
  const row = await ensureGamification(userId);
  if (row.publicationsConsultees.includes(publicationId)) return;
  await prisma.userGamification.update({
    where: { userId },
    data: {
      publicationsConsultees: { push: publicationId },
    },
  });
}

export async function recordConsultationCompletee(userId: string): Promise<void> {
  await ensureGamification(userId);
  await prisma.userGamification.update({
    where: { userId },
    data: { consultationsCompletees: { increment: 1 } },
  });
}

export async function getGamificationPayload(userId: string) {
  const [gamification, user] = await Promise.all([
    ensureGamification(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        diplome: { select: { id: true } },
        questionnaire: { select: { reponses: true } },
      },
    }),
  ]);

  const questionnaireComplet = questionnaireEstComplet(
    user?.questionnaire?.reponses ?? null,
  );

  const badges = computeBadges({
    questionnaireComplet,
    diplomeVerifie: Boolean(user?.diplome),
    publicationsConsultees: gamification.publicationsConsultees.length,
    consultationsCompletees: gamification.consultationsCompletees,
    membresInvites: gamification.membresInvites,
  });

  return {
    publicationsConsultees: gamification.publicationsConsultees.length,
    consultationsCompletees: gamification.consultationsCompletees,
    membresInvites: gamification.membresInvites,
    badges,
  };
}
