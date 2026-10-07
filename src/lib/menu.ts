import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { paginate, parseListQuery, q } from "@/lib/list";

// The menu-item list, shared by /menu-items and /restaurants/:id/menu.

const filters = {
  category: z.enum(["starter", "main", "side", "dessert", "drink"], { errorMap: () => ({ message: "category must be one of: starter, main, side, dessert, drink." }) }).optional(),
  minPrice: q.int("minPrice"),
  maxPrice: q.int("maxPrice"),
  isAvailable: q.bool("isAvailable"),
};
const sortable = ["name", "priceMinor", "createdAt"] as const;

export async function listMenuItems(request: Request, fixedRestaurantId?: string) {
  const query = parseListQuery(request, {
    filters: fixedRestaurantId ? filters : { ...filters, restaurantId: q.text("restaurantId") },
    sortable,
    defaultSort: { field: "name", order: "asc" },
  });
  const f = query.filters as { category?: string; minPrice?: number; maxPrice?: number; isAvailable?: boolean; restaurantId?: string };
  const where: Prisma.MenuItemWhereInput = {
    restaurantId: fixedRestaurantId ?? f.restaurantId,
    category: f.category,
    isAvailable: f.isAvailable,
    priceMinor: { gte: f.minPrice, lte: f.maxPrice },
  };
  return paginate(query, {
    where,
    count: (w) => db.menuItem.count({ where: w }),
    findMany: (args) => db.menuItem.findMany(args),
    exists: async (id) => (await db.menuItem.count({ where: { id } })) === 1,
  });
}
