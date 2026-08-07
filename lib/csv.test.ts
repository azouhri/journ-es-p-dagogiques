import { describe, expect, it } from "vitest";

import {
  analyserCsv,
  analyserDate,
  devinerSeparateur,
  genererCsv,
  normaliserEntete,
  trouverColonne,
} from "./csv";

describe("devinerSeparateur", () => {
  it("reconnaît le point-virgule des exports Excel francophones", () => {
    expect(devinerSeparateur("nom;prenom;date\nRoy;Alice;2017-01-01")).toBe(";");
  });

  it("reconnaît la virgule", () => {
    expect(devinerSeparateur("nom,prenom,date\nRoy,Alice,2017-01-01")).toBe(",");
  });

  it("reconnaît la tabulation", () => {
    expect(devinerSeparateur("nom\tprenom\tdate")).toBe("\t");
  });

  it("ne se laisse pas piéger par une virgule à l'intérieur d'un champ", () => {
    expect(devinerSeparateur('nom;notes\nRoy;"allergies, arachides"')).toBe(";");
  });
});

describe("analyserCsv", () => {
  it("sépare l'en-tête du corps", () => {
    const r = analyserCsv("nom;prenom\nRoy;Alice\nCôté;Hugo");
    expect(r.entetes).toEqual(["nom", "prenom"]);
    expect(r.lignes).toEqual([
      ["Roy", "Alice"],
      ["Côté", "Hugo"],
    ]);
  });

  it("retire le BOM qu'Excel ajoute en tête de fichier", () => {
    // Sans ce retrait, le premier en-tête ne serait jamais reconnu.
    const r = analyserCsv("﻿nom;prenom\nRoy;Alice");
    expect(r.entetes[0]).toBe("nom");
  });

  it("respecte un séparateur à l'intérieur de guillemets", () => {
    const r = analyserCsv('nom;notes\nRoy;"allergies : arachides; noix"');
    expect(r.lignes[0]).toEqual(["Roy", "allergies : arachides; noix"]);
  });

  it("respecte un saut de ligne à l'intérieur de guillemets", () => {
    const r = analyserCsv('nom;notes\nRoy;"ligne 1\nligne 2"\nCôté;rien');
    expect(r.lignes).toHaveLength(2);
    expect(r.lignes[0][1]).toBe("ligne 1\nligne 2");
    expect(r.lignes[1]).toEqual(["Côté", "rien"]);
  });

  it("interprète un guillemet doublé comme un guillemet", () => {
    const r = analyserCsv('nom;notes\nRoy;"dit ""présent"""');
    expect(r.lignes[0][1]).toBe('dit "présent"');
  });

  it("gère les fins de ligne Windows", () => {
    const r = analyserCsv("nom;prenom\r\nRoy;Alice\r\n");
    expect(r.lignes).toEqual([["Roy", "Alice"]]);
  });

  it("ignore les lignes vides de fin de fichier", () => {
    const r = analyserCsv("nom;prenom\nRoy;Alice\n\n\n");
    expect(r.lignes).toHaveLength(1);
  });

  it("survit à un fichier sans corps", () => {
    const r = analyserCsv("nom;prenom\n");
    expect(r.entetes).toEqual(["nom", "prenom"]);
    expect(r.lignes).toEqual([]);
  });
});

describe("genererCsv", () => {
  it("échappe les champs contenant le séparateur ou un guillemet", () => {
    const csv = genererCsv(["nom", "notes"], [["Roy", 'a; b et "c"']]);
    expect(csv).toContain('"a; b et ""c"""');
  });

  it("écrit un BOM pour qu'Excel lise correctement les accents", () => {
    expect(genererCsv(["nom"], [["Côté"]]).startsWith("﻿")).toBe(true);
  });

  it("fait l'aller-retour sans perte", () => {
    const lignes = [
      ["Côté", "allergies : arachides; noix"],
      ["Roy", 'dit "présent"'],
      ["Tremblay", "ligne 1\nligne 2"],
    ];
    const relu = analyserCsv(genererCsv(["nom", "notes"], lignes));
    expect(relu.lignes).toEqual(lignes);
  });

  it("écrit une cellule vide pour null et undefined", () => {
    const csv = genererCsv(["a", "b", "c"], [[null, undefined, 0]]);
    expect(csv.split("\r\n")[1]).toBe(";;0");
  });
});

describe("normaliserEntete / trouverColonne", () => {
  it("ignore casse, accents et espaces", () => {
    expect(normaliserEntete("Date de naissance")).toBe("datedenaissance");
    expect(normaliserEntete("DATE_DE_NAISSANCE")).toBe("datedenaissance");
    expect(normaliserEntete("Prénom")).toBe("prenom");
  });

  it("retrouve une colonne quel que soit son libellé exact", () => {
    const entetes = ["Nom", "Prénom", "Date de naissance"];
    expect(trouverColonne(entetes, ["prenom"])).toBe(1);
    expect(trouverColonne(entetes, ["date de naissance", "ddn"])).toBe(2);
  });

  it("retourne -1 pour une colonne absente", () => {
    expect(trouverColonne(["nom"], ["courriel"])).toBe(-1);
  });
});

describe("analyserDate", () => {
  it("lit le format ISO", () => {
    expect(analyserDate("2017-04-12")?.toISOString()).toBe(
      "2017-04-12T00:00:00.000Z",
    );
  });

  it("lit le format québécois jour/mois/année", () => {
    expect(analyserDate("12/04/2017")?.toISOString()).toBe(
      "2017-04-12T00:00:00.000Z",
    );
  });

  it("refuse une date inexistante plutôt que de la corriger en silence", () => {
    // new Date(2017, 1, 31) donnerait le 3 mars sans broncher.
    expect(analyserDate("2017-02-31")).toBeNull();
  });

  it("refuse ce qui n'est pas une date", () => {
    expect(analyserDate("hier")).toBeNull();
    expect(analyserDate("")).toBeNull();
    expect(analyserDate("12-2017")).toBeNull();
  });
});
