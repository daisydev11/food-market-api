import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, preflight, route } from "@/lib/http";
import { paginate, parseListQuery, q } from "@/lib/list";

export const GET = route(async (request) => {
  const query = parseListQuery(request, {
    filters: { city: q.text("city"), joinedAfter: q.date("joinedAfter"), joinedBefore: q.date("joinedBefore") },
    sortable: ["name", "createdAt"],
    defaultSort: { field: "name", order: "asc" },
  });
  const { city, joinedAfter, joinedBefore } = query.filters;
  const where: Prisma.CustomerWhereInput = {
    city: city ? { equals: city, mode: "insensitive" } : undefined,
    createdAt: { gte: joinedAfter, lte: joinedBefore },
  };
  const page = await paginate(query, {
    where,
    count: (w) => db.customer.count({ where: w }),
    findMany: (args) => db.customer.findMany(args),
    exists: async (id) => (await db.customer.count({ where: { id } })) === 1,
  });
  return ok(page.data, page.meta);
});
export const OPTIONS = preflight;
