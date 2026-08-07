import "server-only";

import { prisma } from "@/lib/prisma";

export interface FiltreEducateurs {
  recherche?: string;
  actif?: boolean;
}

/** §5.2 — liste avec recherche et filtre par statut. */
export async function listerEducateurs(filtre: FiltreEducateurs = {}) {
  const recherche = filtre.recherche?.trim();

  return prisma.educateur.findMany({
    where: {
      ...(filtre.actif === undefined ? {} : { actif: filtre.actif }),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: "insensitive" } },
              { prenom: { contains: recherche, mode: "insensitive" } },
              { courriel: { contains: recherche, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    include: {
      tranches: { include: { trancheAge: { select: { id: true, libelle: true } } } },
    },
  });
}

export async function compterEducateurs() {
  const [total, actifs] = await Promise.all([
    prisma.educateur.count(),
    prisma.educateur.count({ where: { actif: true } }),
  ]);
  return { total, actifs, inactifs: total - actifs };
}

export async function courrielsExistants(): Promise<Set<string>> {
  const educateurs = await prisma.educateur.findMany({
    where: { courriel: { not: null } },
    select: { courriel: true },
  });
  return new Set(
    educateurs
      .map((e) => e.courriel?.toLowerCase())
      .filter((c): c is string => Boolean(c)),
  );
}
