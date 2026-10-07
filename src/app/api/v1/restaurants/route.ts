import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, preflight, route } from "@/lib/http";
import { paginate, parseListQuery, q } from "@/lib/list";

export const GET = route(async (request) => {
  const query = parseListQuery(request, {
    filters: { cuisine: q.text("cuisine"), city: q.text("city"), minRating: q.number("minRating", 0, 5), isOpen: q.bool("isOpen") },
    sortable: ["name", "rating", "deliveryFeeMinor", "createdAt"],
    defaultSort: { field: "name", order: "asc" },
  });
  const { cuisine, city, minRating, isOpen } = query.filters;
  const where: Prisma.RestaurantWhereInput = {
    cuisine: cuisine?.toLowerCase(),
    city: city ? { equals: city, mode: "insensitive" } : undefined,
    rating: minRating === undefined ? undefined : { gte: minRating },
    isOpen,
  };
  const page = await paginate(query, {
    where,
    count: (w) => db.restaurant.count({ where: w }),
    findMany: (args) => db.restaurant.findMany(args),
    exists: async (id) => (await db.restaurant.count({ where: { id } })) === 1,
  });
  return ok(page.data, page.meta);
});
export const OPTIONS = preflight;
