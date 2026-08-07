import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import { versTexteFr } from "@/lib/domain/temps";
import type { JourneeExport } from "./donnees";

// ---------------------------------------------------------------------------
// Palette et mise en page
// ---------------------------------------------------------------------------

const ENCRE = rgb(0.11, 0.13, 0.18);
const ENCRE_DOUCE = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.12, 0.31, 0.55);
const ACCENT_PALE = rgb(0.9, 0.94, 0.98);
const ZEBRE = rgb(0.972, 0.976, 0.98);
const TRAIT = rgb(0.82, 0.84, 0.87);
const BLANC = rgb(1, 1, 1);

const LARGE = 612; // Lettre US, en points
const HAUT = 792;
const MARGE = 40;
const LARGEUR_UTILE = LARGE - MARGE * 2;

/**
 * Les polices standard PDF encodent en WinAnsi. Les accents français y sont
 * (é, è, à, ç, ô…), mais pas la ponctuation typographique que produit
 * l'application. On la ramène à ses équivalents ASCII plutôt que de laisser
 * pdf-lib lever une exception au milieu d'un export.
 */
function assainir(texte: string): string {
  return texte
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

/** Tronque avec une ellipse pour ne jamais déborder d'une colonne. */
function ajuster(
  texte: string,
  police: PDFFont,
  taille: number,
  largeurMax: number,
): string {
  const propre = assainir(texte);
  if (police.widthOfTextAtSize(propre, taille) <= largeurMax) return propre;

  let court = propre;
  while (
    court.length > 1 &&
    police.widthOfTextAtSize(`${court}...`, taille) > largeurMax
  ) {
    court = court.slice(0, -1);
  }
  return `${court}...`;
}

interface Polices {
  normal: PDFFont;
  gras: PDFFont;
}

class Document {
  private doc: PDFDocument;
  private polices: Polices;
  page: PDFPage;
  y: number;

  constructor(doc: PDFDocument, polices: Polices) {
    this.doc = doc;
    this.polices = polices;
    this.page = doc.addPage([LARGE, HAUT]);
    this.y = HAUT - MARGE;
  }

  nouvellePage() {
    this.page = this.doc.addPage([LARGE, HAUT]);
    this.y = HAUT - MARGE;
  }

  /** Ajoute une page si `hauteur` ne tient pas sur celle en cours. */
  reserver(hauteur: number) {
    if (this.y - hauteur < MARGE) this.nouvellePage();
  }

  texte(
    contenu: string,
    options: {
      x?: number;
      taille?: number;
      gras?: boolean;
      couleur?: RGB;
      largeurMax?: number;
    } = {},
  ) {
    const taille = options.taille ?? 10;
    const police = options.gras ? this.polices.gras : this.polices.normal;
    const contenuAjuste = options.largeurMax
      ? ajuster(contenu, police, taille, options.largeurMax)
      : assainir(contenu);

    this.page.drawText(contenuAjuste, {
      x: options.x ?? MARGE,
      y: this.y,
      size: taille,
      font: police,
      color: options.couleur ?? ENCRE,
    });
  }

  /** Bandeau de titre en tête de document. */
  entete(titre: string, sousTitre: string) {
    this.page.drawRectangle({
      x: 0,
      y: HAUT - 78,
      width: LARGE,
      height: 78,
      color: ACCENT,
    });
    this.y = HAUT - 40;
    this.texte(titre, { taille: 17, gras: true, couleur: BLANC, largeurMax: LARGEUR_UTILE });
    this.y -= 17;
    this.texte(sousTitre, { taille: 9.5, couleur: rgb(0.85, 0.9, 0.96), largeurMax: LARGEUR_UTILE });
    this.y = HAUT - 100;
  }

  /** Titre de section, souligné d'un filet accentué. */
  section(titre: string) {
    this.reserver(46);
    this.texte(titre, { taille: 12.5, gras: true, couleur: ACCENT });
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGE, y: this.y },
      end: { x: LARGE - MARGE, y: this.y },
      thickness: 1.2,
      color: ACCENT,
    });
    this.y -= 16;
  }

  get polices_() {
    return this.polices;
  }

  async sauvegarder(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export interface Colonne {
  titre: string;
  largeur: number; // en points
  alignement?: "gauche" | "droite";
}

const HAUTEUR_LIGNE = 17;
const PADDING = 5;

/**
 * Dessine un tableau : bandeau d'en-tête, filets, et lignes alternées.
 *
 * L'en-tête est redessiné à chaque saut de page — sans cela, la deuxième page
 * d'une longue liste devient illisible.
 */
function tableau(
  d: Document,
  colonnes: Colonne[],
  lignes: string[][],
  options: { couleurLigne?: (index: number) => RGB | null } = {},
) {
  const dessinerEntete = () => {
    d.reserver(HAUTEUR_LIGNE * 2);
    d.page.drawRectangle({
      x: MARGE,
      y: d.y - 4,
      width: LARGEUR_UTILE,
      height: HAUTEUR_LIGNE,
      color: ACCENT_PALE,
    });

    let x = MARGE;
    for (const col of colonnes) {
      const largeurTexte = col.largeur - PADDING * 2;
      const titre = ajuster(col.titre, d.polices_.gras, 8.5, largeurTexte);
      const decalage =
        col.alignement === "droite"
          ? col.largeur - PADDING - d.polices_.gras.widthOfTextAtSize(titre, 8.5)
          : PADDING;

      d.page.drawText(titre, {
        x: x + decalage,
        y: d.y,
        size: 8.5,
        font: d.polices_.gras,
        color: ACCENT,
      });
      x += col.largeur;
    }
    d.y -= HAUTEUR_LIGNE;
  };

  dessinerEntete();

  lignes.forEach((ligne, index) => {
    if (d.y - HAUTEUR_LIGNE < MARGE) {
      d.nouvellePage();
      dessinerEntete();
    }

    const fond = options.couleurLigne?.(index) ?? (index % 2 === 1 ? ZEBRE : null);
    if (fond) {
      d.page.drawRectangle({
        x: MARGE,
        y: d.y - 4,
        width: LARGEUR_UTILE,
        height: HAUTEUR_LIGNE,
        color: fond,
      });
    }

    let x = MARGE;
    ligne.forEach((cellule, i) => {
      const col = colonnes[i];
      if (!col) return;
      const largeurTexte = col.largeur - PADDING * 2;
      const contenu = ajuster(cellule, d.polices_.normal, 9, largeurTexte);
      const decalage =
        col.alignement === "droite"
          ? col.largeur - PADDING - d.polices_.normal.widthOfTextAtSize(contenu, 9)
          : PADDING;

      d.page.drawText(contenu, {
        x: x + decalage,
        y: d.y,
        size: 9,
        font: d.polices_.normal,
        color: i === 0 ? ENCRE : ENCRE_DOUCE,
      });
      x += col.largeur;
    });

    // Filet de séparation
    d.page.drawLine({
      start: { x: MARGE, y: d.y - 4.5 },
      end: { x: LARGE - MARGE, y: d.y - 4.5 },
      thickness: 0.4,
      color: TRAIT,
    });

    d.y -= HAUTEUR_LIGNE;
  });

  d.y -= 10;
}

async function ouvrir(): Promise<Document> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  // Le constructeur ouvre déjà la première page : l'appelant enchaîne
  // directement sur `entete`.
  return new Document(doc, { normal, gras });
}

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

