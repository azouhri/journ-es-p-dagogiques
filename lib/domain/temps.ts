/**
 * Manipulation des horaires — spec §4.1.
 *
 * Tout est en minutes depuis minuit. Aucun objet Date n'intervient dans le
 * calcul des quarts : un quart est un intervalle d'entiers.
 */

/** « 06:45 » -> 405. Accepte aussi « 6:45 » et « 6 h 45 ». */
export function versMinutes(heure: string): number {
  const m = heure.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})$/);
  if (!m) {
    throw new Error(`Heure invalide : « ${heure} ». Format attendu : HH:MM.`);
  }
  const heures = Number(m[1]);
  const minutes = Number(m[2]);
  if (heures > 23 || minutes > 59) {
    throw new Error(`Heure hors bornes : « ${heure} ».`);
  }
  return heures * 60 + minutes;
}

/** 405 -> « 06:45 ». */
export function versTexte(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 405 -> « 6 h 45 » (convention typographique québécoise). */
export function versTexteFr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Deux quarts se chevauchent-ils ?
 *
 * Les intervalles sont semi-ouverts [début, fin[ : un quart qui finit à 9 h 00 et
 * un quart qui commence à 9 h 00 ne se chevauchent PAS. C'est précisément ce
 * qui rend l'enchaînement ouverture -> matinée possible (§4.3).
 */
export function seChevauchent(
  a: { debutMinutes: number; finMinutes: number },
  b: { debutMinutes: number; finMinutes: number },
): boolean {
  return a.debutMinutes < b.finMinutes && b.debutMinutes < a.finMinutes;
}

/** Durée d'un quart, en minutes. */
export function duree(quart: {
  debutMinutes: number;
  finMinutes: number;
}): number {
  return quart.finMinutes - quart.debutMinutes;
}

/** 135 -> « 2 h 15 ». Pour l'affichage des heures cumulées. */
export function dureeEnTexte(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
