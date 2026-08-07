import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { estBoutonNatif } from "./rendu";

describe("estBoutonNatif", () => {
  it("considère un bouton sans `render` comme natif", () => {
    expect(estBoutonNatif(undefined)).toBe(true);
    expect(estBoutonNatif(null)).toBe(true);
  });

  it("reconnaît un <button> passé à `render`", () => {
    expect(estBoutonNatif(createElement("button", { type: "submit" }))).toBe(
      true,
    );
  });

  it("détecte un <a> : c'est le cas qui déclenchait l'avertissement", () => {
    expect(estBoutonNatif(createElement("a", { href: "/x" }))).toBe(false);
  });

  it("détecte un composant, comme le <Link> de Next", () => {
    const Lien = () => null;
    expect(estBoutonNatif(createElement(Lien))).toBe(false);
  });

  it("traite une fonction de rendu comme native, faute de pouvoir l'inspecter", () => {
    expect(estBoutonNatif(() => createElement("a"))).toBe(true);
  });
});