// ---------------------------------------------------------------------------
// Planning — §6 étape 8
// ---------------------------------------------------------------------------

export async function planningPdf(journee: JourneeExport): Promise<Uint8Array> {
  const d = await ouvrir();

  d.entete(
    journee.nom,
    `Annee scolaire ${journee.anneeScolaire.libelle}  ·  ${journee.jours.length} jour(s) planifie(s)`,
  );

  const colonnes: Colonne[] = [
    { titre: "Quart", largeur: 110 },
    { titre: "Horaire", largeur: 105 },
    { titre: "Educateur", largeur: 170 },
    { titre: "Groupe", largeur: 147 },
  ];

  for (const jour of journee.jours) {
    d.section(dateFr.format(jour.date));

    const lignes = jour.affectations.map((a) => [
      a.quartLibelle,
      `${versTexteFr(a.quartDebutMinutes)} - ${versTexteFr(a.quartFinMinutes)}`,
      `${a.educateur.nom} ${a.educateur.prenom}${a.issueEnchainement ? "  (enchainement)" : ""}`,
      a.groupe?.libelle ?? "tous groupes",
    ]);

    if (lignes.length === 0) {
      d.texte("Aucune affectation pour ce jour.", {
        taille: 9,
        couleur: ENCRE_DOUCE,
      });
      d.y -= 20;
      continue;
    }

    tableau(d, colonnes, lignes);

    const mobilises = new Set(jour.affectations.map((a) => a.educateurId)).size;
    d.reserver(20);
    d.texte(
      `${jour.groupes.length} groupe(s)  ·  ${mobilises} educateur(s) mobilise(s)`,
      { taille: 8.5, couleur: ENCRE_DOUCE },
    );
    d.y -= 22;
  }

  return d.sauvegarder();
}

