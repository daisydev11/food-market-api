// Build command used on Vercel (see vercel.json).
// Applies the migrations and runs the repeatable seed against the production
// database before building, so a deployment can never serve an empty API.
// The seed inserts nothing on a second run, so doing this on every deploy is safe.
import { execSync } from "node:child_process";

const pooled = process.env.DATABASE_URL;
if (!pooled) {
  console.error("DATABASE_URL is not set. Connect a Postgres database to this Vercel project, then redeploy.");
  process.exit(1);
}
// Migrations need a direct connection. Neon's Vercel integration provides one beside the pooled URL.
const direct = process.env.DATABASE_URL_UNPOOLED ?? pooled;
const run = (command, env = {}) => {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", env: { ...process.env, ...env } });
};

run("npx prisma generate");
run("npx prisma migrate deploy", { DATABASE_URL: direct });
run("node prisma/seed.mjs", { DATABASE_URL: direct });
run("npx next build");
