import { Router } from "express";
import { TypeZoneAdministrative, type Prisma } from "@prisma/client";
import {
  besoinPrincipalDepuisReponses,
  modeLabel,
} from "../../admin/questionnaireAggre";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import type { AdminCarteResponse, StatZoneCarte } from "../../types/front-contract";

const router = Router();

/** Zones sous ce seuil sont masquées et regroupées sous une pastille « Autres zones » (k-anonymat). */
const SEUIL_CONFIDENTIALITE = 3;

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Comptage d'utilisateurs par zone administrative (secteur/quartier), avec besoin
 * principal dominant par zone. Toujours agrégé : aucune coordonnée ni liste
 * nominative par zone n'est jamais renvoyée, uniquement des compteurs (MAJ carte admin).
 */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const ville = stringParam(req.query.ville);
  const secteurId = stringParam(req.query.secteurId);
  const quartierId = stringParam(req.query.quartierId);

  const where: Prisma.UserWhereInput = { zoneAdministrativeId: { not: null } };

  if (quartierId) {
    where.zoneAdministrativeId = quartierId;
  } else if (secteurId) {
    where.zoneAdministrative = {
      OR: [{ id: secteurId }, { parentId: secteurId }],
    };
  } else if (ville) {
    where.zoneAdministrative = { ville };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      zoneAdministrativeId: true,
      zoneAdministrative: {
        select: {
          id: true,
          type: true,
          nom: true,
          ville: true,
          parentId: true,
          latitude: true,
          longitude: true,
        },
      },
      questionnaire: { select: { reponses: true } },
    },
  });

  const totalUtilisateursNonLocalises = await prisma.user.count({
    where: {
      zoneAdministrativeId: null,
      ...(ville && !secteurId && !quartierId ? { ville } : {}),
    },
  });

  type Bucket = {
    zone: NonNullable<(typeof users)[number]["zoneAdministrative"]>;
    count: number;
    besoins: Map<string, number>;
  };
  const parZone = new Map<string, Bucket>();

  for (const u of users) {
    if (!u.zoneAdministrative) continue;
    const id = u.zoneAdministrative.id;
    if (!parZone.has(id)) {
      parZone.set(id, { zone: u.zoneAdministrative, count: 0, besoins: new Map() });
    }
    const bucket = parZone.get(id)!;
    bucket.count += 1;
    const besoin = besoinPrincipalDepuisReponses(u.questionnaire?.reponses ?? null);
    if (besoin) bucket.besoins.set(besoin, (bucket.besoins.get(besoin) ?? 0) + 1);
  }

  const zonesVisibles: StatZoneCarte[] = [];
  const regroupees: { count: number; besoins: Map<string, number> } = {
    count: 0,
    besoins: new Map(),
  };

  for (const bucket of parZone.values()) {
    if (bucket.count < SEUIL_CONFIDENTIALITE) {
      regroupees.count += bucket.count;
      for (const [label, n] of bucket.besoins) {
        regroupees.besoins.set(label, (regroupees.besoins.get(label) ?? 0) + n);
      }
      continue;
    }
    zonesVisibles.push({
      zoneId: bucket.zone.id,
      nom: bucket.zone.nom,
      type: bucket.zone.type === TypeZoneAdministrative.SECTEUR ? "SECTEUR" : "QUARTIER",
      ville: bucket.zone.ville,
      parentId: bucket.zone.parentId,
      latitude: bucket.zone.latitude,
      longitude: bucket.zone.longitude,
      count: bucket.count,
      besoinPrincipalDominant: modeLabel(bucket.besoins),
      zoneRegroupee: false,
    });
  }

  zonesVisibles.sort((a, b) => b.count - a.count || a.nom.localeCompare(b.nom, "fr"));

  if (regroupees.count > 0) {
    zonesVisibles.push({
      zoneId: null,
      nom: `Autres zones (< ${SEUIL_CONFIDENTIALITE} participants)`,
      type: null,
      ville: ville ?? null,
      parentId: null,
      latitude: null,
      longitude: null,
      count: regroupees.count,
      besoinPrincipalDominant: modeLabel(regroupees.besoins),
      zoneRegroupee: true,
    });
  }

  const payload: AdminCarteResponse = {
    seuilConfidentialite: SEUIL_CONFIDENTIALITE,
    zones: zonesVisibles,
    totalUtilisateursLocalises: users.length,
    totalUtilisateursNonLocalises,
    generatedAt: new Date().toISOString(),
  };

  return res.json(payload);
});

export default router;
