import { describe, expect, it } from "vitest";

import {
  analyserNiveauScolaire,
  analyserDate,
  estAffirmatif,
  normaliserEntete,
  trouverColonne,
} from "./tableur";

describe("normaliserEntete", () => {
  it("ignore casse, accents et ponctuation", () => {
    expect(normaliserEntete("Date de naissance")).toBe("datedenaissance");
    expect(normaliserEntete("DATE_DE_NAISSANCE")).toBe("datedenaissance");
    expect(normaliserEntete("Prénom")).toBe("prenom");
    expect(normaliserEntete("  Nom  ")).toBe("nom");
  });
});

describe("trouverColonne", () => {
  const entetes = ["Nom", "Prénom", "Date de naissance"];

  it("retrouve une colonne quel que soit son libellé exact", () => {
    expect(trouverColonne(entetes, ["prenom"])).toBe(1);
    expect(trouverColonne(entetes, ["date de naissance", "ddn"])).toBe(2);
  });

  it("essaie les alias dans l'ordre", () => {
    expect(trouverColonne(entetes, ["ddn", "date de naissance"])).toBe(2);
  });

  it("retourne -1 pour une colonne absente", () => {
    expect(trouverColonne(entetes, ["courriel"])).toBe(-1);
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

  it("accepte un horodatage ISO complet", () => {
    // Excel restitue ses cellules de type date sous cette forme.
    expect(analyserDate("2017-04-12T00:00:00.000Z")?.toISOString()).toBe(
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

describe("analyserNiveauScolaire", () => {
  it("lit un chiffre", () => {
    expect(analyserNiveauScolaire("0")).toBe(0);
    expect(analyserNiveauScolaire("6")).toBe(6);
  });

  it("lit le libellé qu'écrit l'export", () => {
    // Sans cela, exporter puis réimporter échouerait sur chaque ligne.
    expect(analyserNiveauScolaire("Maternelle")).toBe(0);
    expect(analyserNiveauScolaire("3e année")).toBe(3);
    expect(analyserNiveauScolaire("1re année")).toBe(1);
  });

  it("tolère les écritures abrégées", () => {
    expect(analyserNiveauScolaire("3e")).toBe(3);
    expect(analyserNiveauScolaire("4eme")).toBe(4);
  });

  it("traite une valeur vide comme non renseignée", () => {
    expect(analyserNiveauScolaire("")).toBeNull();
    expect(analyserNiveauScolaire("   ")).toBeNull();
  });

  it("signale une valeur inexploitable", () => {
    expect(analyserNiveauScolaire("12")).toBeUndefined();
    expect(analyserNiveauScolaire("-1")).toBeUndefined();
    expect(analyserNiveauScolaire("secondaire")).toBeUndefined();
  });
});

describe("estAffirmatif", () => {
  it("reconnaît les façons usuelles de dire oui", () => {
    for (const v of ["oui", "OUI", "o", "x", "1", "vrai", "true", "Yes"]) {
      expect(estAffirmatif(v)).toBe(true);
    }
  });

  it("traite tout le reste comme un non", () => {
    for (const v of ["", "non", "n", "0", "faux", "peut-être"]) {
      expect(estAffirmatif(v)).toBe(false);
    }
  });
});
