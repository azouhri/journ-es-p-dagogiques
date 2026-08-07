"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  quartsPourCreation,
  tranchesPourCreation,
} from "@/lib/configuration-defaut";
import { prisma } from "@/lib/prisma";
import type { ResultatAction } from "./journees";

const SchemaAnnee = z
  .object({
    libelle: z.string().trim().min(1, "Le nom de l'année est obligatoire."),
    dateDebut: z.string().min(1, "La date de début est obligatoire."),
    dateFin: z.string().min(1, "La date de fin est obligatoire."),
    statut: z.enum(["PREPARATION", "ACTIVE", "ARCHIVEE"]),
  })
  .refine((v) => v.dateFin > v.dateDebut, {
    message: "La date de fin doit suivre la date de début.",
    path: ["dateFin"],
  });

const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Une seule année peut être active à la fois.
 *
 * L'année active est celle que proposent par défaut le tableau de bord et la
 * création d'une journée ; deux années actives rendraient ce choix arbitraire.
 */
async function rendreSeuleActive(id: string) {
  await prisma.anneeScolaire.updateMany({
    where: { id: { not: id }, statut: "ACTIVE" },
    data: { statut: "ARCHIVEE" },
  });
}

/**
 * Crée une année scolaire ET sa configuration.
 *
 * Une année sans types de quart ni tranches d'âge ne peut rien planifier :
 * la créer nue reviendrait à livrer une coquille inutilisable. La
 * configuration est recopiée depuis l'année la plus récente lorsqu'il en
 * existe une — c'est presque toujours ce qu'on veut — sinon on part des
 * valeurs par défaut.
 */
