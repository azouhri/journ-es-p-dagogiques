import { describe, expect, it } from "vitest";

import {
  type AffectationRealisee,
  beneficiaireDuCredit,
  calculerCompteurs,
  ecartSurQuart,
} from "./equite";

function affectation(
  surcharge: Partial<AffectationRealisee> = {},
): AffectationRealisee {
  return {
    jourPlanifieId: "j1",
    educateurId: "e1",
    quartCode: "OUVERTURE",
    quartDebutMinutes: 405, // 6 h 45
    quartFinMinutes: 540, // 9 h 00
    presence: { statut: "PRESENT", remplacantId: null },
    ...surcharge,
  };
}

describe("beneficiaireDuCredit — §9.4, §13 q7", () => {
  it("crédite le titulaire quand il est présent", () => {
    expect(beneficiaireDuCredit(affectation())).toBe("e1");
  });

  it("ne crédite personne quand le titulaire est absent", () => {
    expect(
      beneficiaireDuCredit(
        affectation({ presence: { statut: "ABSENT", remplacantId: null } }),
      ),
    ).toBeNull();
  });

  it("crédite le remplaçant, pas le titulaire", () => {
    expect(
      beneficiaireDuCredit(
        affectation({ presence: { statut: "REMPLACE", remplacantId: "e9" } }),
      ),
    ).toBe("e9");
  });

  it("ne crédite personne si aucun remplaçant n'a été désigné", () => {
    expect(
      beneficiaireDuCredit(
        affectation({ presence: { statut: "REMPLACE", remplacantId: null } }),
      ),
    ).toBeNull();
  });

  it("crédite le titulaire quand la présence n'a pas encore été saisie (§9.6)", () => {
    // Les présences sont pré-remplies à « présent » à la validation : une
    // ligne absente veut dire « non vérifié », pas « personne n'était là ».
    expect(beneficiaireDuCredit(affectation({ presence: null }))).toBe("e1");
  });
});

describe("calculerCompteurs — §9.5", () => {
  it("fait figurer à zéro un éducateur sans aucune affectation", () => {
    const compteurs = calculerCompteurs({
      educateurIds: ["e1", "e2"],
      affectations: [],
    });

    expect(compteurs.get("e2")).toEqual({
      educateurId: "e2",
      parQuart: {},
      minutesCumulees: 0,
      nbJourneesTravaillees: 0,
    });
  });

  it("cumule les minutes depuis la copie figée du quart (§4.6)", () => {
    const compteurs = calculerCompteurs({
      educateurIds: ["e1"],
      affectations: [
        affectation({ quartCode: "OUVERTURE", quartDebutMinutes: 405, quartFinMinutes: 540 }),
        affectation({ quartCode: "MATINEE", quartDebutMinutes: 540, quartFinMinutes: 720 }),
      ],
    });

    const c = compteurs.get("e1")!;
    expect(c.parQuart).toEqual({ OUVERTURE: 1, MATINEE: 1 });
    expect(c.minutesCumulees).toBe(135 + 180); // 2 h 15 + 3 h 00
  });

  it("ne compte qu'une journée travaillée même avec deux quarts le même jour", () => {
    const compteurs = calculerCompteurs({
      educateurIds: ["e1"],
      affectations: [
        affectation({ quartCode: "OUVERTURE", jourPlanifieId: "j1" }),
        affectation({ quartCode: "MATINEE", jourPlanifieId: "j1" }),
        affectation({ quartCode: "MATINEE", jourPlanifieId: "j2" }),
      ],
    });

    expect(compteurs.get("e1")!.nbJourneesTravaillees).toBe(2);
  });

  it("transfère intégralement le crédit au remplaçant", () => {
    const compteurs = calculerCompteurs({
      educateurIds: ["e1", "e9"],
      affectations: [
        affectation({
          educateurId: "e1",
          presence: { statut: "REMPLACE", remplacantId: "e9" },
        }),
      ],
    });

    expect(compteurs.get("e1")!.parQuart).toEqual({});
    expect(compteurs.get("e1")!.nbJourneesTravaillees).toBe(0);
    expect(compteurs.get("e9")!.parQuart).toEqual({ OUVERTURE: 1 });
    expect(compteurs.get("e9")!.minutesCumulees).toBe(135);
  });

  it("conserve l'historique d'un remplaçant absent de la liste fournie (§5.2)", () => {
    // Un éducateur désactivé depuis ne doit pas voir son historique disparaître.
    const compteurs = calculerCompteurs({
      educateurIds: ["e1"],
      affectations: [
        affectation({
          educateurId: "e1",
          presence: { statut: "REMPLACE", remplacantId: "e-parti" },
        }),
      ],
    });

    expect(compteurs.get("e-parti")!.parQuart).toEqual({ OUVERTURE: 1 });
  });

  it("conserve les compteurs d'un quart devenu inactif (§4.6)", () => {
    // Désactiver la soirée n'efface pas les soirées déjà travaillées.
    const compteurs = calculerCompteurs({
      educateurIds: ["e1"],
      affectations: [affectation({ quartCode: "SOIREE" })],
    });

    expect(compteurs.get("e1")!.parQuart.SOIREE).toBe(1);
  });

  it("reflète immédiatement la correction d'une présence (§9.5)", () => {
    const base = affectation({ quartCode: "MATINEE" });

    const avant = calculerCompteurs({
      educateurIds: ["e1"],
      affectations: [base],
    });
    const apres = calculerCompteurs({
      educateurIds: ["e1"],
      affectations: [
        { ...base, presence: { statut: "ABSENT", remplacantId: null } },
      ],
    });

    expect(avant.get("e1")!.parQuart.MATINEE).toBe(1);
    expect(apres.get("e1")!.parQuart.MATINEE).toBeUndefined();
  });
});

describe("ecartSurQuart", () => {
  it("mesure l'écart max-min sur un code de quart", () => {
    const compteurs = calculerCompteurs({
      educateurIds: ["e1", "e2", "e3"],
      affectations: [
        affectation({ educateurId: "e1", jourPlanifieId: "j1" }),
        affectation({ educateurId: "e1", jourPlanifieId: "j2" }),
        affectation({ educateurId: "e2", jourPlanifieId: "j1" }),
      ],
    });

    expect(ecartSurQuart(compteurs.values(), "OUVERTURE")).toBe(2); // e1=2, e3=0
  });
});
