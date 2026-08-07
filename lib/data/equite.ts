import "server-only";

import {
  calculerCompteurs,
  ecartSurQuart,
  type AffectationRealisee,
} from "@/lib/domain/equite";
import type { CompteursEducateur } from "@/lib/domain/types";
import { prisma } from "@/lib/prisma";

export interface ColonneQuart {
  code: string;
  libelle: string;
  actif: boolean;
  /** Écart max-min entre collègues. 0 ou 1 = la rotation tient (§4.5). */
  ecart: number;
}

export interface LigneEquite {
  educateurId: string;
  nom: string;
  prenom: string;
  actif: boolean;
  compteurs: CompteursEducateur;
}

export interface TableauEquite {
  anneeLibelle: string;
  colonnes: ColonneQuart[];
  lignes: LigneEquite[];
  joursNonConfirmes: number;
  totalJours: number;
}

/**
 * Tableau d'équité — §4.5, §9.5.
 *
 * Les compteurs ne sont PAS lus depuis une table : ils sont recalculés ici à
 * partir des affectations croisées avec les présences. C'est ce qui garantit
 * qu'ils ne peuvent jamais se désynchroniser du réalisé.
 */
export async function chargerEquite(
  anneeScolaireId?: string,
): Promise<TableauEquite | null> {
  const annee = anneeScolaireId
    ? await prisma.anneeScolaire.findUnique({ where: { id: anneeScolaireId } })
    : await prisma.anneeScolaire.findFirst({ where: { statut: "ACTIVE" } });

  if (!annee) return null;

  const [educateurs, affectations, typesQuart, jours] = await Promise.all([
    prisma.educateur.findMany({ orderBy: [{ nom: "asc" }, { prenom: "asc" }] }),
    prisma.affectation.findMany({
      where: {
        jourPlanifie: {
          journeePedagogique: { anneeScolaireId: annee.id },
        },
      },
      select: {
        jourPlanifieId: true,
        educateurId: true,
        quartCode: true,
        quartLibelle: true,
        quartDebutMinutes: true,
        quartFinMinutes: true,
        presence: { select: { statut: true, remplacantId: true } },
      },
    }),
    prisma.typeQuart.findMany({
      where: { anneeScolaireId: annee.id },
      orderBy: { ordre: "asc" },
    }),
    prisma.jourPlanifie.findMany({
      where: { journeePedagogique: { anneeScolaireId: annee.id } },
      select: { statutConfirmation: true },
    }),
  ]);

  const realisees: AffectationRealisee[] = affectations.map((a) => ({
    jourPlanifieId: a.jourPlanifieId,
    educateurId: a.educateurId,
    quartCode: a.quartCode,
    quartDebutMinutes: a.quartDebutMinutes,
    quartFinMinutes: a.quartFinMinutes,
    presence: a.presence,
  }));

  const compteurs = calculerCompteurs({
    educateurIds: educateurs.map((e) => e.id),
    affectations: realisees,
  });

  // L'écart ne se mesure qu'entre éducateurs ACTIFS. Un collègue parti en
  // cours d'année reste à zéro sur l'année suivante : l'inclure ferait
  // apparaître un écart maximal permanent, qui ne dit rien de l'équité entre
  // les personnes réellement en poste.
  const compteursActifs = educateurs
    .filter((e) => e.actif)
    .map((e) => compteurs.get(e.id)!)
    .filter(Boolean);

  // §4.6 — un quart désactivé garde ses colonnes : désactiver la soirée
  // n'efface pas les soirées déjà travaillées. On part donc des types de
  // quart configurés, complétés par tout code réellement présent dans
  // l'historique, même s'il a disparu de la configuration.
  const codesVus = new Set(affectations.map((a) => a.quartCode));
  const libelleParCode = new Map(
    affectations.map((a) => [a.quartCode, a.quartLibelle]),
  );

  const colonnes: ColonneQuart[] = [];
  for (const tq of typesQuart) {
    if (!tq.actif && !codesVus.has(tq.code)) continue;
    colonnes.push({
      code: tq.code,
      libelle: tq.libelle,
      actif: tq.actif,
      ecart: ecartSurQuart(compteursActifs, tq.code),
    });
    codesVus.delete(tq.code);
  }
  for (const code of codesVus) {
    colonnes.push({
      code,
      libelle: libelleParCode.get(code) ?? code,
      actif: false,
      ecart: ecartSurQuart(compteursActifs, code),
    });
  }

  return {
    anneeLibelle: annee.libelle,
    colonnes,
    lignes: educateurs.map((e) => ({
      educateurId: e.id,
      nom: e.nom,
      prenom: e.prenom,
      actif: e.actif,
      compteurs: compteurs.get(e.id)!,
    })),
    joursNonConfirmes: jours.filter(
      (j) => j.statutConfirmation === "A_CONFIRMER",
    ).length,
    totalJours: jours.length,
  };
}

/** §8.4 — les justifications d'un éducateur, pour répondre à une contestation. */
export async function justificationsEducateur(educateurId: string) {
  return prisma.affectation.findMany({
    where: { educateurId },
    select: {
      id: true,
      quartLibelle: true,
      justification: true,
      issueEnchainement: true,
      jourPlanifie: { select: { date: true } },
      presence: { select: { statut: true } },
    },
    orderBy: { jourPlanifie: { date: "desc" } },
    take: 50,
  });
}

export async function listerAnneesScolaires() {
  return prisma.anneeScolaire.findMany({ orderBy: { libelle: "desc" } });
}
