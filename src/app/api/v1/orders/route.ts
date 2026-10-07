import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, parseBody, preflight, route } from "@/lib/http";
import { paginate, parseListQuery, q } from "@/lib/list";
import { createOrder, createOrderSchema } from "@/lib/orders";
import { ORDER_STATUSES, toDbStatus, toOrder } from "@/lib/resources";

export const GET = route(async (request) => {
  const query = parseListQuery(request, {
    filters: {
      status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: `status must be one of: ${ORDER_STATUSES.join(", ")}.` }) }).optional(),
      restaurantId: q.text("restaurantId"),
      customerId: q.text("customerId"),
      minTotal: q.int("minTotal"),
      maxTotal: q.int("maxTotal"),
    },
    sortable: ["createdAt", "totalMinor"],
    defaultSort: { field: "createdAt", order: "desc" },
  });
  const { status, restaurantId, customerId, minTotal, maxTotal } = query.filters;
  const where: Prisma.OrderWhereInput = {
    status: status ? toDbStatus(status) : undefined,
    restaurantId,
    customerId,
    totalMinor: { gte: minTotal, lte: maxTotal },
  };
  const page = await paginate(query, {
    where,
    count: (w) => db.order.count({ where: w }),
    findMany: (args) => db.order.findMany({ ...args, include: { items: true } }),
    exists: async (id) => (await db.order.count({ where: { id } })) === 1,
  });
  return ok(page.data.map(toOrder), page.meta);
});

export const POST = route(async (request) => {
  const order = await createOrder(await parseBody(request, createOrderSchema));
  return ok(order, undefined, 201);
});
export const OPTIONS = preflight;
