"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { creerVersionConfiguration } from "@/lib/data/configuration";
import { versMinutes } from "@/lib/domain/temps";
import { prisma } from "@/lib/prisma";
import type { ResultatAction } from "./journees";

const SchemaQuart = z.object({
  id: z.string().min(1),
  libelle: z.string().trim().min(1, "Le libellé est obligatoire."),
  debut: z.string().min(1),
  fin: z.string().min(1),
  effectifRequis: z.coerce.number().int().min(1).max(20),
  actif: z.boolean(),
});

/** §5.3 — modification d'un type de quart. Crée une version (§4.6). */
export async function enregistrerTypeQuart(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const analyse = SchemaQuart.safeParse({
    id: donnees.get("id"),
    libelle: donnees.get("libelle"),
    debut: donnees.get("debut"),
    fin: donnees.get("fin"),
    effectifRequis: donnees.get("effectifRequis"),
    actif: donnees.get("actif") === "on",
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { id, libelle, debut, fin, effectifRequis, actif } = analyse.data;

  let debutMinutes: number;
  let finMinutes: number;
  try {
    debutMinutes = versMinutes(debut);
    finMinutes = versMinutes(fin);
  } catch (erreur) {
    return {
      ok: false,
      message: erreur instanceof Error ? erreur.message : "Horaire invalide.",
    };
  }

  if (finMinutes <= debutMinutes) {
    return { ok: false, message: "L'heure de fin doit suivre l'heure de début." };
  }

  const quart = await prisma.typeQuart.findUnique({ where: { id } });
  if (!quart) return { ok: false, message: "Type de quart introuvable." };

  await prisma.typeQuart.update({
    where: { id },
    data: { libelle, debutMinutes, finMinutes, effectifRequis, actif },
  });

  // §4.6 — la modification ne touche PAS aux journées déjà générées : leurs
  // affectations portent une copie figée du quart. Elle crée simplement une
  // nouvelle version, à laquelle les prochaines générations se rattacheront.
  await creerVersionConfiguration(
    quart.anneeScolaireId,
    `Quart « ${libelle} » modifié.`,
  );

  revalidatePath("/parametres");
  return {
    ok: true,
    message: `Quart modifié. Les journées déjà générées gardent leurs horaires.`,
  };
}

const SchemaReglages = z.object({
  anneeScolaireId: z.string().min(1),
  capaciteMaxGroupe: z.coerce.number().int().min(1).max(20),
  modeGroupement: z.enum(["AGE_CALCULE", "NIVEAU_SCOLAIRE"]),
  dateReferenceAgeJour: z.coerce.number().int().min(1).max(31),
  dateReferenceAgeMois: z.coerce.number().int().min(1).max(12),
  eviterMemeQuartConsecutif: z.boolean(),
  continuiteTrancheAge: z.boolean(),
  politiqueTrancheEducateur: z.enum(["LIBRE", "PREFERER", "IMPOSER"]),
  doublePoste: z.enum(["JAMAIS", "SI_EFFECTIF_INSUFFISANT", "TOUJOURS"]),
  politiqueBloc: z.enum(["CHAQUE_JOUR_SEPAREMENT", "MEME_EQUIPE_SUR_LE_BLOC"]),
  surEffectifOuverture: z.enum([
    "REDUIRE_AU_NOMBRE_DE_GROUPES",
    "RENFORT_SUR_UN_GROUPE",
    "AVANCE_PUIS_RETOUR",
  ]),
  critereDepartage: z.enum(["HEURES_CUMULEES", "NB_JOURNEES"]),
});

/** §10 — réglages de l'algorithme. Aucun n'est codé en dur. */
export async function enregistrerReglages(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const analyse = SchemaReglages.safeParse({
    anneeScolaireId: donnees.get("anneeScolaireId"),
    capaciteMaxGroupe: donnees.get("capaciteMaxGroupe"),
    modeGroupement: donnees.get("modeGroupement"),
    dateReferenceAgeJour: donnees.get("dateReferenceAgeJour"),
    dateReferenceAgeMois: donnees.get("dateReferenceAgeMois"),
    eviterMemeQuartConsecutif: donnees.get("eviterMemeQuartConsecutif") === "on",
    continuiteTrancheAge: donnees.get("continuiteTrancheAge") === "on",
    politiqueTrancheEducateur: donnees.get("politiqueTrancheEducateur"),
    doublePoste: donnees.get("doublePoste"),
    politiqueBloc: donnees.get("politiqueBloc"),
    surEffectifOuverture: donnees.get("surEffectifOuverture"),
    critereDepartage: donnees.get("critereDepartage"),
  });

  if (!analyse.success) {
    return {
      ok: false,
      message: `${analyse.error.issues[0].path.join(".")} : ${analyse.error.issues[0].message}`,
    };
  }

  const { anneeScolaireId, capaciteMaxGroupe, ...reste } = analyse.data;

  await prisma.reglages.update({
    where: { anneeScolaireId },
    data: {
      capaciteMaxGroupe,
      // §3 — le ratio de 1 pour 20 est réglementaire : la capacité d'un groupe
      // ne peut jamais le dépasser, seulement être plus stricte.
      ratioMaxEleves: Math.min(capaciteMaxGroupe, 20),
      ...reste,
    },
  });

  await creerVersionConfiguration(anneeScolaireId, "Réglages modifiés.");

  revalidatePath("/parametres");
  return { ok: true, message: "Réglages enregistrés. Nouvelle version créée." };
}
