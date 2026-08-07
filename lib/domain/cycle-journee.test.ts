import { describe, expect, it } from "vitest";

import {
  droitsJournee,
  estVecue,
  resumerSuppression,
  type EtatJournee,
} from "./cycle-journee";

function etat(surcharge: Partial<EtatJournee> = {}): EtatJournee {
  return {
    statut: "BROUILLON",
    commencee: false,
    confirmee: false,
    exceptionsSaisies: 0,
    ...surcharge,
  };
}

describe("estVecue", () => {
  it("reconnaît une journée dont les présences sont confirmées", () => {
    expect(estVecue(etat({ statut: "VALIDE", confirmee: true }))).toBe(true);
  });

  it("reconnaît une journée où des absences ont été saisies", () => {
    // Saisir une absence prouve que quelqu'un a constaté le déroulement réel.
    expect(estVecue(etat({ statut: "VALIDE", exceptionsSaisies: 2 }))).toBe(true);
  });

  it("ne se fie pas à la seule date passée", () => {
    // Une journée passée dont personne n'a rien relevé n'est pas « vécue » au
    // sens du relevé : rien n'atteste de son déroulement.
    expect(estVecue(etat({ statut: "VALIDE", commencee: true }))).toBe(false);
  });
});

describe("droitsJournee — modification du planning", () => {
  it("laisse tout modifier tant que la journée n'est pas validée", () => {
    for (const statut of ["BROUILLON", "GENERE"] as const) {
      const d = droitsJournee(etat({ statut }));
      expect(d.modifierPlanning).toBe(true);
      expect(d.raisonPlanningFige).toBeNull();
    }
  });

  it("fige le planning dès la validation", () => {
    const d = droitsJournee(etat({ statut: "VALIDE" }));
    expect(d.modifierPlanning).toBe(false);
    expect(d.raisonPlanningFige).toMatch(/rouvrir/i);
  });
});

describe("droitsJournee — réouverture", () => {
  it("permet de rouvrir une journée validée que personne n'a encore vécue", () => {
    const d = droitsJournee(etat({ statut: "VALIDE" }));
    expect(d.devalider).toBe(true);
    expect(d.raisonDevalidationRefusee).toBeNull();
  });

  it("permet encore de rouvrir une journée passée mais jamais pointée", () => {
    const d = droitsJournee(etat({ statut: "VALIDE", commencee: true }));
    expect(d.devalider).toBe(true);
  });

  it("refuse de rouvrir une journée confirmée", () => {
    const d = droitsJournee(etat({ statut: "VALIDE", confirmee: true }));
    expect(d.devalider).toBe(false);
    expect(d.raisonDevalidationRefusee).toMatch(/confirmées/);
  });

  it("refuse de rouvrir dès qu'une absence a été saisie", () => {
    // Sinon une permutation réattribuerait cette absence à quelqu'un d'autre.
    const d = droitsJournee(etat({ statut: "VALIDE", exceptionsSaisies: 1 }));
    expect(d.devalider).toBe(false);
    expect(d.raisonDevalidationRefusee).toMatch(/absence/);
  });

  it("ne propose pas de rouvrir ce qui n'est pas validé", () => {
    expect(droitsJournee(etat({ statut: "GENERE" })).devalider).toBe(false);
  });
});

describe("droitsJournee — présences", () => {
  it("n'ouvre la saisie qu'une fois la journée validée", () => {
    expect(droitsJournee(etat({ statut: "GENERE" })).saisirPresences).toBe(false);
    expect(droitsJournee(etat({ statut: "VALIDE" })).saisirPresences).toBe(true);
  });

  it("laisse corriger les présences d'une journée déjà confirmée (§9.5)", () => {
    // « Corriger une présence deux semaines après coup se répercute
    // instantanément sur le tableau d'équité. »
    const d = droitsJournee(
      etat({ statut: "VALIDE", commencee: true, confirmee: true }),
    );
    expect(d.saisirPresences).toBe(true);
  });
});

describe("droitsJournee — suppression", () => {
  it("reste toujours possible : une journée annulée doit pouvoir disparaître", () => {
    expect(droitsJournee(etat({ statut: "VALIDE", confirmee: true })).supprimer).toBe(
      true,
    );
  });

  it("demande une simple confirmation pour un brouillon", () => {
    expect(droitsJournee(etat()).confirmationSuppression).toBe("simple");
  });

  it("annonce les conséquences pour une journée générée", () => {
    expect(droitsJournee(etat({ statut: "GENERE" })).confirmationSuppression).toBe(
      "consequences",
    );
  });

  it("exige de saisir le nom pour une journée vécue", () => {
    expect(
      droitsJournee(etat({ statut: "VALIDE", commencee: true, confirmee: true }))
        .confirmationSuppression,
    ).toBe("saisie_du_nom");
  });

  it("exige aussi de saisir le nom pour une journée validée déjà passée", () => {
    // Ses heures comptent déjà dans l'équité, même sans confirmation.
    expect(
      droitsJournee(etat({ statut: "VALIDE", commencee: true }))
        .confirmationSuppression,
    ).toBe("saisie_du_nom");
  });

  it("se contente des conséquences pour une journée validée à venir", () => {
    expect(
      droitsJournee(etat({ statut: "VALIDE" })).confirmationSuppression,
    ).toBe("consequences");
  });
});

describe("resumerSuppression", () => {
  const affectations = [
    { educateurId: "e1", quartDebutMinutes: 405, quartFinMinutes: 540 },
    { educateurId: "e1", quartDebutMinutes: 540, quartFinMinutes: 720 },
    { educateurId: "e2", quartDebutMinutes: 720, quartFinMinutes: 1050 },
  ];

  it("chiffre ce que la suppression retire aux compteurs", () => {
    const r = resumerSuppression(
      etat({ statut: "VALIDE", confirmee: true }),
      affectations,
      1,
      4,
    );

    expect(r.affectations).toBe(3);
    // e1 compte une fois, pas deux.
    expect(r.educateursImpactes).toBe(2);
    expect(r.minutesRetirees).toBe(135 + 180 + 330);
    expect(r.vecue).toBe(true);
  });

  it("ne retire rien quand aucune affectation n'existe", () => {
    const r = resumerSuppression(etat(), [], 1, 0);
    expect(r.educateursImpactes).toBe(0);
    expect(r.minutesRetirees).toBe(0);
    expect(r.vecue).toBe(false);
  });
});
