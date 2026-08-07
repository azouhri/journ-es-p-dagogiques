/**
 * Utilitaires de lecture d'un tableur — indépendants du format de fichier.
 *
 * Isolés ici pour que l'analyse d'un import reste une fonction pure, testable
 * sans classeur ni base de données : elle ne voit que des en-têtes et des
 * lignes de texte.
 */

/** Lignes d'un tableur, telles que présentées à l'analyse. */
export interface Feuille {
  entetes: string[];
  lignes: string[][];
}

/**
 * Normalise un en-tête pour la comparaison.
 *
 * La casse, les accents et la ponctuation sont ignorés : « Date de
 * naissance », « date_de_naissance » et « DATE DE NAISSANCE » désignent la
 * même colonne. Sans cette tolérance, un import échouerait pour un accent.
 */
export function normaliserEntete(entete: string): string {
  return entete
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Index de la première colonne correspondant à l'un des alias, ou -1. */
export function trouverColonne(
  entetes: string[],
  alias: readonly string[],
): number {
  const normalises = entetes.map(normaliserEntete);
  for (const a of alias) {
    const index = normalises.indexOf(normaliserEntete(a));
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * Lit une date au format ISO (2017-04-12) ou québécois (12/04/2017).
 *
 * Excel restitue déjà ses cellules de type date en ISO ; ce sont les colonnes
 * saisies en texte qui arrivent dans l'autre ordre. Retourne null si la date
 * est absente, mal formée ou inexistante.
 */
export function analyserDate(valeur: string): Date | null {
  const brut = valeur.trim();
  if (!brut) return null;

  let annee: number;
  let mois: number;
  let jour: number;

  const iso = brut.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const local = brut.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (iso) {
    annee = Number(iso[1]);
    mois = Number(iso[2]);
    jour = Number(iso[3]);
  } else if (local) {
    jour = Number(local[1]);
    mois = Number(local[2]);
    annee = Number(local[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(annee, mois - 1, jour));
  // Rejette le 31 février : Date « corrige » silencieusement en 3 mars.
  if (
    date.getUTCFullYear() !== annee ||
    date.getUTCMonth() !== mois - 1 ||
    date.getUTCDate() !== jour
  ) {
    return null;
  }
  return date;
}

/** Libellés de niveau scolaire, dans l'ordre de l'ordinal stocké. */
export const NIVEAUX_SCOLAIRES = [
  "Maternelle",
  "1re année",
  "2e année",
  "3e année",
  "4e année",
  "5e année",
  "6e année",
];

/**
 * Lit un niveau scolaire, en chiffre ou en toutes lettres.
 *
 * L'export écrit « 3e année » parce que c'est lisible ; l'import doit donc
 * savoir le relire, sinon exporter puis réimporter — le geste le plus naturel
 * qui soit — échouerait sur chaque ligne.
 *
 * Retourne `undefined` si la valeur est inexploitable, `null` si elle est vide.
 */
export function analyserNiveauScolaire(
  valeur: string,
): number | null | undefined {
  const brut = valeur.trim();
  if (!brut) return null;

  const nombre = Number(brut);
  if (Number.isInteger(nombre)) {
    return nombre >= 0 && nombre <= 6 ? nombre : undefined;
  }

  const normalise = normaliserEntete(brut);
  const index = NIVEAUX_SCOLAIRES.findIndex(
    (l) => normaliserEntete(l) === normalise,
  );
  if (index !== -1) return index;

  // « 3e », « 3eme », « 3 annee »…
  const chiffre = normalise.match(/^(\d)/);
  if (chiffre) {
    const n = Number(chiffre[1]);
    if (n >= 1 && n <= 6) return n;
  }

  return undefined;
}

/** Vrai pour « oui », « o », « x », « 1 », « vrai »… */
export function estAffirmatif(valeur: string): boolean {
  return ["oui", "o", "yes", "y", "1", "vrai", "true", "x"].includes(
    normaliserEntete(valeur),
  );
}
