import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import { aggreStatsQuestionnaires } from "../src/admin/questionnaireAggre";

async function main() {
  const [totalUsers, totalDiplomes, questionnaires] = await Promise.all([
    prisma.user.count(),
    prisma.diplome.count(),
    prisma.questionnaire.findMany({
      select: { reponses: true, user: { select: { ville: true } } },
    }),
  ]);

  const detail = aggreStatsQuestionnaires(
    questionnaires.map((q) => ({ ville: q.user.ville, reponses: q.reponses })),
  );

  console.log(
    JSON.stringify(
      {
        totalUsers,
        totalQuestionnaires: detail.totalQuestionnairesActifs,
        totalDiplomes,
        totalObstaclesSelectionnes: detail.totalObstaclesSelectionnes,
        besoinsParType: detail.besoinsParType,
        prioritesParZone: detail.prioritesParZone,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
