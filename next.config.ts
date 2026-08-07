import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma Client is server-only; keep it out of the client bundle graph.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
