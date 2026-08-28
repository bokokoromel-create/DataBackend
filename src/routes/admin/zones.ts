import { Router } from "express";
import { TypeZoneAdministrative } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin } from "../../middleware/requireAdmin";
import type { ZoneAdministrativeApi } from "../../types/front-contract";

const router = Router();

/** Référentiel plat ville → secteur → quartier, pour peupler les filtres/pastilles de la carte admin. */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const ville =
    typeof req.query.ville === "string" && req.query.ville.trim()
      ? req.query.ville.trim()
      : undefined;

  const zones = await prisma.zoneAdministrative.findMany({
    where: { actif: true, ...(ville ? { ville } : {}) },
    select: {
      id: true,
      type: true,
      nom: true,
      ville: true,
      parentId: true,
      latitude: true,
      longitude: true,
    },
    orderBy: [{ ville: "asc" }, { type: "asc" }, { nom: "asc" }],
  });

  const payload: ZoneAdministrativeApi[] = zones.map((z) => ({
    id: z.id,
    type: z.type === TypeZoneAdministrative.SECTEUR ? "SECTEUR" : "QUARTIER",
    nom: z.nom,
    ville: z.ville,
    parentId: z.parentId,
    latitude: z.latitude,
    longitude: z.longitude,
  }));

  return res.json(payload);
});

export default router;
