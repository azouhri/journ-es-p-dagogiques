import "server-only";

import ExcelJS from "exceljs";

/**
 * Lecture et écriture de classeurs Excel.
 *
 * Le CSV a été abandonné : il oblige la responsable à connaître un séparateur,
 * un encodage et un format de date, et un double-clic sur le fichier produit
 * souvent une colonne unique illisible. Un classeur .xlsx s'ouvre, se modifie
 * et se réenregistre sans rien savoir de tout cela.
 */

// Palette commune à tous les classeurs produits par l'application.
export const ACCENT = "FF1F4E8C";
export const ACCENT_PALE = "FFE6EEF8";
export const ZEBRE = "FFF7F8FA";
export const TRAIT = "FFD2D6DC";
export const ALERTE = "FFFDECEC";
export const GRIS_DOUX = "FF6B7280";

export const BORDURE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: TRAIT } },
  left: { style: "thin", color: { argb: TRAIT } },
  bottom: { style: "thin", color: { argb: TRAIT } },
  right: { style: "thin", color: { argb: TRAIT } },
};

/**
 * En-tête : fond accentué, texte blanc, ligne figée et filtre automatique.
 *
 * Le figeage compte autant que la couleur : sans lui, la ligne d'en-tête
 * disparaît dès qu'on fait défiler quelques centaines de lignes.
 */
export function habillerEntete(feuille: ExcelJS.Worksheet, numeroLigne = 1) {
  const ligne = feuille.getRow(numeroLigne);
  ligne.height = 22;
  ligne.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  ligne.alignment = { vertical: "middle" };

  // On parcourt les colonnes plutôt que les cellules écrites : sinon une
  // colonne vide laisserait un trou blanc au milieu du bandeau.
  for (let c = 1; c <= feuille.columnCount; c++) {
    const cellule = ligne.getCell(c);
    cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    cellule.border = BORDURE;
  }

  feuille.views = [{ state: "frozen", ySplit: numeroLigne }];
  if (feuille.columnCount > 0) {
    feuille.autoFilter = {
      from: { row: numeroLigne, column: 1 },
      to: { row: numeroLigne, column: feuille.columnCount },
    };
  }
}

