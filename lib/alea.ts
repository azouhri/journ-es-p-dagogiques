/**
 * Générateur pseudo-aléatoire déterministe.
 *
 * §12 — « Le seed doit être déterministe (graine fixe) pour que deux
 * exécutions produisent le même jeu de données et que les tests soient
 * reproductibles. » Math.random() ne convient donc pas.
 *
 * Algorithme mulberry32 : court, rapide, et de qualité largement suffisante
 * pour fabriquer un jeu d'essai.
 */
export class Alea {
  private etat: number;

  constructor(graine: number) {
    this.etat = graine >>> 0;
  }

  /** Flottant dans [0, 1[. */
  suivant(): number {
    this.etat = (this.etat + 0x6d2b79f5) >>> 0;
    let t = this.etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [min, max], bornes incluses. */
  entier(min: number, max: number): number {
    return min + Math.floor(this.suivant() * (max - min + 1));
  }

  /** Vrai avec la probabilité `p`. */
  chance(p: number): boolean {
    return this.suivant() < p;
  }

  /** Un élément au hasard. */
  parmi<T>(liste: readonly T[]): T {
    return liste[Math.floor(this.suivant() * liste.length)];
  }

  /** Copie mélangée (Fisher-Yates). */
  melanger<T>(liste: readonly T[]): T[] {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(this.suivant() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  /** `n` éléments distincts au hasard. */
  echantillon<T>(liste: readonly T[], n: number): T[] {
    return this.melanger(liste).slice(0, Math.min(n, liste.length));
  }
}
