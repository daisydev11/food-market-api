import { db } from "@/lib/db";
import { notFound, ok, preflight, route } from "@/lib/http";
import { isId } from "@/lib/ids";

type Context = { params: Promise<{ id: string }> };

export const GET = route<Context>(async (_request, { params }) => {
  const { id } = await params;
  // A malformed id cannot match anything, so it is 404 without touching the database.
  const restaurant = isId("restaurant", id) ? await db.restaurant.findUnique({ where: { id } }) : null;
  if (!restaurant) throw notFound("Restaurant");
  return ok(restaurant);
});
export const OPTIONS = preflight;
