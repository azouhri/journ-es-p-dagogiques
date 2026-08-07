import type { ColonneClasseur } from "@/lib/xlsx";

/**
 * Colonnes des classeurs, partagées par l'export, le modèle vierge et l'aide
 * affichée à l'import.
 *
 * Volontairement hors des fichiers « use server » : ceux-ci ne peuvent
 * exporter que des fonctions asynchrones. Les rassembler ici garantit surtout
 * qu'un modèle et son import ne peuvent pas diverger — un modèle aux en-têtes
 * décalées produirait des fichiers systématiquement refusés.
 */

export const COLONNES_ELEVES: ColonneClasseur[] = [
  { entete: "Nom", largeur: 22, note: "Obligatoire." },
  { entete: "Prénom", largeur: 22, note: "Obligatoire." },
  {
    entete: "Date de naissance",
    largeur: 20,
    note: "Obligatoire. 2017-04-12 ou 12/04/2017.",
  },
  {
    entete: "Niveau scolaire",
    largeur: 18,
    note: "Facultatif. Maternelle, 1re année… 6e année.",
  },
  { entete: "Notes", largeur: 40, note: "Facultatif." },
];

export const COLONNES_EDUCATEURS: ColonneClasseur[] = [
  { entete: "Nom", largeur: 22, note: "Obligatoire." },
  { entete: "Prénom", largeur: 22, note: "Obligatoire." },
  { entete: "Courriel", largeur: 34, note: "Facultatif, mais unique." },
  {
    entete: "Statut",
    largeur: 18,
    note: "Temps plein, Temps partiel, Occasionnel ou Remplaçant.",
  },
  {
    entete: "Date d'embauche",
    largeur: 18,
    note: "Facultatif. 2021-08-15 ou 15/08/2021.",
  },
];

/** Ligne d'exemple des modèles : montrer le format vaut mieux que le décrire. */
export const EXEMPLE_ELEVE = ["Côté", "Alice", "2017-04-12", "3e année", ""];

export const EXEMPLE_EDUCATEUR = [
  "Tremblay",
  "Marie-Claude",
  "mc.tremblay@ecole.qc.ca",
  "Temps plein",
  "2021-08-15",
];