// ---------------------------------------------------------------------------
// Feuille de présence vierge — §9.7
// ---------------------------------------------------------------------------

/**
 * Feuille imprimable, volontairement VIDE : c'est la solution de repli si le
 * réseau tombe. La responsable coche sur papier, puis ressaisit.
 */
export async function feuillePresencePdf(
  journee: JourneeExport,
): Promise<Uint8Array> {
  const d = await ouvrir();
  let premiere = true;

  for (const jour of journee.jours) {
    for (const groupe of jour.groupes) {
      if (!premiere) d.nouvellePage();
      premiere = false;

      d.entete(
        `${journee.nom} - ${groupe.libelle}`,
        `${dateFr.format(jour.date)}  ·  ${groupe.membres.length} eleve(s)`,
      );

      // Encadrants du groupe, en encadré léger.
      const encadrants = jour.affectations
        .filter((a) => a.groupeId === groupe.id)
        .map(
          (a) =>
            `${a.quartLibelle} : ${a.educateur.nom} ${a.educateur.prenom}`,
        );

      if (encadrants.length > 0) {
        const hauteur = 14 + encadrants.length * 12;
        d.page.drawRectangle({
          x: MARGE,
          y: d.y - hauteur + 12,
          width: LARGEUR_UTILE,
          height: hauteur,
          color: ACCENT_PALE,
          borderColor: TRAIT,
          borderWidth: 0.5,
        });
        d.y -= 4;
        for (const ligne of encadrants) {
          d.texte(ligne, {
            x: MARGE + PADDING,
            taille: 8.5,
            couleur: ACCENT,
            largeurMax: LARGEUR_UTILE - PADDING * 2,
          });
          d.y -= 12;
        }
        d.y -= 12;
      }

      const colonnes: Colonne[] = [
        { titre: "Eleve", largeur: 230 },
        { titre: "Present", largeur: 62, alignement: "droite" },
        { titre: "Absent", largeur: 62, alignement: "droite" },
        { titre: "Arrivee", largeur: 90, alignement: "droite" },
        { titre: "Depart", largeur: 88, alignement: "droite" },
      ];

      const membres = [...groupe.membres].sort(
        (a, b) =>
          a.eleve.nom.localeCompare(b.eleve.nom, "fr") ||
          a.eleve.prenom.localeCompare(b.eleve.prenom, "fr"),
      );

      // On dessine le tableau avec des cellules vides, puis on surimprime les
      // cases à cocher et les lignes de saisie à la bonne position.
      const yDepart = d.y;
      tableau(
        d,
        colonnes,
        membres.map((m) => [`${m.eleve.nom} ${m.eleve.prenom}`, "", "", "", ""]),
      );

      // Repositionnement des cases : même pas vertical que le tableau.
      let y = yDepart - HAUTEUR_LIGNE;
      for (let i = 0; i < membres.length; i++) {
        if (y < MARGE) break;
        for (const x of [MARGE + 230 + 24, MARGE + 292 + 24]) {
          d.page.drawRectangle({
            x,
            y: y - 2,
            width: 10,
            height: 10,
            borderColor: ENCRE_DOUCE,
            borderWidth: 0.8,
          });
        }
        for (const x of [MARGE + 354 + 12, MARGE + 444 + 12]) {
          d.page.drawLine({
            start: { x, y: y - 2 },
            end: { x: x + 66, y: y - 2 },
            thickness: 0.5,
            color: TRAIT,
          });
        }
        y -= HAUTEUR_LIGNE;
      }

      d.reserver(24);
      d.texte(
        "Ratio maximal : 1 educateur pour 20 eleves presents.",
        { taille: 8, couleur: ENCRE_DOUCE },
      );
    }
  }

  return d.sauvegarder();
}
