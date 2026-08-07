/**
 * Jeux de données partagés par les tests.
 * Reproduit la configuration initiale du §4.2 de la spécification.
 */

import { versMinutes } from "@/lib/domain/temps";
import type {
  EducateurRef,
  EleveRef,
  GroupeConstitue,
  ReglagesConfig,
  TrancheAgeConfig,
  TypeQuartConfig,
} from "@/lib/domain/types";

/** §4.2 — cinq quarts définis, trois actifs en Version 1. */
export function quartsParDefaut(): TypeQuartConfig[] {
  return [
    {
      id: "q-ouverture",
      code: "OUVERTURE",
      libelle: "Ouverture",
      debutMinutes: versMinutes("06:45"),
      finMinutes: versMinutes("09:00"),
      portee: "TOUS_GROUPES",
      effectifRequis: 2,
      enchaineSurId: "q-matinee",
      actif: true,
      ordre: 1,
    },
    {
      id: "q-matinee",
      code: "MATINEE",
      libelle: "Matinée",
      debutMinutes: versMinutes("09:00"),
      finMinutes: versMinutes("12:00"),
      portee: "PAR_GROUPE",
      effectifRequis: 1,
      enchaineSurId: null,
      actif: true,
      ordre: 2,
    },
    {
      id: "q-apres-midi",
      code: "APRES_MIDI",
      libelle: "Après-midi",
      debutMinutes: versMinutes("12:00"),
      finMinutes: versMinutes("17:30"),
      portee: "PAR_GROUPE",
      effectifRequis: 1,
      enchaineSurId: null,
      actif: true,
      ordre: 3,
    },
    {
      id: "q-soiree",
      code: "SOIREE",
      libelle: "Soirée",
      debutMinutes: versMinutes("17:30"),
      finMinutes: versMinutes("18:30"),
      portee: "PAR_GROUPE",
      effectifRequis: 1,
      enchaineSurId: null,
      actif: false,
      ordre: 4,
    },
    {
      id: "q-fermeture",
      code: "FERMETURE",
      libelle: "Fermeture",
      debutMinutes: versMinutes("18:30"),
      finMinutes: versMinutes("19:00"),
      portee: "TOUS_GROUPES",
      effectifRequis: 2,
      enchaineSurId: null,
      actif: false,
      ordre: 5,
    },
  ];
}

export function tranchesParDefaut(): TrancheAgeConfig[] {
  return [
    { id: "t-4-5", libelle: "4-5 ans", ageMin: 4, ageMax: 5, niveauMin: 0, niveauMax: 1, ordre: 0 },
    { id: "t-6-7", libelle: "6-7 ans", ageMin: 6, ageMax: 7, niveauMin: 2, niveauMax: 3, ordre: 1 },
    { id: "t-8-9", libelle: "8-9 ans", ageMin: 8, ageMax: 9, niveauMin: 4, niveauMax: 5, ordre: 2 },
    { id: "t-10-12", libelle: "10-12 ans", ageMin: 10, ageMax: 12, niveauMin: 6, niveauMax: 6, ordre: 3 },
  ];
}

export function reglagesParDefaut(
  surcharge: Partial<ReglagesConfig> = {},
): ReglagesConfig {
  return {
    capaciteMaxGroupe: 20,
    ratioMaxEleves: 20,
    modeGroupement: "AGE_CALCULE",
    dateReferenceAgeJour: 30,
    dateReferenceAgeMois: 9,
    eviterMemeQuartConsecutif: true,
    continuiteTrancheAge: false,
    politiqueTrancheEducateur: "LIBRE",
    doublePoste: "SI_EFFECTIF_INSUFFISANT",
    politiqueBloc: "CHAQUE_JOUR_SEPAREMENT",
    surEffectifOuverture: "REDUIRE_AU_NOMBRE_DE_GROUPES",
    critereDepartage: "HEURES_CUMULEES",
    ...surcharge,
  };
}

/** n éducateurs nommés « Educateur 01 », … pour un tri alphabétique stable. */
export function educateurs(n: number): EducateurRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${String(i + 1).padStart(2, "0")}`,
    nom: `Nom${String(i + 1).padStart(2, "0")}`,
    prenom: `Prenom${String(i + 1).padStart(2, "0")}`,
  }));
}

/** k groupes fictifs, sans passer par la constitution. */
export function groupes(k: number): GroupeConstitue[] {
  return Array.from({ length: k }, (_, i) => ({
    id: `g-${i}`,
    trancheAgeId: `t-${i}`,
    trancheAgeLibelle: `Tranche ${i}`,
    libelle: `Groupe ${i}`,
    ordre: i,
    eleves: [],
  }));
}

/** Un élève dont l'âge à la date de référence vaut `age`. */
export function eleveDAge(id: string, age: number, dateReference: Date): EleveRef {
  return {
    id,
    nom: `Nom-${id}`,
    prenom: `Prenom-${id}`,
    // Anniversaire un mois AVANT la date de référence : l'âge est déjà atteint.
    dateNaissance: new Date(
      Date.UTC(
        dateReference.getUTCFullYear() - age,
        dateReference.getUTCMonth() - 1,
        15,
      ),
    ),
    niveauScolaire: null,
  };
}

export const DATE_REFERENCE_2025 = new Date(Date.UTC(2025, 8, 30)); // 30 sept. 2025
