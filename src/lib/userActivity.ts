import { prisma } from "./prisma";

/** Met à jour lastActiveAt pour le MAU (fire-and-forget). */
export function touchUserActivity(supabaseId: string): void {
  void prisma.user
    .updateMany({
      where: { supabaseId },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {});
}

/** Utilisateurs actifs sur les 30 derniers jours. */
export async function utilisateursActifsMensuels(
  userIds?: string[],
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  return prisma.user.count({
    where: {
      lastActiveAt: { gte: since },
      ...(userIds ? { id: { in: userIds } } : {}),
    },
  });
}
