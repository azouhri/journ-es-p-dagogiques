/**
 * Import CSV des élèves et des éducateurs — spec §5.1, §5.2.
 *
 * « Import CSV avec prévisualisation, détection des doublons sur nom + date de
 * naissance, et rapport d'erreurs ligne par ligne AVANT validation. »
 *
 * Rien n'est écrit en base ici : ce module produit un rapport que l'écran
 * affiche, et la responsable décide ensuite d'importer ou non.
 */

import { analyserCsv, analyserDate, trouverColonne, type Separateur } from "./csv";

export type StatutLigne =
  | "nouveau"
  | "doublon_fichier"
  | "doublon_base"
  | "erreur";

export interface LigneImport<T> {
  /** Numéro de ligne dans le fichier, en-tête comprise — celui qu'affiche Excel. */
  numeroLigne: number;
  valeurs: string[];
  donnees: T | null;
  erreurs: string[];
  statut: StatutLigne;
}

export interface RapportImport<T> {
  lignes: LigneImport<T>[];
  entetesManquantes: string[];
  nbNouveaux: number;
  nbDoublons: number;
  nbErreurs: number;
  separateur: Separateur;
}

export interface EleveImporte {
  nom: string;
  prenom: string;
  dateNaissance: Date;
  niveauScolaire: number | null;
  notes: string | null;
}

const ALIAS_ELEVE = {
  nom: ["nom", "nom de famille", "last name"],
  prenom: ["prenom", "prénom", "first name"],
  dateNaissance: ["date de naissance", "datenaissance", "naissance", "ddn"],
  niveauScolaire: ["niveau scolaire", "niveau", "degre"],
  notes: ["notes", "note", "remarques"],
} as const;

/** Clé de doublon : nom + prénom + date de naissance (§5.1). */
export function cleEleve(
  eleve: Pick<EleveImporte, "nom" | "prenom" | "dateNaissance">,
): string {
  return [
    eleve.nom.trim().toLowerCase(),
    eleve.prenom.trim().toLowerCase(),
    eleve.dateNaissance.toISOString().slice(0, 10),
  ].join("|");
}

/**
 * Analyse un fichier d'élèves.
 *
 * @param clesExistantes clés (voir `cleEleve`) déjà présentes en base, pour
 *        distinguer un doublon interne au fichier d'un doublon avec l'existant.
 */
