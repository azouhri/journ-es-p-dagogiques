/**
 * Compteurs d'équité — spec §4.5, §9.4, §9.5, §13 q7.
 *
 * RÈGLE CENTRALE : les compteurs ne sont jamais stockés. Ils sont recalculés à
 * la demande depuis les affectations croisées avec les présences. Corriger une
 * présence deux semaines après coup se répercute donc instantanément sur le
 * tableau d'équité et sur la prochaine génération.
 *
 * Ce sont les COMPTEURS DU RÉALISÉ, pas du prévu (§13 q7) :
 *   PRESENT   -> le quart est crédité au titulaire
 *   ABSENT    -> aucun crédit à personne
 *   REMPLACE  -> aucun crédit au titulaire, le quart est crédité au remplaçant
 */

import type { CompteursEducateur, StatutPresenceEducateur } from "./types";
import { compteursVides } from "./types";

/** Une affectation telle que relue depuis la base, avec sa présence. */
export interface AffectationRealisee {
  jourPlanifieId: string;
  educateurId: string;
  /** §4.6 — on lit la copie figée, jamais le type de quart vivant. */
  quartCode: string;
  quartDebutMinutes: number;
  quartFinMinutes: number;
  presence: {
    statut: StatutPresenceEducateur;
    remplacantId: string | null;
  } | null;
}

/**
 * À qui ce quart est-il crédité ? Retourne null si personne.
 *
 * Une affectation sans ligne de présence est créditée au titulaire : les
 * présences sont pré-remplies à « présent » dès la validation du planning
 * (§9.4), donc une ligne absente signifie « pas encore vérifié », pas
 * « personne n'était là » (§9.6).
 */
export function beneficiaireDuCredit(
  affectation: AffectationRealisee,
): string | null {
  const presence = affectation.presence;
  if (!presence) return affectation.educateurId;

  switch (presence.statut) {
    case "PRESENT":
      return affectation.educateurId;
    case "ABSENT":
      return null;
    case "REMPLACE":
      // Sans remplaçant désigné, le quart n'est crédité à personne : la place
      // est restée vide dans le réalisé.
      return presence.remplacantId;
  }
}

export interface EntreeCalculCompteurs {
  /** Tous les éducateurs à faire figurer, même ceux à zéro. */
  educateurIds: string[];
  affectations: AffectationRealisee[];
}

/**
 * Recalcule les compteurs de toute l'équipe.
 *
 * Volume négligeable : une quinzaine d'éducateurs sur une dizaine de journées
 * par an (§9.5). Si la lecture devenait lente à plusieurs années d'historique,
 * une vue matérialisée rafraîchie à chaque confirmation suffirait.
 */
export function calculerCompteurs(
  entree: EntreeCalculCompteurs,
): Map<string, CompteursEducateur> {
  const compteurs = new Map<string, CompteursEducateur>();
  for (const id of entree.educateurIds) {
    compteurs.set(id, compteursVides(id));
  }

  // Un éducateur ne compte qu'une fois par jour planifié, quel que soit le
  // nombre de quarts qu'il y tient (ouverture + matinée = une journée).
  const joursParEducateur = new Map<string, Set<string>>();

  for (const affectation of entree.affectations) {
    const beneficiaire = beneficiaireDuCredit(affectation);
    if (!beneficiaire) continue;

    let compteur = compteurs.get(beneficiaire);
    if (!compteur) {
      // Un remplaçant hors de la liste fournie reste crédité : son historique
      // ne doit pas disparaître (§5.2).
      compteur = compteursVides(beneficiaire);
      compteurs.set(beneficiaire, compteur);
    }

    compteur.parQuart[affectation.quartCode] =
      (compteur.parQuart[affectation.quartCode] ?? 0) + 1;
    compteur.minutesCumulees +=
      affectation.quartFinMinutes - affectation.quartDebutMinutes;

    let jours = joursParEducateur.get(beneficiaire);
    if (!jours) {
      jours = new Set();
      joursParEducateur.set(beneficiaire, jours);
    }
    jours.add(affectation.jourPlanifieId);
  }

  for (const [educateurId, jours] of joursParEducateur) {
    const compteur = compteurs.get(educateurId);
    if (compteur) compteur.nbJourneesTravaillees = jours.size;
  }

  return compteurs;
}

/** Lecture sûre d'un compteur de quart, y compris pour un code jamais tenu. */
export function compteurDuQuart(
  compteurs: CompteursEducateur,
  codeQuart: string,
): number {
  return compteurs.parQuart[codeQuart] ?? 0;
}

/**
 * En deçà de cette part des jours du plus assidu, un éducateur n'a été présent
 * qu'une partie de l'année.
 *
 * Une embauche en janvier, un congé prolongé : ces personnes tiennent
 * mécaniquement moins de quarts. Les inclure dans l'écart ferait passer une
 * situation normale pour un défaut de rotation, et l'indicateur crierait au
 * loup toute l'année.
 */
export const SEUIL_ANNEE_COMPLETE = 0.7;

export interface Comparables {
  /** Éducateurs présents sur une part suffisante de l'année. */
  comparables: CompteursEducateur[];
  /** Éducateurs écartés parce que présents une partie de l'année seulement. */
  partiels: number;
}

/**
 * Sépare les éducateurs comparables de ceux qui n'ont fait qu'une partie de
 * l'année. Un éducateur sans aucune journée n'entre dans aucune des deux
 * catégories : il n'a pas commencé, il n'est pas « en retard ».
 */
export function separerComparables(
  compteurs: Iterable<CompteursEducateur>,
): Comparables {
  const tous = [...compteurs].filter((c) => c.nbJourneesTravaillees > 0);
  const maximum = Math.max(...tous.map((c) => c.nbJourneesTravaillees), 0);
  const seuil = maximum * SEUIL_ANNEE_COMPLETE;

  const comparables = tous.filter((c) => c.nbJourneesTravaillees >= seuil);
  return { comparables, partiels: tous.length - comparables.length };
}

/**
 * Écart max-min sur un code de quart donné, tous éducateurs confondus.
 * Sert d'indicateur de santé au tableau de bord : un écart de 0 ou 1 signifie
 * que la rotation tient.
 */
export function ecartSurQuart(
  compteurs: Iterable<CompteursEducateur>,
  codeQuart: string,
): number {
  let min = Infinity;
  let max = -Infinity;
  let vu = false;
  for (const c of compteurs) {
    const valeur = compteurDuQuart(c, codeQuart);
    if (valeur < min) min = valeur;
    if (valeur > max) max = valeur;
    vu = true;
  }
  return vu ? max - min : 0;
}

/** Copie profonde — la génération travaille sur une copie mutable. */
export function copierCompteurs(
  source: Map<string, CompteursEducateur>,
): Map<string, CompteursEducateur> {
  const copie = new Map<string, CompteursEducateur>();
  for (const [id, c] of source) {
    copie.set(id, {
      educateurId: c.educateurId,
      parQuart: { ...c.parQuart },
      minutesCumulees: c.minutesCumulees,
      nbJourneesTravaillees: c.nbJourneesTravaillees,
    });
  }
  return copie;
}
