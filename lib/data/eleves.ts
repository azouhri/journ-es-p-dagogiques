import "server-only";

import { prisma } from "@/lib/prisma";
import { cleEleve } from "@/lib/import-eleves";

export interface FiltreEleves {
  recherche?: string;
  actif?: boolean;
  trancheAgeId?: string;
}

/** §5.1 — liste avec recherche et filtre par statut. */
export async function listerEleves(filtre: FiltreEleves = {}) {
  const recherche = filtre.recherche?.trim();

  return prisma.eleve.findMany({
    where: {
      ...(filtre.actif === undefined ? {} : { actif: filtre.actif }),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: "insensitive" } },
              { prenom: { contains: recherche, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
}

export async function compterEleves() {
  const [total, actifs] = await Promise.all([
    prisma.eleve.count(),
    prisma.eleve.count({ where: { actif: true } }),
  ]);
  return { total, actifs, inactifs: total - actifs };
}

export async function lireEleve(id: string) {
  return prisma.eleve.findUnique({ where: { id } });
}

/**
 * Clés de doublon (nom + prénom + date de naissance) de tous les élèves.
 * Sert à la prévisualisation d'import (§5.1).
 */
export async function clesElevesExistants(): Promise<Set<string>> {
  const eleves = await prisma.eleve.findMany({
    select: { nom: true, prenom: true, dateNaissance: true },
  });
  return new Set(eleves.map(cleEleve));
}
