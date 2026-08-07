import "server-only";

import { prisma } from "@/lib/prisma";

/** Données nécessaires aux exports d'une journée pédagogique (§6 étape 8, §9.7). */
export async function chargerJourneePourExport(journeeId: string) {
  return prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    include: {
      anneeScolaire: true,
      jours: {
        orderBy: { date: "asc" },
        include: {
          groupes: {
            orderBy: { ordre: "asc" },
            include: {
              membres: { include: { eleve: true } },
            },
          },
          affectations: {
            orderBy: [{ quartDebutMinutes: "asc" }],
            include: { educateur: true, groupe: true },
          },
        },
      },
    },
  });
}

export type JourneeExport = NonNullable<
  Awaited<ReturnType<typeof chargerJourneePourExport>>
>;
