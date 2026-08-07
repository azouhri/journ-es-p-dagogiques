import { PrismaClient } from "@prisma/client";

/**
 * Instance unique de Prisma Client.
 *
 * En développement, Next.js recharge les modules à chaque modification. Sans
 * ce cache sur `globalThis`, chaque rechargement ouvrirait un nouveau pool de
 * connexions et Supabase finirait par les refuser.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
