import { describe, expect, it } from "vitest";

import { analyserImportEducateurs, analyserImportEleves } from "./import-eleves";
import { ecrireClasseur, lireClasseur } from "./xlsx";

const COLONNES_ELEVES = [
  { entete: "Nom" },
  { entete: "Prénom" },
  { entete: "Date de naissance" },
  { entete: "Niveau scolaire" },
  { entete: "Notes" },
];

describe("lireClasseur", () => {
  it("lit les en-têtes et les lignes d'un classeur simple", async () => {
    const tampon = await ecrireClasseur({
      nomFeuille: "Test",
      colonnes: COLONNES_ELEVES,
      lignes: [["Côté", "Alice", "2017-04-12", "3e année", ""]],
    });

    const { entetes, lignes } = await lireClasseur(tampon as ArrayBuffer);

    expect(entetes).toEqual([
      "Nom",
      "Prénom",
      "Date de naissance",
      "Niveau scolaire",
      "Notes",
    ]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0][0]).toBe("Côté");
  });

  it("ne confond pas un bandeau de titre avec la ligne d'en-têtes", async () => {
    // Le titre est fusionné sur toute la largeur : le prendre pour les
    // en-têtes ferait refuser TOUT fichier exporté par l'application.
    const tampon = await ecrireClasseur({
      nomFeuille: "Test",
      titre: "Modèle — Élèves",
      sousTitre: "Remplacer la ligne d'exemple par vos données.",
      colonnes: COLONNES_ELEVES,
      lignes: [["Côté", "Alice", "2017-04-12", "3e année", ""]],
    });

    const { entetes, lignes } = await lireClasseur(tampon as ArrayBuffer);

    expect(entetes[0]).toBe("Nom");
    expect(lignes).toHaveLength(1);
  });
});

describe("aller-retour export puis import", () => {
  it("réimporte sans erreur un classeur d'élèves produit par l'application", async () => {
    // Exporter puis réimporter est le geste le plus naturel qui soit : c'est
    // ainsi qu'on corrige une liste en masse. Il ne doit rien casser.
    const tampon = await ecrireClasseur({
      nomFeuille: "Élèves",
      titre: "Élèves",
      sousTitre: "Exporté le 7 août 2026",
      colonnes: COLONNES_ELEVES,
      lignes: [
        ["Côté", "Alice", "2017-04-12", "3e année", ""],
        ["Tremblay", "Hugo", "2016-09-12", "Maternelle", "allergie"],
        ["Roy", "Léa", "2015-01-30", "", ""],
      ],
    });

    const rapport = analyserImportEleves(
      await lireClasseur(tampon as ArrayBuffer),
    );

    expect(rapport.entetesManquantes).toEqual([]);
    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.nbNouveaux).toBe(3);

    // Le libellé exporté est bien relu comme l'ordinal stocké.
    expect(rapport.lignes[0].donnees?.niveauScolaire).toBe(3);
    expect(rapport.lignes[1].donnees?.niveauScolaire).toBe(0);
    expect(rapport.lignes[2].donnees?.niveauScolaire).toBeNull();
  });

  it("réimporte sans erreur un classeur d'éducateurs produit par l'application", async () => {
    const tampon = await ecrireClasseur({
      nomFeuille: "Éducateurs",
      titre: "Éducateurs",
      colonnes: [
        { entete: "Nom" },
        { entete: "Prénom" },
        { entete: "Courriel" },
        { entete: "Statut" },
        { entete: "Date d'embauche" },
      ],
      lignes: [
        ["Tremblay", "Marie", "marie@ecole.qc.ca", "Temps plein", "2021-08-15"],
        ["Roy", "Luc", "", "Temps partiel", ""],
      ],
    });

    const rapport = analyserImportEducateurs(
      await lireClasseur(tampon as ArrayBuffer),
    );

    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.nbNouveaux).toBe(2);
    expect(rapport.lignes[0].donnees?.statutEmploi).toBe("TEMPS_PLEIN");
    expect(rapport.lignes[1].donnees?.statutEmploi).toBe("TEMPS_PARTIEL");
  });

  it("relit une cellule de type date comme une date", async () => {
    // Une date saisie dans Excel n'arrive pas en texte mais en objet Date.
    const tampon = await ecrireClasseur({
      nomFeuille: "Élèves",
      colonnes: COLONNES_ELEVES,
      lignes: [["Côté", "Alice", new Date(Date.UTC(2017, 3, 12)), "3", ""]],
    });

    const rapport = analyserImportEleves(
      await lireClasseur(tampon as ArrayBuffer),
    );

    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.lignes[0].donnees?.dateNaissance.toISOString()).toBe(
      "2017-04-12T00:00:00.000Z",
    );
  });
});
