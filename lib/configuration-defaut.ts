import { versMinutes } from "@/lib/domain/temps";

/**
 * Configuration initiale d'une année scolaire — §4.2.
 *
 * Une année sans types de quart ni tranches d'âge ne peut rien planifier. Ces
 * valeurs servent d'amorce quand aucune année antérieure n'existe à recopier ;
 * elles sont toutes modifiables ensuite.
 */

export const QUARTS_PAR_DEFAUT = [
  {
    code: "OUVERTURE",
    libelle: "Ouverture",
    debut: "06:45",
    fin: "09:00",
    portee: "TOUS_GROUPES" as const,
    effectifRequis: 2,
    enchaineSur: "MATINEE",
    actif: true,
    ordre: 1,
  },
  {
    code: "MATINEE",
    libelle: "Matinée",
    debut: "09:00",
    fin: "12:00",
    portee: "PAR_GROUPE" as const,
    effectifRequis: 1,
    enchaineSur: null,
    actif: true,
    ordre: 2,
  },
  {
    code: "APRES_MIDI",
    libelle: "Après-midi",
    debut: "12:00",
    fin: "17:30",
    portee: "PAR_GROUPE" as const,
    effectifRequis: 1,
    enchaineSur: null,
    actif: true,
    ordre: 3,
  },
  {
    code: "SOIREE",
    libelle: "Soirée",
    debut: "17:30",
    fin: "18:30",
    portee: "PAR_GROUPE" as const,
    effectifRequis: 1,
    enchaineSur: null,
    actif: false,
    ordre: 4,
  },
  {
    code: "FERMETURE",
    libelle: "Fermeture",
    debut: "18:30",
    fin: "19:00",
    portee: "TOUS_GROUPES" as const,
    effectifRequis: 2,
    enchaineSur: null,
    actif: false,
    ordre: 5,
  },
];

export const TRANCHES_PAR_DEFAUT = [
  { libelle: "4-5 ans", ageMin: 4, ageMax: 5, niveauMin: 0, niveauMax: 1, ordre: 0 },
  { libelle: "6-7 ans", ageMin: 6, ageMax: 7, niveauMin: 2, niveauMax: 3, ordre: 1 },
  { libelle: "8-9 ans", ageMin: 8, ageMax: 9, niveauMin: 4, niveauMax: 5, ordre: 2 },
  { libelle: "10-12 ans", ageMin: 10, ageMax: 12, niveauMin: 6, niveauMax: 6, ordre: 3 },
];

/** Quarts par défaut, horaires convertis en minutes depuis minuit. */
export function quartsPourCreation(anneeScolaireId: string) {
  return QUARTS_PAR_DEFAUT.map((q) => ({
    anneeScolaireId,
    code: q.code,
    libelle: q.libelle,
    debutMinutes: versMinutes(q.debut),
    finMinutes: versMinutes(q.fin),
    portee: q.portee,
    effectifRequis: q.effectifRequis,
    actif: q.actif,
    ordre: q.ordre,
  }));
}

export function tranchesPourCreation(anneeScolaireId: string) {
  return TRANCHES_PAR_DEFAUT.map((t) => ({ ...t, anneeScolaireId }));
}

/** Libellé conventionnel d'une année scolaire à partir de sa date de début. */
export function libelleAnnee(dateDebut: Date): string {
  const a = dateDebut.getUTCFullYear();
  // Une année qui commence avant août appartient encore à l'année précédente.
  return dateDebut.getUTCMonth() >= 6 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}
