import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function readDatabaseUrl(): { connectionString: string; schema: string } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  // The pg driver ignores Prisma's optional ?schema= parameter, so it is read here.
  const schema = new URL(url).searchParams.get("schema") ?? "public";
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) throw new Error("Invalid schema name in DATABASE_URL.");
  return { connectionString: url, schema };
}

const { connectionString, schema } = readDatabaseUrl();
export const dbSchema = schema;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One client per process (cached across hot reloads in development).
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema }) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