export async function creerAnneeScolaire(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const analyse = SchemaAnnee.safeParse({
    libelle: donnees.get("libelle"),
    dateDebut: donnees.get("dateDebut"),
    dateFin: donnees.get("dateFin"),
    statut: donnees.get("statut") || "PREPARATION",
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { libelle, dateDebut, dateFin, statut } = analyse.data;

  const existante = await prisma.anneeScolaire.findUnique({
    where: { libelle },
  });
  if (existante) {
    return { ok: false, message: `L'année « ${libelle} » existe déjà.` };
  }

  const modele = await prisma.anneeScolaire.findFirst({
    orderBy: { dateDebut: "desc" },
    include: {
      typesQuart: { orderBy: { ordre: "asc" } },
      tranchesAge: { orderBy: { ordre: "asc" } },
      reglages: true,
    },
  });

  const annee = await prisma.anneeScolaire.create({
    data: {
      libelle,
      dateDebut: jour(dateDebut),
      dateFin: jour(dateFin),
      statut,
    },
  });

  // --- Types de quart -----------------------------------------------------
  if (modele && modele.typesQuart.length > 0) {
    await prisma.typeQuart.createMany({
      data: modele.typesQuart.map((q) => ({
        anneeScolaireId: annee.id,
        code: q.code,
        libelle: q.libelle,
        debutMinutes: q.debutMinutes,
        finMinutes: q.finMinutes,
        portee: q.portee,
        effectifRequis: q.effectifRequis,
        actif: q.actif,
        ordre: q.ordre,
      })),
    });
  } else {
    await prisma.typeQuart.createMany({ data: quartsPourCreation(annee.id) });
  }

  // Les enchaînements se recâblent une fois les identifiants connus (§4.3).
  const nouveaux = await prisma.typeQuart.findMany({
    where: { anneeScolaireId: annee.id },
  });
  const parCode = new Map(nouveaux.map((q) => [q.code, q.id]));

  const enchainements = modele?.typesQuart.length
    ? modele.typesQuart
        .filter((q) => q.enchaineSurId)
        .map((q) => ({
          code: q.code,
          suivant: modele.typesQuart.find((x) => x.id === q.enchaineSurId)?.code,
        }))
    : [{ code: "OUVERTURE", suivant: "MATINEE" }];

  for (const e of enchainements) {
    const id = parCode.get(e.code);
    const suivantId = e.suivant ? parCode.get(e.suivant) : undefined;
    if (id && suivantId) {
      await prisma.typeQuart.update({
        where: { id },
        data: { enchaineSurId: suivantId },
      });
    }
  }

  // --- Tranches d'âge et réglages -----------------------------------------
  if (modele && modele.tranchesAge.length > 0) {
    await prisma.trancheAge.createMany({
      data: modele.tranchesAge.map((t) => ({
        anneeScolaireId: annee.id,
        libelle: t.libelle,
        ageMin: t.ageMin,
        ageMax: t.ageMax,
        niveauMin: t.niveauMin,
        niveauMax: t.niveauMax,
        ordre: t.ordre,
      })),
    });
  } else {
    await prisma.trancheAge.createMany({ data: tranchesPourCreation(annee.id) });
  }

  const r = modele?.reglages;
  await prisma.reglages.create({
    data: {
      anneeScolaireId: annee.id,
      ...(r
        ? {
            capaciteMaxGroupe: r.capaciteMaxGroupe,
            ratioMaxEleves: r.ratioMaxEleves,
            modeGroupement: r.modeGroupement,
            dateReferenceAgeJour: r.dateReferenceAgeJour,
            dateReferenceAgeMois: r.dateReferenceAgeMois,
            delaiRappelHeures: r.delaiRappelHeures,
            eviterMemeQuartConsecutif: r.eviterMemeQuartConsecutif,
            continuiteTrancheAge: r.continuiteTrancheAge,
            doublePoste: r.doublePoste,
            politiqueBloc: r.politiqueBloc,
            surEffectifOuverture: r.surEffectifOuverture,
            critereDepartage: r.critereDepartage,
            politiqueTrancheEducateur: r.politiqueTrancheEducateur,
            reportEcartAnneeSuivante: r.reportEcartAnneeSuivante,
          }
        : {}),
    },
  });

  if (statut === "ACTIVE") await rendreSeuleActive(annee.id);

  revalidatePath("/parametres");
  revalidatePath("/journees");
  revalidatePath("/");

  return {
    ok: true,
    id: annee.id,
    message: modele
      ? `Année ${libelle} créée, configuration reprise de ${modele.libelle}.`
      : `Année ${libelle} créée avec la configuration par défaut.`,
  };
}

export async function modifierAnneeScolaire(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const id = donnees.get("id");
  if (typeof id !== "string" || !id) {
    return { ok: false, message: "Année introuvable." };
  }

  const analyse = SchemaAnnee.safeParse({
    libelle: donnees.get("libelle"),
    dateDebut: donnees.get("dateDebut"),
    dateFin: donnees.get("dateFin"),
    statut: donnees.get("statut") || "PREPARATION",
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { libelle, dateDebut, dateFin, statut } = analyse.data;

  // Rétrécir une année en dehors de ses journées existantes les laisserait
  // orphelines, hors de toute période : on le refuse plutôt que de créer une
  // incohérence silencieuse.
  const bornes = await prisma.jourPlanifie.aggregate({
    where: { journeePedagogique: { anneeScolaireId: id } },
    _min: { date: true },
    _max: { date: true },
  });

  if (bornes._min.date && bornes._min.date < jour(dateDebut)) {
    return {
      ok: false,
      message: `Des journées existent dès le ${bornes._min.date.toISOString().slice(0, 10)} : la date de début ne peut pas être postérieure.`,
    };
  }
  if (bornes._max.date && bornes._max.date > jour(dateFin)) {
    return {
      ok: false,
      message: `Des journées existent jusqu'au ${bornes._max.date.toISOString().slice(0, 10)} : la date de fin ne peut pas être antérieure.`,
    };
  }

  await prisma.anneeScolaire.update({
    where: { id },
    data: {
      libelle,
      dateDebut: jour(dateDebut),
      dateFin: jour(dateFin),
      statut,
    },
  });

  if (statut === "ACTIVE") await rendreSeuleActive(id);

  revalidatePath("/parametres");
  revalidatePath("/journees");
  revalidatePath("/");
  return { ok: true, message: `Année ${libelle} modifiée.` };
}

/** Supprime une année, à condition qu'elle ne porte aucune journée. */
export async function supprimerAnneeScolaire(
  id: string,
): Promise<ResultatAction> {
  const journees = await prisma.journeePedagogique.count({
    where: { anneeScolaireId: id },
  });
  if (journees > 0) {
    return {
      ok: false,
      message: `Cette année porte ${journees} journée(s) : les supprimer d'abord.`,
    };
  }

  await prisma.anneeScolaire.delete({ where: { id } });
  revalidatePath("/parametres");
  return { ok: true, message: "Année supprimée." };
}
