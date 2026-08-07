import { describe, expect, it } from "vitest";

import { ageALaDate, resoudreDateReference, trancheDeLEleve } from "./age";
import { tranchesParDefaut } from "@/tests/fixtures";
import type { EleveRef } from "./types";

const REF = new Date(Date.UTC(2025, 8, 30)); // 30 septembre 2025

function eleve(dateNaissance: Date, niveauScolaire: number | null = null): EleveRef {
  return { id: "x", nom: "N", prenom: "P", dateNaissance, niveauScolaire };
}

describe("resoudreDateReference — §10, §13 q2", () => {
  const annee = {
    dateDebut: new Date(Date.UTC(2025, 7, 25)), // 25 août 2025
    dateFin: new Date(Date.UTC(2026, 5, 23)), // 23 juin 2026
  };

  it("retient le 30 septembre qui tombe dans l'année scolaire", () => {
    expect(resoudreDateReference(annee, 30, 9).toISOString()).toBe(
      "2025-09-30T00:00:00.000Z",
    );
  });

  it("bascule sur l'année civile suivante si la date précède la rentrée", () => {
    // Un 15 janvier appartient à la seconde moitié de l'année scolaire.
    expect(resoudreDateReference(annee, 15, 1).toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
  });
});

describe("ageALaDate", () => {
  it("compte les années révolues", () => {
    expect(ageALaDate(new Date(Date.UTC(2017, 3, 12)), REF)).toBe(8);
  });

  it("ne compte pas un anniversaire postérieur à la date de référence", () => {
    // Né le 1er décembre 2017 : au 30 septembre 2025, il a encore 7 ans.
    expect(ageALaDate(new Date(Date.UTC(2017, 11, 1)), REF)).toBe(7);
  });

  it("compte un anniversaire tombant pile sur la date de référence", () => {
    expect(ageALaDate(new Date(Date.UTC(2017, 8, 30)), REF)).toBe(8);
  });

  it("ne compte pas un anniversaire au lendemain de la date de référence", () => {
    expect(ageALaDate(new Date(Date.UTC(2017, 9, 1)), REF)).toBe(7);
  });

  it("est stable toute l'année : l'âge ne dépend pas du jour de génération", () => {
    // C'est la raison d'être de la date de référence — sans elle, un élève
    // changerait de groupe au milieu de l'année.
    const naissance = new Date(Date.UTC(2017, 11, 1));
    expect(ageALaDate(naissance, REF)).toBe(ageALaDate(naissance, REF));
  });
});

describe("trancheDeLEleve — §5.1, §13 q1", () => {
  const tranches = tranchesParDefaut();

  it("classe par âge calculé", () => {
    const t = trancheDeLEleve(
      eleve(new Date(Date.UTC(2017, 3, 12))), // 8 ans au 30 sept. 2025
      tranches,
      "AGE_CALCULE",
      REF,
    );
    expect(t?.libelle).toBe("8-9 ans");
  });

  it("classe par niveau scolaire quand le mode le demande", () => {
    // Même élève, même date de naissance, mais c'est le niveau qui tranche.
    const t = trancheDeLEleve(
      eleve(new Date(Date.UTC(2017, 3, 12)), 6),
      tranches,
      "NIVEAU_SCOLAIRE",
      REF,
    );
    expect(t?.libelle).toBe("10-12 ans");
  });

  it("ne classe pas un élève sans niveau en mode NIVEAU_SCOLAIRE", () => {
    expect(
      trancheDeLEleve(
        eleve(new Date(Date.UTC(2017, 3, 12)), null),
        tranches,
        "NIVEAU_SCOLAIRE",
        REF,
      ),
    ).toBeNull();
  });

  it("ne classe pas un âge hors de toute tranche", () => {
    expect(
      trancheDeLEleve(
        eleve(new Date(Date.UTC(2022, 3, 12))), // 3 ans
        tranches,
        "AGE_CALCULE",
        REF,
      ),
    ).toBeNull();
  });

  it("classe correctement les bornes de tranche", () => {
    const borneBasse = trancheDeLEleve(
      eleve(new Date(Date.UTC(2017, 8, 30))), // pile 8 ans
      tranches,
      "AGE_CALCULE",
      REF,
    );
    const borneHaute = trancheDeLEleve(
      eleve(new Date(Date.UTC(2015, 9, 1))), // 9 ans, anniversaire le lendemain
      tranches,
      "AGE_CALCULE",
      REF,
    );

    expect(borneBasse?.libelle).toBe("8-9 ans");
    expect(borneHaute?.libelle).toBe("8-9 ans");
  });
});
