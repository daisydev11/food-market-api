import { Prisma } from "@prisma/client";
import type { RateLimitRule } from "@/config";
import { db, dbSchema } from "@/lib/db";

const table = Prisma.raw(`"${dbSchema}"."RateLimit"`);

export type RateLimitState = { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number };

/**
 * Fixed-window counter in Postgres, so the count is shared by every server
 * instance (on serverless hosting each request may land on a different one).
 * One atomic statement counts the request and returns the total.
 */
export async function rateLimit(bucket: string, ip: string, rule: RateLimitRule): Promise<RateLimitState> {
  const now = new Date();
  const windowFloor = new Date(now.getTime() - rule.windowMs);
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO ${table} AS r ("key", "count", "windowStart")
    VALUES (${`${bucket}:${ip}`}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN r."windowStart" <= ${windowFloor} THEN 1 ELSE r."count" + 1 END,
      "windowStart" = CASE WHEN r."windowStart" <= ${windowFloor} THEN ${now} ELSE r."windowStart" END
    RETURNING "count", "windowStart"`;
  const { count, windowStart } = rows[0];
  const resetsInMs = windowStart.getTime() + rule.windowMs - now.getTime();
  return {
    allowed: count <= rule.max,
    limit: rule.max,
    remaining: Math.max(0, rule.max - count),
    retryAfterSeconds: Math.max(1, Math.ceil(resetsInMs / 1000)),
  };
}
