import { ok, preflight, route } from "@/lib/http";
import { listMenuItems } from "@/lib/menu";

export const GET = route(async (request) => {
  const page = await listMenuItems(request);
  return ok(page.data, page.meta);
});
export const OPTIONS = preflight;
