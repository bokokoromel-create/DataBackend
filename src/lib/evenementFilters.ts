/** Filtre publication par jour calendaire UTC (`YYYY-MM-DD`). */
export function parseDayParam(
  day: string,
): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

export function parseIsoDateParam(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type EvenementPublicationFilter = {
  createdAt?: { gte?: Date; lte?: Date };
};

/** Construit le filtre Prisma `createdAt` depuis les query params. */
export function evenementFilterFromQuery(query: {
  day?: unknown;
  publishedFrom?: unknown;
  publishedTo?: unknown;
}): { filter: EvenementPublicationFilter; error: string | null } {
  const filter: EvenementPublicationFilter = {};
  let gte: Date | undefined;
  let lte: Date | undefined;

  if (typeof query.day === "string" && query.day.trim()) {
    const range = parseDayParam(query.day.trim());
    if (!range) {
      return { filter, error: "Paramètre day invalide (attendu YYYY-MM-DD)." };
    }
    gte = range.start;
    lte = range.end;
  }

  if (typeof query.publishedFrom === "string" && query.publishedFrom.trim()) {
    const from = parseIsoDateParam(query.publishedFrom.trim());
    if (!from) {
      return {
        filter,
        error: "Paramètre publishedFrom invalide (attendu ISO 8601).",
      };
    }
    gte = gte && gte > from ? gte : from;
  }

  if (typeof query.publishedTo === "string" && query.publishedTo.trim()) {
    const to = parseIsoDateParam(query.publishedTo.trim());
    if (!to) {
      return {
        filter,
        error: "Paramètre publishedTo invalide (attendu ISO 8601).",
      };
    }
    lte = lte && lte < to ? lte : to;
  }

  if (gte !== undefined || lte !== undefined) {
    filter.createdAt = {};
    if (gte !== undefined) filter.createdAt.gte = gte;
    if (lte !== undefined) filter.createdAt.lte = lte;
  }

  return { filter, error: null };
}
