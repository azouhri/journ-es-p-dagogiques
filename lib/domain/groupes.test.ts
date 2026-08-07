import { describe, expect, it } from "vitest";

import { constituerGroupes, taillesEquilibrees } from "./groupes";
import {
  DATE_REFERENCE_2025,
  eleveDAge,
  tranchesParDefaut,
} from "@/tests/fixtures";

describe("taillesEquilibrees — §7.3", () => {
  it("répartit 27 élèves en 14 et 13, pas 20 et 7", () => {
    expect(taillesEquilibrees(27, 2)).toEqual([14, 13]);
  });

  it("répartit sans reste quand c'est possible", () => {
    expect(taillesEquilibrees(40, 2)).toEqual([20, 20]);
  });

  it("étale le reste sur les premiers groupes", () => {
    expect(taillesEquilibrees(50, 3)).toEqual([17, 17, 16]);
  });
});

describe("constituerGroupes — §7", () => {
  const tranches = tranchesParDefaut();
  const base = {
    tranches,
    mode: "AGE_CALCULE" as const,
    dateReference: DATE_REFERENCE_2025,
    capaciteMaxGroupe: 20,
  };

  it("ne produit aucun groupe pour une tranche sans élève (§7.2)", () => {
    const participants = Array.from({ length: 5 }, (_, i) =>
      eleveDAge(`a${i}`, 8, DATE_REFERENCE_2025),
    );
    const { groupes } = constituerGroupes({ ...base, participants });

    expect(groupes).toHaveLength(1);
    expect(groupes[0].trancheAgeId).toBe("t-8-9");
  });

  it("scinde une tranche qui dépasse la capacité, en parts équilibrées (§7.3)", () => {
    const participants = Array.from({ length: 27 }, (_, i) =>
      eleveDAge(`a${String(i).padStart(2, "0")}`, 8, DATE_REFERENCE_2025),
    );
    const { groupes } = constituerGroupes({ ...base, participants });

    expect(groupes).toHaveLength(2);
    expect(groupes.map((g) => g.eleves.length)).toEqual([14, 13]);
    expect(groupes.map((g) => g.libelle)).toEqual([
      "8-9 ans — A",
      "8-9 ans — B",
    ]);
  });

  it("n'ajoute pas de suffixe quand la tranche n'est pas scindée", () => {
    const participants = Array.from({ length: 12 }, (_, i) =>
      eleveDAge(`a${i}`, 8, DATE_REFERENCE_2025),
    );
    const { groupes } = constituerGroupes({ ...base, participants });

    expect(groupes[0].libelle).toBe("8-9 ans");
  });

  it("place chaque élève dans une seule et unique place", () => {
    const participants = [
      ...Array.from({ length: 27 }, (_, i) =>
        eleveDAge(`h${i}`, 8, DATE_REFERENCE_2025),
      ),
      ...Array.from({ length: 9 }, (_, i) =>
        eleveDAge(`s${i}`, 6, DATE_REFERENCE_2025),
      ),
    ];
    const { groupes, nonClasses } = constituerGroupes({ ...base, participants });

    const places = groupes.flatMap((g) => g.eleves.map((e) => e.id));
    expect(places).toHaveLength(36);
    expect(new Set(places).size).toBe(36);
    expect(nonClasses).toHaveLength(0);
  });

  it("signale les élèves hors de toute tranche plutôt que de les ranger d'office", () => {
    const participants = [
      eleveDAge("trop-jeune", 2, DATE_REFERENCE_2025),
      eleveDAge("trop-age", 15, DATE_REFERENCE_2025),
      eleveDAge("ok", 8, DATE_REFERENCE_2025),
    ];
    const { groupes, nonClasses, avertissements } = constituerGroupes({
      ...base,
      participants,
    });

    expect(nonClasses.map((e) => e.id).sort()).toEqual(["trop-age", "trop-jeune"]);
    expect(groupes.flatMap((g) => g.eleves)).toHaveLength(1);
    expect(avertissements.some((a) => a.code === "ELEVES_NON_CLASSES")).toBe(true);
  });

  it("est déterministe : deux exécutions donnent le même découpage", () => {
    const participants = Array.from({ length: 45 }, (_, i) =>
      eleveDAge(`a${String(i).padStart(2, "0")}`, 9, DATE_REFERENCE_2025),
    );
    const a = constituerGroupes({ ...base, participants });
    const b = constituerGroupes({
      ...base,
      participants: [...participants].reverse(),
    });

    expect(a.groupes.map((g) => g.eleves.map((e) => e.id))).toEqual(
      b.groupes.map((g) => g.eleves.map((e) => e.id)),
    );
  });

  it("respecte le plafond réglementaire de 20 par groupe (§3)", () => {
    const participants = Array.from({ length: 61 }, (_, i) =>
      eleveDAge(`a${String(i).padStart(2, "0")}`, 10, DATE_REFERENCE_2025),
    );
    const { groupes } = constituerGroupes({ ...base, participants });

    expect(groupes).toHaveLength(4);
    for (const g of groupes) expect(g.eleves.length).toBeLessThanOrEqual(20);
  });
});
