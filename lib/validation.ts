import { z } from "zod";

/**
 * Champ numérique facultatif d'un formulaire.
 *
 * Un champ vide d'un formulaire HTML arrive en chaîne vide, jamais en
 * `undefined`. Or `z.coerce.number()` convertit `""` en **0** : écrit
 * naïvement, un « niveau scolaire » laissé vide serait enregistré comme
 * « Maternelle » au lieu de rester non renseigné.
 *
 * L'ordre des branches est donc significatif — `z.union` retient la première
 * qui accepte la valeur, et la chaîne vide doit être reconnue AVANT toute
 * tentative de conversion. C'est pour ne pas avoir à s'en souvenir à chaque
 * fois que ce petit assistant existe.
 */
export function entierFacultatif(min: number, max: number) {
  return z
    .union([
      z.literal(""),
      z.undefined(),
      z.null(),
      z.coerce.number().int().min(min).max(max),
    ])
    .transform((v) =>
      v === "" || v === undefined || v === null ? null : Number(v),
    );
}
