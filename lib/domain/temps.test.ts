import { describe, expect, it } from "vitest";

import {
  duree,
  dureeEnTexte,
  seChevauchent,
  versMinutes,
  versTexte,
  versTexteFr,
} from "./temps";

describe("versMinutes", () => {
  it("convertit les horaires du §4.2", () => {
    expect(versMinutes("06:45")).toBe(405);
    expect(versMinutes("09:00")).toBe(540);
    expect(versMinutes("17:30")).toBe(1050);
    expect(versMinutes("19:00")).toBe(1140);
  });

  it("tolère les écritures usuelles", () => {
    expect(versMinutes("6:45")).toBe(405);
    expect(versMinutes("6h45")).toBe(405);
    expect(versMinutes(" 6 h 45 ")).toBe(405);
  });

  it("refuse une heure invalide plutôt que de deviner", () => {
    expect(() => versMinutes("25:00")).toThrow();
    expect(() => versMinutes("09:75")).toThrow();
    expect(() => versMinutes("midi")).toThrow();
  });
});

describe("versTexte / versTexteFr", () => {
  it("fait l'aller-retour", () => {
    expect(versTexte(405)).toBe("06:45");
    expect(versMinutes(versTexte(1050))).toBe(1050);
  });

  it("utilise la convention québécoise pour l'affichage", () => {
    expect(versTexteFr(405)).toBe("6 h 45");
    expect(versTexteFr(540)).toBe("9 h");
  });
});

describe("seChevauchent — §4.3", () => {
  const ouverture = { debutMinutes: 405, finMinutes: 540 };
  const matinee = { debutMinutes: 540, finMinutes: 720 };
  const apresMidi = { debutMinutes: 720, finMinutes: 1050 };

  it("ne considère pas comme chevauchants deux quarts qui se touchent", () => {
    // C'est précisément ce qui rend l'enchaînement possible.
    expect(seChevauchent(ouverture, matinee)).toBe(false);
    expect(seChevauchent(matinee, apresMidi)).toBe(false);
  });

  it("détecte un vrai chevauchement", () => {
    expect(seChevauchent(matinee, { debutMinutes: 600, finMinutes: 800 })).toBe(
      true,
    );
  });

  it("est symétrique", () => {
    const a = { debutMinutes: 400, finMinutes: 600 };
    const b = { debutMinutes: 500, finMinutes: 700 };
    expect(seChevauchent(a, b)).toBe(seChevauchent(b, a));
  });
});

describe("duree", () => {
  it("mesure la durée d'un quart", () => {
    expect(duree({ debutMinutes: 405, finMinutes: 540 })).toBe(135);
  });

  it("s'affiche lisiblement", () => {
    expect(dureeEnTexte(135)).toBe("2 h 15");
    expect(dureeEnTexte(180)).toBe("3 h");
    expect(dureeEnTexte(45)).toBe("45 min");
  });
});
