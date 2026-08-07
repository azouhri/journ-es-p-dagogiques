/**
 * Lecture et écriture de CSV — spec §5.1, §5.2.
 *
 * Écrit à la main plutôt qu'importé : le besoin tient en cent lignes, et les
 * fichiers viendront d'Excel en français, ce qui impose deux tolérances que
 * les bibliothèques génériques ne gèrent pas toujours d'office —
 * le séparateur point-virgule et le BOM UTF-8.
 */

/** Séparateurs reconnus, par ordre de fréquence dans les exports scolaires. */
const SEPARATEURS = [";", ",", "\t"] as const;
export type Separateur = (typeof SEPARATEURS)[number];

/**
 * Devine le séparateur en comparant le nombre de colonnes obtenu sur la
 * première ligne. Excel en français exporte en point-virgule ; un export
 * anglophone ou programmatique, en virgule.
 */
export function devinerSeparateur(texte: string): Separateur {
  const premiereLigne = texte.split(/\r?\n/, 1)[0] ?? "";
  let meilleur: Separateur = ",";
  let maxColonnes = 0;

  for (const separateur of SEPARATEURS) {
    const colonnes = decouperLigne(premiereLigne, separateur).length;
    if (colonnes > maxColonnes) {
      maxColonnes = colonnes;
      meilleur = separateur;
    }
  }
  return meilleur;
}

/** Découpe une ligne unique en respectant les guillemets. */
function decouperLigne(ligne: string, separateur: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let dansGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (dansGuillemets) {
      if (c === '"') {
        // Un guillemet doublé à l'intérieur d'un champ vaut un guillemet.
        if (ligne[i + 1] === '"') {
          courant += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        courant += c;
      }
    } else if (c === '"') {
      dansGuillemets = true;
    } else if (c === separateur) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs;
}

export interface CsvAnalyse {
  entetes: string[];
  lignes: string[][];
  separateur: Separateur;
}

/**
 * Analyse un CSV complet.
 *
 * Gère les sauts de ligne À L'INTÉRIEUR d'un champ entre guillemets : un nom
 * ou une note libre peut légitimement en contenir, et un découpage naïf sur
 * `\n` casserait tout le reste du fichier.
 */
export function analyserCsv(texte: string, separateurImpose?: Separateur): CsvAnalyse {
  // Excel préfixe volontiers ses exports UTF-8 d'un BOM : sans ce retrait, le
  // premier en-tête s'appellerait « ﻿nom » et ne serait jamais reconnu.
  const propre = texte.replace(/^﻿/, "");
  const separateur = separateurImpose ?? devinerSeparateur(propre);

  const lignes: string[][] = [];
  let champs: string[] = [];
  let courant = "";
  let dansGuillemets = false;

  const finirChamp = () => {
    champs.push(courant);
    courant = "";
  };
  const finirLigne = () => {
    finirChamp();
    lignes.push(champs);
    champs = [];
  };

  for (let i = 0; i < propre.length; i++) {
    const c = propre[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (propre[i + 1] === '"') {
          courant += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        courant += c;
      }
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
    } else if (c === separateur) {
      finirChamp();
    } else if (c === "\n") {
      finirLigne();
    } else if (c === "\r") {
      // Ignoré : le \n qui suit termine la ligne.
    } else {
      courant += c;
    }
  }

  // Dernière ligne sans saut final.
  if (courant.length > 0 || champs.length > 0) finirLigne();

  // Lignes entièrement vides : fréquentes en fin de fichier Excel.
  const utiles = lignes.filter((l) => l.some((champ) => champ.trim() !== ""));
  const [entetes = [], ...corps] = utiles;

  return {
    entetes: entetes.map((e) => e.trim()),
    lignes: corps,
    separateur,
  };
}

/** Échappe un champ pour l'écriture. */
function echapper(valeur: string, separateur: string): string {
  const doitEchapper =
    valeur.includes(separateur) ||
    valeur.includes('"') ||
    valeur.includes("\n") ||
    valeur.includes("\r");
  return doitEchapper ? `"${valeur.replace(/"/g, '""')}"` : valeur;
}

/**
 * Produit un CSV.
 *
 * Le BOM est ajouté volontairement : sans lui, Excel sous Windows lit un
 * export UTF-8 en ANSI et « Côté » devient « CÃ´tÃ© ».
 */
export function genererCsv(
  entetes: string[],
  lignes: Array<Array<string | number | null | undefined>>,
  separateur: Separateur = ";",
): string {
  const toutes = [
    entetes,
    ...lignes.map((l) => l.map((v) => (v === null || v === undefined ? "" : String(v)))),
  ];
  const corps = toutes
    .map((ligne) => ligne.map((champ) => echapper(String(champ), separateur)).join(separateur))
    .join("\r\n");
  return `﻿${corps}`;
}

/**
 * Associe les en-têtes d'un fichier aux champs attendus.
 *
 * La comparaison ignore la casse, les accents et les espaces : « Date de
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

/** Index de chaque alias reconnu, ou -1. */
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
 * Retourne null si la date est absente, mal formée ou inexistante.
 */
export function analyserDate(valeur: string): Date | null {
  const brut = valeur.trim();
  if (!brut) return null;

  let annee: number;
  let mois: number;
  let jour: number;

  const iso = brut.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
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
