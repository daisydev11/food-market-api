import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Prisma's engine-free client loads its query compiler from a .wasm file at
  // run time. Next's file tracing does not see that read, so on serverless
  // hosting the file is left out of the bundle unless it is named here.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.prisma/client/*.wasm", "./node_modules/.prisma/client/*.js", "./node_modules/.prisma/client/*.mjs"],
  },
};

export default nextConfig;
