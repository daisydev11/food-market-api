import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "@/config";
import { rateLimit } from "@/lib/rate-limit";

// ONE response shape for the whole API.
//   success:  { "data": ..., "meta": {...}? }
//   failure:  { "error": { "code": "...", "message": "...", "fields": {...}? } }
// The HTTP status always says the same thing as the body.

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: FieldErrors,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);

// Any website may call this API from a browser: it is public and read without credentials.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining",
};

export function ok(data: unknown, meta?: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(meta ? { data, meta } : { data }, { status });
}

function fail(error: ApiError, headers: Record<string, string> = {}): NextResponse {
  const body = { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } };
  return NextResponse.json(body, { status: error.status, headers });
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join(".") : issue.code === "unrecognized_keys" ? (issue as z.ZodUnrecognizedKeysIssue).keys.join(", ") : "body";
    out[path] ??= issue.code === "unrecognized_keys" ? "This field is not recognised." : issue.message;
  }
  return out;
}

/** Parses a JSON request body. Malformed JSON is 400; a body that breaks the schema is 422 with each field named. */
export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "VALIDATION_FAILED", "The request body is invalid.", toFieldErrors(parsed.error));
  return parsed.data;
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

type Handler<C> = (request: Request, context: C) => Promise<NextResponse>;

/**
 * Wraps every route handler. In order: rate limit by IP, run the handler,
 * and turn anything thrown into the error envelope with an honest status.
 * Nothing in this API answers 200 with an error in the body, and nothing
 * leaks a stack trace.
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    const headers: Record<string, string> = { ...CORS };
    try {
      const write = request.method !== "GET";
      const state = await rateLimit(write ? "write" : "read", clientIp(request), write ? config.rateLimit.write : config.rateLimit.read);
      headers["X-RateLimit-Limit"] = String(state.limit);
      headers["X-RateLimit-Remaining"] = String(state.remaining);
      if (!state.allowed) {
        headers["Retry-After"] = String(state.retryAfterSeconds);
        return fail(new ApiError(429, "RATE_LIMITED", `Too many requests. Try again in ${state.retryAfterSeconds} seconds.`), headers);
      }
      const response = await handler(request, context);
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      return response;
    } catch (error) {
      if (error instanceof ApiError) return fail(error, headers);
      // A foreign key or unique violation that slipped past validation is the client's conflict, not our crash.
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2003")) {
        return fail(new ApiError(409, "CONFLICT", "The request conflicts with existing data."), headers);
      }
      console.error("[api] unhandled error", error);
      return fail(new ApiError(500, "INTERNAL_ERROR", "Something went wrong on our side."), headers);
    }
  };
}

/** Answer for CORS preflight requests. */
export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });
