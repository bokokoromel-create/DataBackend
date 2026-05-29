import "../src/loadEnv";
import { prisma } from "../src/lib/prisma";
import {
  besoinPrincipalDepuisReponses,
  obstaclesDepuisReponses,
} from "../src/admin/questionnaireAggre";

async function main() {
  const total = await prisma.questionnaire.count();
  console.log("Questionnaires en base:", total);

  const rows = await prisma.questionnaire.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      reponses: true,
      user: { select: { email: true, ville: true } },
    },
  });

  for (const r of rows) {
    const rep = r.reponses as Record<string, unknown> | null;
    const keys = rep && typeof rep === "object" ? Object.keys(rep) : [];
    console.log("\n--- ", r.user.email, "(", r.user.ville, ")");
    console.log("  clés JSON:", keys.join(", ") || "(vide)");
    console.log("  besoinPrincipal détecté:", JSON.stringify(besoinPrincipalDepuisReponses(rep)));
    console.log("  obstacles détectés:", JSON.stringify(obstaclesDepuisReponses(rep)));
    console.log("  reponses brut:", JSON.stringify(rep));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
