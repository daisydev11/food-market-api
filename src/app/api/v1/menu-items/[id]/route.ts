import { db } from "@/lib/db";
import { notFound, ok, preflight, route } from "@/lib/http";
import { isId } from "@/lib/ids";

type Context = { params: Promise<{ id: string }> };

export const GET = route<Context>(async (_request, { params }) => {
  const { id } = await params;
  const item = isId("menuItem", id) ? await db.menuItem.findUnique({ where: { id } }) : null;
  if (!item) throw notFound("Menu item");
  return ok(item);
});
export const OPTIONS = preflight;
