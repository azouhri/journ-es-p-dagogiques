"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { creerVersionConfiguration } from "@/lib/data/configuration";
import { versMinutes } from "@/lib/domain/temps";
import { entierFacultatif } from "@/lib/validation";
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

const SchemaTranche = z
  .object({
    id: z.string().optional(),
    anneeScolaireId: z.string().min(1),
    libelle: z.string().trim().min(1, "Le nom de la tranche est obligatoire."),
    ageMin: z.coerce.number().int().min(0).max(21),
    ageMax: z.coerce.number().int().min(0).max(21),
    niveauMin: entierFacultatif(0, 6),
    niveauMax: entierFacultatif(0, 6),
  })
  .refine((v) => v.ageMax >= v.ageMin, {
    message: "L'âge maximum doit être supérieur ou égal au minimum.",
    path: ["ageMax"],
  })
  .refine(
    (v) =>
      v.niveauMin === null || v.niveauMax === null || v.niveauMax >= v.niveauMin,
    {
      message: "Le niveau maximum doit être supérieur ou égal au minimum.",
      path: ["niveauMax"],
    },
  );

/**
 * §5.3 / §10 — création et modification d'une tranche d'âge.
 *
 * Deux tranches qui se chevauchent rendraient le classement d'un élève
 * ambigu : il tomberait dans la première rencontrée, au gré de l'ordre
 * d'affichage. Le chevauchement est donc refusé, sur l'âge comme sur le
 * niveau scolaire.
 */
export async function enregistrerTrancheAge(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const analyse = SchemaTranche.safeParse({
    id: (donnees.get("id") as string) || undefined,
    anneeScolaireId: donnees.get("anneeScolaireId"),
    libelle: donnees.get("libelle"),
    ageMin: donnees.get("ageMin"),
    ageMax: donnees.get("ageMax"),
    niveauMin: donnees.get("niveauMin") ?? "",
    niveauMax: donnees.get("niveauMax") ?? "",
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { id, anneeScolaireId, libelle, ageMin, ageMax, niveauMin, niveauMax } =
    analyse.data;

  const autres = await prisma.trancheAge.findMany({
    where: { anneeScolaireId, ...(id ? { id: { not: id } } : {}) },
    orderBy: { ordre: "asc" },
  });

  const chevauche = autres.find((t) => ageMin <= t.ageMax && t.ageMin <= ageMax);
  if (chevauche) {
    return {
      ok: false,
      message: `Chevauchement avec « ${chevauche.libelle} » (${chevauche.ageMin}-${chevauche.ageMax} ans) : un élève ne peut pas appartenir à deux tranches.`,
    };
  }

  if (niveauMin !== null && niveauMax !== null) {
    const chevaucheNiveau = autres.find(
      (t) =>
        t.niveauMin !== null &&
        t.niveauMax !== null &&
        niveauMin <= t.niveauMax &&
        t.niveauMin <= niveauMax,
    );
    if (chevaucheNiveau) {
      return {
        ok: false,
        message: `Chevauchement de niveau scolaire avec « ${chevaucheNiveau.libelle} ».`,
      };
    }
  }

  const valeurs = { libelle, ageMin, ageMax, niveauMin, niveauMax };

  try {
    if (id) {
      await prisma.trancheAge.update({ where: { id }, data: valeurs });
    } else {
      await prisma.trancheAge.create({
        data: {
          ...valeurs,
          anneeScolaireId,
          // Les tranches se lisent du plus jeune au plus âgé.
          ordre: ageMin,
        },
      });
    }
  } catch (erreur) {
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === "P2002"
    ) {
      return {
        ok: false,
        message: `Une tranche « ${libelle} » existe déjà pour cette année.`,
      };
    }
    throw erreur;
  }

  // Les tranches restent classées par âge croissant après chaque changement.
  const toutes = await prisma.trancheAge.findMany({
    where: { anneeScolaireId },
    orderBy: { ageMin: "asc" },
  });
  for (const [i, t] of toutes.entries()) {
    if (t.ordre !== i) {
      await prisma.trancheAge.update({ where: { id: t.id }, data: { ordre: i } });
    }
  }

  await creerVersionConfiguration(
    anneeScolaireId,
    id ? `Tranche « ${libelle} » modifiée.` : `Tranche « ${libelle} » ajoutée.`,
  );

  revalidatePath("/parametres");
  return {
    ok: true,
    message: id
      ? "Tranche modifiée. Les journées déjà planifiées gardent leurs groupes."
      : "Tranche ajoutée.",
  };
}

/**
 * Supprime une tranche d'âge.
 *
 * Refusé dès qu'un groupe déjà constitué s'y rattache : effacer la tranche
 * effacerait la trace de la composition d'une journée passée.
 */
export async function supprimerTrancheAge(id: string): Promise<ResultatAction> {
  const tranche = await prisma.trancheAge.findUnique({
    where: { id },
    include: { _count: { select: { groupes: true } } },
  });
  if (!tranche) return { ok: false, message: "Tranche introuvable." };

  if (tranche._count.groupes > 0) {
    return {
      ok: false,
      message: `« ${tranche.libelle} » est utilisée par ${tranche._count.groupes} groupe(s) déjà constitué(s) et ne peut pas être supprimée.`,
    };
  }

  await prisma.trancheAge.delete({ where: { id } });
  await creerVersionConfiguration(
    tranche.anneeScolaireId,
    `Tranche « ${tranche.libelle} » supprimée.`,
  );

  revalidatePath("/parametres");
  return { ok: true, message: "Tranche supprimée." };
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
