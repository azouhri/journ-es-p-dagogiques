import "server-only";

import ExcelJS from "exceljs";

import { versTexteFr } from "@/lib/domain/temps";
import type { JourneeExport } from "./donnees";

const dateIso = (d: Date) => d.toISOString().slice(0, 10);

// Palette alignée sur celle du PDF, pour que les deux exports se ressemblent.
const ACCENT = "FF1F4E8C";
const ACCENT_PALE = "FFE6EEF8";
const ZEBRE = "FFF7F8FA";
const TRAIT = "FFD2D6DC";
const ALERTE = "FFFDECEC";

const BORDURE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: TRAIT } },
  left: { style: "thin", color: { argb: TRAIT } },
  bottom: { style: "thin", color: { argb: TRAIT } },
  right: { style: "thin", color: { argb: TRAIT } },
};

/**
 * En-tête : fond accentué, texte blanc, ligne figée et filtre automatique.
 *
 * Le figeage compte autant que la couleur : sans lui, la ligne d'en-tête
 * disparaît dès qu'on fait défiler quelques centaines d'élèves.
 */
function habillerEntete(feuille: ExcelJS.Worksheet, numeroLigne = 1) {
  const ligne = feuille.getRow(numeroLigne);
  ligne.height = 22;
  ligne.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  ligne.alignment = { vertical: "middle" };

  // eachCell ignore les cellules jamais écrites : on parcourt donc les
  // colonnes, sinon une colonne vide laisserait un trou blanc dans le bandeau.
  for (let c = 1; c <= feuille.columnCount; c++) {
    const cellule = ligne.getCell(c);
    cellule.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ACCENT },
    };
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

/** Zébrures, bordures et alignements sur toutes les lignes de données. */
function habillerCorps(
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
    // Zébrure calculée depuis la PREMIÈRE ligne de données, pas depuis le haut
    // de la feuille : sinon le décalage du bandeau de titre inverse le motif.
    const fond =
      surlignage ?? ((n - premiere) % 2 === 1 ? ZEBRE : null);

    for (let c = 1; c <= feuille.columnCount; c++) {
      const cellule = ligne.getCell(c);
      cellule.border = BORDURE;
      if (fond) {
        cellule.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fond },
        };
      }
    }
  }
}

/** §6 étape 8 — planning en Excel, pour retraitement. */
export async function planningXlsx(
  journee: JourneeExport,
): Promise<ExcelJS.Buffer> {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "Generateur de planning des journees pedagogiques";
  classeur.created = journee.creeeLe;

  // --- Résumé -------------------------------------------------------------
  // Le bandeau de titre est écrit AVANT le tableau. Le construire après, par
  // insertion de lignes, décalerait les données sans emporter leur mise en
  // forme : bordures et zébrures resteraient sur les mauvaises lignes.
  const resume = classeur.addWorksheet("Résumé", {
    properties: { tabColor: { argb: ACCENT } },
  });
  resume.columns = [
    { key: "date", width: 14 },
    { key: "groupes", width: 11 },
    { key: "eleves", width: 11 },
    { key: "educateurs", width: 22 },
    { key: "affectations", width: 14 },
  ];

  resume.addRow([journee.nom]);
  resume.addRow([`Année scolaire ${journee.anneeScolaire.libelle}`]);
  resume.mergeCells("A1:E1");
  resume.mergeCells("A2:E2");
  resume.getCell("A1").font = { bold: true, size: 14, color: { argb: ACCENT } };
  resume.getRow(1).height = 24;
  resume.getCell("A2").font = { size: 10, color: { argb: "FF6B7280" } };

  resume.addRow([
    "Date",
    "Groupes",
    "Élèves",
    "Éducateurs mobilisés",
    "Affectations",
  ]);

  for (const jour of journee.jours) {
    resume.addRow({
      date: dateIso(jour.date),
      groupes: jour.groupes.length,
      eleves: jour.groupes.reduce((s, g) => s + g.membres.length, 0),
      educateurs: new Set(jour.affectations.map((a) => a.educateurId)).size,
      affectations: jour.affectations.length,
    });
  }

  habillerEntete(resume, 3);
  habillerCorps(resume, { premiereLigne: 4 });

  // --- Planning -----------------------------------------------------------
  const planning = classeur.addWorksheet("Planning");
  planning.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Quart", key: "quart", width: 15 },
    { header: "Début", key: "debut", width: 10 },
    { header: "Fin", key: "fin", width: 10 },
    { header: "Éducateur", key: "educateur", width: 28 },
    { header: "Groupe", key: "groupe", width: 20 },
    { header: "Enchaînement", key: "enchainement", width: 15 },
    { header: "Ajusté à la main", key: "ajuste", width: 17 },
    { header: "Justification", key: "justification", width: 62 },
  ];

  for (const jour of journee.jours) {
    for (const a of jour.affectations) {
      planning.addRow({
        date: dateIso(jour.date),
        quart: a.quartLibelle,
        // §4.6 — on exporte les horaires FIGÉS dans l'affectation, pas ceux du
        // type de quart actuel : c'est la journée telle qu'elle a été vécue.
        debut: versTexteFr(a.quartDebutMinutes),
        fin: versTexteFr(a.quartFinMinutes),
        educateur: `${a.educateur.nom} ${a.educateur.prenom}`,
        groupe: a.groupe?.libelle ?? "tous groupes",
        enchainement: a.issueEnchainement ? "oui" : "",
        ajuste: a.ajusteeManuellement ? "oui" : "",
        justification: a.justification ?? "",
      });
    }
  }
  habillerEntete(planning);
  habillerCorps(planning, {
    // Une permutation manuelle est signalée : c'est le seul endroit du
    // planning qui ne découle pas des compteurs.
    surligner: (ligne) =>
      ligne.getCell("ajuste").value === "oui" ? ACCENT_PALE : null,
  });
  planning.getColumn("justification").alignment = {
    wrapText: true,
    vertical: "middle",
  };

  // --- Groupes ------------------------------------------------------------
  const groupes = classeur.addWorksheet("Groupes");
  groupes.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Groupe", key: "groupe", width: 20 },
    { header: "Nom", key: "nom", width: 22 },
    { header: "Prénom", key: "prenom", width: 22 },
    { header: "Date de naissance", key: "naissance", width: 19 },
  ];

  for (const jour of journee.jours) {
    for (const groupe of jour.groupes) {
      const membres = [...groupe.membres].sort(
        (a, b) =>
          a.eleve.nom.localeCompare(b.eleve.nom, "fr") ||
          a.eleve.prenom.localeCompare(b.eleve.prenom, "fr"),
      );
      for (const m of membres) {
        groupes.addRow({
          date: dateIso(jour.date),
          groupe: groupe.libelle,
          nom: m.eleve.nom,
          prenom: m.eleve.prenom,
          naissance: dateIso(m.eleve.dateNaissance),
        });
      }
    }
  }
  habillerEntete(groupes);

  const capacite = 20;
  const effectifs = new Map<string, number>();
  for (const jour of journee.jours) {
    for (const g of jour.groupes) {
      effectifs.set(`${dateIso(jour.date)}|${g.libelle}`, g.membres.length);
    }
  }
  habillerCorps(groupes, {
    // §3 — un groupe au plafond réglementaire saute aux yeux.
    surligner: (ligne) => {
      const cle = `${ligne.getCell("date").value}|${ligne.getCell("groupe").value}`;
      return (effectifs.get(cle) ?? 0) >= capacite ? ALERTE : null;
    },
  });

  return classeur.xlsx.writeBuffer();
}
