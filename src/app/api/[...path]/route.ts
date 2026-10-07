import { ApiError, preflight, route } from "@/lib/http";

// Any path under /api that is not a real endpoint still answers in the error envelope.
const unknown = route(async (request) => {
  throw new ApiError(404, "NOT_FOUND", `No endpoint at ${new URL(request.url).pathname}. See /api/v1 for the list.`);
});
export { unknown as GET, unknown as POST, unknown as PATCH, unknown as PUT, unknown as DELETE };
export const OPTIONS = preflight;
