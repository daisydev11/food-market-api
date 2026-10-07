import { db } from "@/lib/db";
import { notFound, ok, parseBody, preflight, route } from "@/lib/http";
import { isId } from "@/lib/ids";
import { deleteOrder, updateOrder, updateOrderSchema } from "@/lib/orders";
import { toOrder } from "@/lib/resources";

type Context = { params: Promise<{ id: string }> };

async function orderId(params: Context["params"]): Promise<string> {
  const { id } = await params;
  if (!isId("order", id)) throw notFound("Order");
  return id;
}

export const GET = route<Context>(async (_request, { params }) => {
  const order = await db.order.findUnique({ where: { id: await orderId(params) }, include: { items: true } });
  if (!order) throw notFound("Order");
  return ok(toOrder(order));
});

export const PATCH = route<Context>(async (request, { params }) => {
  const id = await orderId(params);
  return ok(await updateOrder(id, await parseBody(request, updateOrderSchema)));
});

export const DELETE = route<Context>(async (_request, { params }) => {
  const id = await orderId(params);
  await deleteOrder(id);
  return ok({ id, deleted: true });
});
export const OPTIONS = preflight;
