import { NextResponse } from "next/server";

// TEMPORARY diagnostic for the first deployment. Removed once the API answers.
export const dynamic = "force-dynamic";
const clean = (value: unknown) => String(value).replace(/postgres(ql)?:\/\/[^\s"']+/g, "[url]").slice(0, 1500);

export async function GET() {
  const out: Record<string, unknown> = {
    hasUrl: Boolean(process.env.DATABASE_URL),
    hasUnpooled: Boolean(process.env.DATABASE_URL_UNPOOLED),
    node: process.version,
  };
  try {
    const { db } = await import("@/lib/db");
    out.tables = await db.$queryRaw`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1, 2`;
    out.restaurants = await db.restaurant.count();
  } catch (error) {
    out.error = clean(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : error);
  }
  return NextResponse.json(out);
}
