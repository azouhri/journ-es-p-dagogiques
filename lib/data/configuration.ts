import "server-only";

import type {
  ReglagesConfig,
  TrancheAgeConfig,
  TypeQuartConfig,
} from "@/lib/domain/types";
import { prisma } from "@/lib/prisma";

/** Configuration complète d'une année, telle que la lit l'algorithme (§8.2). */
export interface ConfigurationAnnee {
  anneeScolaireId: string;
  anneeLibelle: string;
  quarts: TypeQuartConfig[];
  tranches: TrancheAgeConfig[];
  reglages: ReglagesConfig;
  versionCourante: number;
}

export async function chargerConfiguration(
  anneeScolaireId?: string,
): Promise<ConfigurationAnnee | null> {
  const annee = anneeScolaireId
    ? await prisma.anneeScolaire.findUnique({ where: { id: anneeScolaireId } })
    : await prisma.anneeScolaire.findFirst({ where: { statut: "ACTIVE" } });
  if (!annee) return null;

  const [quartsDb, tranchesDb, reglagesDb, derniereVersion] = await Promise.all([
    prisma.typeQuart.findMany({
      where: { anneeScolaireId: annee.id },
      orderBy: { ordre: "asc" },
    }),
    prisma.trancheAge.findMany({
      where: { anneeScolaireId: annee.id },
      orderBy: { ordre: "asc" },
    }),
    prisma.reglages.findUnique({ where: { anneeScolaireId: annee.id } }),
    prisma.versionConfiguration.findFirst({
      where: { anneeScolaireId: annee.id },
      orderBy: { numero: "desc" },
    }),
  ]);

  if (!reglagesDb) return null;

  return {
    anneeScolaireId: annee.id,
    anneeLibelle: annee.libelle,
    quarts: quartsDb.map((q) => ({
      id: q.id,
      code: q.code,
      libelle: q.libelle,
      debutMinutes: q.debutMinutes,
      finMinutes: q.finMinutes,
      portee: q.portee,
      effectifRequis: q.effectifRequis,
      enchaineSurId: q.enchaineSurId,
      actif: q.actif,
      ordre: q.ordre,
    })),
    tranches: tranchesDb.map((t) => ({
      id: t.id,
      libelle: t.libelle,
      ageMin: t.ageMin,
      ageMax: t.ageMax,
      niveauMin: t.niveauMin,
      niveauMax: t.niveauMax,
      ordre: t.ordre,
    })),
    reglages: {
      capaciteMaxGroupe: reglagesDb.capaciteMaxGroupe,
      ratioMaxEleves: reglagesDb.ratioMaxEleves,
      modeGroupement: reglagesDb.modeGroupement,
      dateReferenceAgeJour: reglagesDb.dateReferenceAgeJour,
      dateReferenceAgeMois: reglagesDb.dateReferenceAgeMois,
      eviterMemeQuartConsecutif: reglagesDb.eviterMemeQuartConsecutif,
      continuiteTrancheAge: reglagesDb.continuiteTrancheAge,
      politiqueTrancheEducateur: reglagesDb.politiqueTrancheEducateur,
      doublePoste: reglagesDb.doublePoste,
      politiqueBloc: reglagesDb.politiqueBloc,
      surEffectifOuverture: reglagesDb.surEffectifOuverture,
      critereDepartage: reglagesDb.critereDepartage,
    },
    versionCourante: derniereVersion?.numero ?? 0,
  };
}

/**
 * §4.6 — toute modification de la configuration crée une NOUVELLE version.
 * Les versions ne sont jamais écrasées : c'est ce qui permet à une journée
 * déjà générée de continuer à référencer la configuration sous laquelle elle
 * a été produite.
 */
export async function creerVersionConfiguration(
  anneeScolaireId: string,
  commentaire: string,
) {
  const config = await chargerConfiguration(anneeScolaireId);
  if (!config) throw new Error("Configuration introuvable.");

  const derniere = await prisma.versionConfiguration.findFirst({
    where: { anneeScolaireId },
    orderBy: { numero: "desc" },
  });

  return prisma.versionConfiguration.create({
    data: {
      anneeScolaireId,
      numero: (derniere?.numero ?? 0) + 1,
      commentaire,
      snapshot: JSON.parse(
        JSON.stringify({
          quarts: config.quarts,
          tranches: config.tranches,
          reglages: config.reglages,
        }),
      ),
    },
  });
}

/**
 * Tranches d'âge déclarées, par éducateur, pour une année donnée.
 * Un éducateur absent de la table encadre toutes les tranches.
 */
export async function tranchesParEducateur(
  anneeScolaireId: string,
): Promise<Map<string, Set<string>>> {
  const lignes = await prisma.educateurTrancheAge.findMany({
    where: { trancheAge: { anneeScolaireId } },
    select: { educateurId: true, trancheAgeId: true },
  });

  const parEducateur = new Map<string, Set<string>>();
  for (const l of lignes) {
    const set = parEducateur.get(l.educateurId) ?? new Set<string>();
    set.add(l.trancheAgeId);
    parEducateur.set(l.educateurId, set);
  }
  return parEducateur;
}

export async function listerVersions(anneeScolaireId: string) {
  return prisma.versionConfiguration.findMany({
    where: { anneeScolaireId },
    orderBy: { numero: "desc" },
    include: { _count: { select: { journees: true } } },
  });
}
