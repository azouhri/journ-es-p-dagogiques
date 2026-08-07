/**
 * Calcul de l'âge et classement dans une tranche — spec §5.1, §10, §13 q1/q2.
 *
 * L'âge n'est jamais calculé « aujourd'hui » : il l'est à une DATE DE
 * RÉFÉRENCE fixe pour toute l'année scolaire (défaut : 30 septembre). Sans
 * cela, un élève changerait de groupe au milieu de l'année parce qu'il a eu
 * son anniversaire, et deux générations de la même journée donneraient des
 * groupes différents.
 */

import type { EleveRef, ModeGroupement, TrancheAgeConfig } from "./types";

/**
 * Résout la date de référence pour une année scolaire donnée.
 *
 * Le réglage est stocké en jour + mois (30 / 9). L'année civile est déduite de
 * l'année scolaire : le 30 septembre de 2025-2026 est celui de 2025, parce que
 * c'est celui qui tombe dans l'intervalle de l'année scolaire.
 */
export function resoudreDateReference(
  anneeScolaire: { dateDebut: Date; dateFin: Date },
  jour: number,
  mois: number,
): Date {
  const anneeDebut = anneeScolaire.dateDebut.getUTCFullYear();
  const candidate = new Date(Date.UTC(anneeDebut, mois - 1, jour));
  if (candidate >= anneeScolaire.dateDebut) return candidate;
  return new Date(Date.UTC(anneeDebut + 1, mois - 1, jour));
}

/** Âge en années révolues à la date de référence. */
export function ageALaDate(dateNaissance: Date, dateReference: Date): number {
  let age = dateReference.getUTCFullYear() - dateNaissance.getUTCFullYear();
  const moisEcart = dateReference.getUTCMonth() - dateNaissance.getUTCMonth();
  const jourEcart = dateReference.getUTCDate() - dateNaissance.getUTCDate();
  // L'anniversaire n'est pas encore passé à la date de référence.
  if (moisEcart < 0 || (moisEcart === 0 && jourEcart < 0)) age -= 1;
  return age;
}

/**
 * Trouve la tranche d'un élève selon le mode de groupement en vigueur.
 * Retourne null si l'élève n'entre dans aucune tranche : l'appelant doit le
 * signaler à la responsable plutôt que de l'affecter arbitrairement.
 */
export function trancheDeLEleve(
  eleve: EleveRef,
  tranches: TrancheAgeConfig[],
  mode: ModeGroupement,
  dateReference: Date,
): TrancheAgeConfig | null {
  if (mode === "NIVEAU_SCOLAIRE") {
    const niveau = eleve.niveauScolaire;
    if (niveau === null) return null;
    return (
      tranches.find(
        (t) =>
          t.niveauMin !== null &&
          t.niveauMax !== null &&
          niveau >= t.niveauMin &&
          niveau <= t.niveauMax,
      ) ?? null
    );
  }

  const age = ageALaDate(eleve.dateNaissance, dateReference);
  return tranches.find((t) => age >= t.ageMin && age <= t.ageMax) ?? null;
}
