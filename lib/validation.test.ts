import { describe, expect, it } from "vitest";

import { entierFacultatif } from "./validation";

describe("entierFacultatif", () => {
  const niveau = entierFacultatif(0, 6);

  it("traite un champ vide comme non renseigné", () => {
    // Le piège : z.coerce.number() convertit "" en 0, ce qui enregistrerait
    // « Maternelle » pour un niveau laissé vide.
    expect(niveau.parse("")).toBeNull();
    expect(niveau.parse(undefined)).toBeNull();
    expect(niveau.parse(null)).toBeNull();
  });

  it("distingue le zéro explicite du champ vide", () => {
    expect(niveau.parse("0")).toBe(0);
    expect(niveau.parse(0)).toBe(0);
  });

  it("lit un entier dans les bornes", () => {
    expect(niveau.parse("3")).toBe(3);
    expect(niveau.parse("6")).toBe(6);
  });

  it("refuse hors bornes", () => {
    expect(() => niveau.parse("7")).toThrow();
    expect(() => niveau.parse("-1")).toThrow();
  });

  it("refuse ce qui n'est pas un nombre", () => {
    expect(() => niveau.parse("maternelle")).toThrow();
  });
});