export function analyserImportEleves(
  texte: string,
  clesExistantes: ReadonlySet<string> = new Set(),
): RapportImport<EleveImporte> {
  const { entetes, lignes, separateur } = analyserCsv(texte);

  const index = {
    nom: trouverColonne(entetes, ALIAS_ELEVE.nom),
    prenom: trouverColonne(entetes, ALIAS_ELEVE.prenom),
    dateNaissance: trouverColonne(entetes, ALIAS_ELEVE.dateNaissance),
    niveauScolaire: trouverColonne(entetes, ALIAS_ELEVE.niveauScolaire),
    notes: trouverColonne(entetes, ALIAS_ELEVE.notes),
  };

  // §5.1 — le nom, le prénom et la date de naissance sont obligatoires ;
  // le niveau scolaire ne l'est pas.
  const entetesManquantes: string[] = [];
  if (index.nom === -1) entetesManquantes.push("nom");
  if (index.prenom === -1) entetesManquantes.push("prénom");
  if (index.dateNaissance === -1) entetesManquantes.push("date de naissance");

  const resultat: LigneImport<EleveImporte>[] = [];
  const vuesDansLeFichier = new Set<string>();

  lignes.forEach((valeurs, i) => {
    const numeroLigne = i + 2; // +1 pour l'en-tête, +1 car Excel compte à partir de 1
    const erreurs: string[] = [];

    if (entetesManquantes.length > 0) {
      resultat.push({
        numeroLigne,
        valeurs,
        donnees: null,
        erreurs: [`Colonnes absentes : ${entetesManquantes.join(", ")}.`],
        statut: "erreur",
      });
      return;
    }

    const lire = (col: number) => (col === -1 ? "" : (valeurs[col] ?? "").trim());

    const nom = lire(index.nom);
    const prenom = lire(index.prenom);
    const dateBrute = lire(index.dateNaissance);
    const niveauBrut = lire(index.niveauScolaire);
    const notes = lire(index.notes);

    if (!nom) erreurs.push("Nom manquant.");
    if (!prenom) erreurs.push("Prénom manquant.");

    const dateNaissance = analyserDate(dateBrute);
    if (!dateBrute) {
      erreurs.push("Date de naissance manquante.");
    } else if (!dateNaissance) {
      erreurs.push(
        `Date de naissance illisible : « ${dateBrute} ». Formats acceptés : 2017-04-12 ou 12/04/2017.`,
      );
    } else if (dateNaissance > new Date()) {
      erreurs.push("Date de naissance dans le futur.");
    }

    let niveauScolaire: number | null = null;
    if (niveauBrut) {
      const n = Number(niveauBrut);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        erreurs.push(
          `Niveau scolaire invalide : « ${niveauBrut} ». Attendu : un entier de 0 (maternelle) à 6.`,
        );
      } else {
        niveauScolaire = n;
      }
    }

    if (erreurs.length > 0 || !dateNaissance) {
      resultat.push({ numeroLigne, valeurs, donnees: null, erreurs, statut: "erreur" });
      return;
    }

    const donnees: EleveImporte = {
      nom,
      prenom,
      dateNaissance,
      niveauScolaire,
      notes: notes || null,
    };

    const cle = cleEleve(donnees);
    let statut: StatutLigne = "nouveau";
    if (vuesDansLeFichier.has(cle)) {
      statut = "doublon_fichier";
      erreurs.push("Doublon : cette personne apparaît déjà plus haut dans le fichier.");
    } else if (clesExistantes.has(cle)) {
      statut = "doublon_base";
      erreurs.push("Doublon : cette personne existe déjà dans la liste des élèves.");
    }
    vuesDansLeFichier.add(cle);

    resultat.push({ numeroLigne, valeurs, donnees, erreurs, statut });
  });

  return {
    lignes: resultat,
    entetesManquantes,
    nbNouveaux: resultat.filter((l) => l.statut === "nouveau").length,
    nbDoublons: resultat.filter(
      (l) => l.statut === "doublon_fichier" || l.statut === "doublon_base",
    ).length,
    nbErreurs: resultat.filter((l) => l.statut === "erreur").length,
    separateur,
  };
}

// ---------------------------------------------------------------------------
// Éducateurs — §5.2
// ---------------------------------------------------------------------------

export type StatutEmploiImporte =
  | "TEMPS_PLEIN"
  | "TEMPS_PARTIEL"
  | "OCCASIONNEL"
  | "REMPLACANT";

export interface EducateurImporte {
  nom: string;
  prenom: string;
  courriel: string | null;
  statutEmploi: StatutEmploiImporte;
  dateEmbauche: Date | null;
}

const ALIAS_EDUCATEUR = {
  nom: ["nom", "nom de famille"],
  prenom: ["prenom", "prénom"],
  courriel: ["courriel", "email", "courrier electronique"],
  statutEmploi: ["statut", "statut d'emploi", "statutemploi"],
  dateEmbauche: ["date d'embauche", "dateembauche", "embauche"],
} as const;

const STATUTS: Record<string, StatutEmploiImporte> = {
  tempsplein: "TEMPS_PLEIN",
  pleintemps: "TEMPS_PLEIN",
  tempspartiel: "TEMPS_PARTIEL",
  partiel: "TEMPS_PARTIEL",
  occasionnel: "OCCASIONNEL",
  remplacant: "REMPLACANT",
};

