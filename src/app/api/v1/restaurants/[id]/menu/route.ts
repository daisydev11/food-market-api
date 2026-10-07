import { db } from "@/lib/db";
import { notFound, ok, preflight, route } from "@/lib/http";
import { isId } from "@/lib/ids";
import { listMenuItems } from "@/lib/menu";

type Context = { params: Promise<{ id: string }> };

// Nested resource: the menu items of one restaurant.
export const GET = route<Context>(async (request, { params }) => {
  const { id } = await params;
  const exists = isId("restaurant", id) && (await db.restaurant.count({ where: { id } })) === 1;
  if (!exists) throw notFound("Restaurant"); // an unknown restaurant is 404, not an empty menu
  const page = await listMenuItems(request, id);
  return ok(page.data, page.meta);
});
export const OPTIONS = preflight;
