import { db } from "@/lib/db";
import { notFound, ok, preflight, route } from "@/lib/http";
import { isId } from "@/lib/ids";

type Context = { params: Promise<{ id: string }> };

export const GET = route<Context>(async (_request, { params }) => {
  const { id } = await params;
  const customer = isId("customer", id) ? await db.customer.findUnique({ where: { id } }) : null;
  if (!customer) throw notFound("Customer");
  return ok(customer);
});
export const OPTIONS = preflight;