export function analyserImportEducateurs(
  texte: string,
  courrielsExistants: ReadonlySet<string> = new Set(),
): RapportImport<EducateurImporte> {
  const { entetes, lignes, separateur } = analyserCsv(texte);

  const index = {
    nom: trouverColonne(entetes, ALIAS_EDUCATEUR.nom),
    prenom: trouverColonne(entetes, ALIAS_EDUCATEUR.prenom),
    courriel: trouverColonne(entetes, ALIAS_EDUCATEUR.courriel),
    statutEmploi: trouverColonne(entetes, ALIAS_EDUCATEUR.statutEmploi),
    dateEmbauche: trouverColonne(entetes, ALIAS_EDUCATEUR.dateEmbauche),
  };

  const entetesManquantes: string[] = [];
  if (index.nom === -1) entetesManquantes.push("nom");
  if (index.prenom === -1) entetesManquantes.push("prénom");

  const resultat: LigneImport<EducateurImporte>[] = [];
  const vus = new Set<string>();

  lignes.forEach((valeurs, i) => {
    const numeroLigne = i + 2;
    const erreurs: string[] = [];

    if (entetesManquantes.length > 0) {
      resultat.push({
        numeroLigne,
        valeurs,
        donnees: null,
        erreurs: [`Colonnes absentes : ${entetesManquantes.join(", ")}.`],
        statut: "erreur",
      });
      return;
    }

    const lire = (col: number) => (col === -1 ? "" : (valeurs[col] ?? "").trim());

    const nom = lire(index.nom);
    const prenom = lire(index.prenom);
    const courriel = lire(index.courriel);
    const statutBrut = lire(index.statutEmploi);
    const embaucheBrute = lire(index.dateEmbauche);

    if (!nom) erreurs.push("Nom manquant.");
    if (!prenom) erreurs.push("Prénom manquant.");

    if (courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
      erreurs.push(`Courriel invalide : « ${courriel} ».`);
    }

    let statutEmploi: StatutEmploiImporte = "TEMPS_PLEIN";
    if (statutBrut) {
      const normalise = statutBrut
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      const trouve = STATUTS[normalise];
      if (!trouve) {
        erreurs.push(
          `Statut d'emploi inconnu : « ${statutBrut} ». Attendu : temps plein, temps partiel, occasionnel ou remplaçant.`,
        );
      } else {
        statutEmploi = trouve;
      }
    }

    let dateEmbauche: Date | null = null;
    if (embaucheBrute) {
      dateEmbauche = analyserDate(embaucheBrute);
      if (!dateEmbauche) {
        erreurs.push(`Date d'embauche illisible : « ${embaucheBrute} ».`);
      }
    }

    if (erreurs.length > 0) {
      resultat.push({ numeroLigne, valeurs, donnees: null, erreurs, statut: "erreur" });
      return;
    }

    const donnees: EducateurImporte = {
      nom,
      prenom,
      courriel: courriel || null,
      statutEmploi,
      dateEmbauche,
    };

    // Le courriel est la seule contrainte d'unicité côté éducateur.
    let statut: StatutLigne = "nouveau";
    if (courriel) {
      const cle = courriel.toLowerCase();
      if (vus.has(cle)) {
        statut = "doublon_fichier";
        erreurs.push("Doublon : ce courriel apparaît déjà plus haut dans le fichier.");
      } else if (courrielsExistants.has(cle)) {
        statut = "doublon_base";
        erreurs.push("Doublon : ce courriel est déjà utilisé par un éducateur.");
      }
      vus.add(cle);
    }

    resultat.push({ numeroLigne, valeurs, donnees, erreurs, statut });
  });

  return {
    lignes: resultat,
    entetesManquantes,
    nbNouveaux: resultat.filter((l) => l.statut === "nouveau").length,
    nbDoublons: resultat.filter(
      (l) => l.statut === "doublon_fichier" || l.statut === "doublon_base",
    ).length,
    nbErreurs: resultat.filter((l) => l.statut === "erreur").length,
    separateur,
  };
}