/** Zébrures, bordures et alignements sur les lignes de données. */
export function habillerCorps(
  feuille: ExcelJS.Worksheet,
  options: {
    premiereLigne?: number;
    surligner?: (ligne: ExcelJS.Row) => string | null;
  } = {},
) {
  const premiere = options.premiereLigne ?? 2;

  for (let n = premiere; n <= feuille.rowCount; n++) {
    const ligne = feuille.getRow(n);
    ligne.height = 18;
    ligne.alignment = { vertical: "middle" };

    const surlignage = options.surligner?.(ligne) ?? null;
    // Zébrure calculée depuis la première ligne de DONNÉES : sinon un bandeau
    // de titre au-dessus inverse le motif.
    const fond = surlignage ?? ((n - premiere) % 2 === 1 ? ZEBRE : null);

    for (let c = 1; c <= feuille.columnCount; c++) {
      const cellule = ligne.getCell(c);
      cellule.border = BORDURE;
      if (fond) {
        cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fond } };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export interface ClasseurLu {
  entetes: string[];
  lignes: string[][];
}

/** Rend une cellule sous forme de texte, quel que soit son type Excel. */
function celluleEnTexte(valeur: ExcelJS.CellValue): string {
  if (valeur === null || valeur === undefined) return "";

  // Une date saisie dans Excel arrive en objet Date : on la normalise en ISO
  // pour que l'analyse n'ait pas à deviner l'ordre jour/mois.
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);

  if (typeof valeur === "object") {
    if ("text" in valeur && typeof valeur.text === "string") return valeur.text;
    if ("result" in valeur) return String(valeur.result ?? "");
    if ("richText" in valeur && Array.isArray(valeur.richText)) {
      return valeur.richText.map((f) => f.text).join("");
    }
    if ("hyperlink" in valeur && "text" in valeur) return String(valeur.text ?? "");
  }

  return String(valeur);
}

/**
 * Lit la première feuille d'un classeur.
 *
 * Les lignes entièrement vides sont ignorées : Excel en laisse volontiers
 * quelques centaines sous les données réelles.
 */
export async function lireClasseur(donnees: ArrayBuffer): Promise<ClasseurLu> {
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(donnees);

  const feuille = classeur.worksheets[0];
  if (!feuille) return { entetes: [], lignes: [] };

  const toutes: string[][] = [];
  feuille.eachRow({ includeEmpty: false }, (ligne) => {
    const cellules: string[] = [];
    // `values` est décalé d'un cran : l'indice 0 n'est jamais utilisé.
    const valeurs = ligne.values as ExcelJS.CellValue[];
    for (let c = 1; c < valeurs.length; c++) {
      cellules[c - 1] = celluleEnTexte(valeurs[c]).trim();
    }
    for (let c = 0; c < cellules.length; c++) cellules[c] ??= "";
    toutes.push(cellules);
  });

  const utiles = toutes.filter((l) => l.some((c) => c !== ""));

  // Les classeurs produits ici portent un bandeau de titre au-dessus du
  // tableau. Prendre bêtement la première ligne non vide ferait passer ce
  // titre pour les en-têtes, et TOUT export réimporté serait refusé.
  //
  // Une ligne de titre est fusionnée sur la largeur : elle ne contient donc
  // qu'une seule valeur distincte, répétée. Une vraie ligne d'en-têtes en
  // contient plusieurs. On retient la première qui en présente au moins deux.
  const indexEntetes = utiles.findIndex(
    (ligne) => new Set(ligne.filter((c) => c !== "")).size >= 2,
  );
  const debut = indexEntetes === -1 ? 0 : indexEntetes;

  const entetes = utiles[debut] ?? [];
  const corps = utiles.slice(debut + 1);

  return { entetes: entetes.map((e) => e.trim()), lignes: corps };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export interface ColonneClasseur {
  entete: string;
  largeur?: number;
  /** Texte d'aide inscrit en commentaire sur l'en-tête. */
  note?: string;
}

export interface OptionsClasseur {
  nomFeuille: string;
  titre?: string;
  sousTitre?: string;
  colonnes: ColonneClasseur[];
  lignes: Array<Array<string | number | Date | null | undefined>>;
  surligner?: (ligne: ExcelJS.Row) => string | null;
}

/** Construit un classeur d'une feuille, mis en forme. */
export async function ecrireClasseur(
  options: OptionsClasseur,
): Promise<ExcelJS.Buffer> {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "Journées pédagogiques";

  const feuille = classeur.addWorksheet(options.nomFeuille, {
    properties: { tabColor: { argb: ACCENT } },
  });

  feuille.columns = options.colonnes.map((c) => ({
    width: c.largeur ?? Math.max(14, c.entete.length + 4),
  }));

  let ligneEntete = 1;

  if (options.titre) {
    feuille.addRow([options.titre]);
    feuille.mergeCells(1, 1, 1, options.colonnes.length);
    feuille.getCell("A1").font = { bold: true, size: 14, color: { argb: ACCENT } };
    feuille.getRow(1).height = 24;
    ligneEntete = 2;

    if (options.sousTitre) {
      feuille.addRow([options.sousTitre]);
      feuille.mergeCells(2, 1, 2, options.colonnes.length);
      feuille.getCell("A2").font = { size: 10, color: { argb: GRIS_DOUX } };
      ligneEntete = 3;
    }
  }

  feuille.addRow(options.colonnes.map((c) => c.entete));

  for (const [i, colonne] of options.colonnes.entries()) {
    if (!colonne.note) continue;
    feuille.getRow(ligneEntete).getCell(i + 1).note = colonne.note;
  }

  for (const ligne of options.lignes) {
    feuille.addRow(ligne.map((v) => (v === null || v === undefined ? "" : v)));
  }

  habillerEntete(feuille, ligneEntete);
  habillerCorps(feuille, {
    premiereLigne: ligneEntete + 1,
    surligner: options.surligner,
  });

  return classeur.xlsx.writeBuffer();
}
