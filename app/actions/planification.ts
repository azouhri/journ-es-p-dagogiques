"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import {
  chargerConfiguration,
  tranchesParEducateur,
} from "@/lib/data/configuration";
import { resoudreDateReference } from "@/lib/domain/age";
import {
  calculerCompteurs,
  type AffectationRealisee,
} from "@/lib/domain/equite";
import { genererJour } from "@/lib/domain/generation";
import { constituerGroupes } from "@/lib/domain/groupes";
import type {
  CompteursEducateur,
  EducateurRef,
  EleveRef,
  GroupeConstitue,
} from "@/lib/domain/types";
import { prisma } from "@/lib/prisma";
import type { ResultatAction } from "./journees";

// ---------------------------------------------------------------------------
// Étapes 2 et 3 — participants et disponibilités
// ---------------------------------------------------------------------------

/** §6 étape 2 — sélectionner les élèves participants. */
export async function definirParticipants(
  journeeId: string,
  eleveIds: string[],
): Promise<ResultatAction> {
  await prisma.$transaction([
    prisma.participation.deleteMany({
      where: { journeePedagogiqueId: journeeId },
    }),
    prisma.participation.createMany({
      data: eleveIds.map((eleveId) => ({
        eleveId,
        journeePedagogiqueId: journeeId,
      })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath(`/journees/${journeeId}`);
  return { ok: true, message: `${eleveIds.length} élève(s) inscrit(s).` };
}

/**
 * §6 étape 3 — confirmer les éducateurs disponibles.
 * Un éducateur décoché est ignoré par la génération ; son retard est reporté
 * sur la journée suivante, ce que les compteurs rattrapent d'eux-mêmes (§8.3).
 */
export async function definirDisponibilites(
  jourPlanifieId: string,
  indisponibles: string[],
): Promise<ResultatAction> {
  const educateurs = await prisma.educateur.findMany({
    where: { actif: true },
    select: { id: true },
  });
  const exclus = new Set(indisponibles);

  await prisma.$transaction([
    prisma.disponibilite.deleteMany({ where: { jourPlanifieId } }),
    prisma.disponibilite.createMany({
      data: educateurs.map((e) => ({
        educateurId: e.id,
        jourPlanifieId,
        disponible: !exclus.has(e.id),
      })),
    }),
  ]);

  const jour = await prisma.jourPlanifie.findUnique({
    where: { id: jourPlanifieId },
    select: { journeePedagogiqueId: true },
  });
  if (jour) revalidatePath(`/journees/${jour.journeePedagogiqueId}`);

  return {
    ok: true,
    message: `${educateurs.length - exclus.size} éducateur(s) disponible(s).`,
  };
}

// ---------------------------------------------------------------------------
// Étape 4 — aperçu des groupes et contrôle de faisabilité, SANS écriture
// ---------------------------------------------------------------------------

export interface ApercuJour {
  jourPlanifieId: string;
  date: string;
  groupes: Array<{ libelle: string; effectif: number }>;
  nonClasses: number;
  educateursDisponibles: number;
  educateursRequis: number;
  manquants: number;
}

export interface ApercuGeneration {
  ok: boolean;
  faisable: boolean;
  message: string;
  jours: ApercuJour[];
  avertissements: string[];
}

/**
 * §7.4 — « Si les éducateurs disponibles sont insuffisants, le système
 * l'annonce AVANT de générer, en indiquant combien il en manque. »
 *
 * Cette fonction ne touche jamais à la base : elle constitue les groupes en
 * mémoire et applique la passe 1 de l'algorithme. Elle sert à la fois d'aperçu
 * permanent à l'étape 4 et de garde-fou en tête de `genererPlanning`, pour
 * qu'un manque d'effectif ne soit plus découvert APRÈS avoir effacé le
 * planning précédent.
 */
export async function previsualiserGroupes(
  journeeId: string,
): Promise<ApercuGeneration> {
  const vide = { jours: [], avertissements: [] };

  const journee = await prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    include: {
      jours: {
        orderBy: { date: "asc" },
        include: { disponibilites: true },
      },
      participations: { include: { eleve: true } },
    },
  });

  if (!journee) {
    return { ok: false, faisable: false, message: "Journée introuvable.", ...vide };
  }
  if (journee.participations.length === 0) {
    return {
      ok: false,
      faisable: false,
      message: "Aucun élève inscrit : sélectionner les participants à l'étape 2.",
      ...vide,
    };
  }

  const config = await chargerConfiguration(journee.anneeScolaireId);
  if (!config) {
    return { ok: false, faisable: false, message: "Configuration introuvable.", ...vide };
  }

  const annee = await prisma.anneeScolaire.findUniqueOrThrow({
    where: { id: journee.anneeScolaireId },
  });
  const dateReference = resoudreDateReference(
    annee,
    config.reglages.dateReferenceAgeJour,
    config.reglages.dateReferenceAgeMois,
  );

  const participants: EleveRef[] = journee.participations.map((p) => ({
    id: p.eleve.id,
    nom: p.eleve.nom,
    prenom: p.eleve.prenom,
    dateNaissance: p.eleve.dateNaissance,
    niveauScolaire: p.eleve.niveauScolaire,
  }));

  const tousEducateurs = await prisma.educateur.findMany();
  const declarations = await tranchesParEducateur(journee.anneeScolaireId);

  // L'aperçu rejoue la génération COMPLÈTE en mémoire, pas seulement le
  // décompte d'effectif : c'est le seul moyen de repérer aussi les blocages
  // qui ne tiennent pas au nombre — par exemple une tranche d'âge dont aucun
  // éducateur disponible n'est habilité à s'occuper.
  let compteurs = await compteursHorsJournee(journee.anneeScolaireId, journee.jours.map((j) => j.id), tousEducateurs);

  const avertissements = new Set<string>();
  const jours: ApercuJour[] = [];
  let bloque = false;

  for (const jour of journee.jours) {
    const { groupes, nonClasses, avertissements: avGroupes } =
      constituerGroupes({
        participants,
        tranches: config.tranches,
        mode: config.reglages.modeGroupement,
        dateReference,
        capaciteMaxGroupe: config.reglages.capaciteMaxGroupe,
      });

    for (const a of avGroupes) avertissements.add(a.message);

    const disponibles = await educateursDuJour(jour.id, tousEducateurs);

    const resultat = genererJour({
      quarts: config.quarts,
      groupes,
      educateursDisponibles: disponibles,
      compteurs,
      reglages: config.reglages,
      tranchesParEducateur: declarations,
    });

    for (const a of resultat.avertissements) avertissements.add(a.message);
    if (!resultat.faisable) bloque = true;
    compteurs = resultat.compteursApres;

    jours.push({
      jourPlanifieId: jour.id,
      date: jour.date.toISOString().slice(0, 10),
      groupes: groupes.map((g) => ({
        libelle: g.libelle,
        effectif: g.eleves.length,
      })),
      nonClasses: nonClasses.length,
      educateursDisponibles: disponibles.length,
      educateursRequis: resultat.diagnostic.nbEducateursRequis,
      manquants: resultat.diagnostic.manquants,
    });
  }

  const manquantsMax = Math.max(...jours.map((j) => j.manquants), 0);
  const faisable =
    !bloque && manquantsMax === 0 && jours.every((j) => j.groupes.length > 0);

  return {
    ok: true,
    faisable,
    message: faisable
      ? "Effectif suffisant : le planning peut être généré."
      : manquantsMax > 0
        ? `Effectif insuffisant : il manque ${manquantsMax} éducateur(s). Retirer des élèves, augmenter la capacité des groupes, ou rendre d'autres éducateurs disponibles.`
        : jours.every((j) => j.groupes.length > 0)
          ? "La génération est bloquée : voir le détail ci-dessous."
          : "Aucun groupe ne peut être constitué avec ces participants.",
    jours,
    avertissements: [...avertissements],
  };
}

/** Compteurs de l'année, hors les jours de la journée en cours (§9.5). */
async function compteursHorsJournee(
  anneeScolaireId: string,
  idsJoursExclus: string[],
  tousEducateurs: Array<{ id: string }>,
): Promise<Map<string, CompteursEducateur>> {
  const historique = await prisma.affectation.findMany({
    where: {
      jourPlanifie: {
        journeePedagogique: { anneeScolaireId },
        id: { notIn: idsJoursExclus },
      },
    },
    select: {
      jourPlanifieId: true,
      educateurId: true,
      quartCode: true,
      quartDebutMinutes: true,
      quartFinMinutes: true,
      presence: { select: { statut: true, remplacantId: true } },
    },
  });

  return calculerCompteurs({
    educateurIds: tousEducateurs.map((e) => e.id),
    affectations: historique as AffectationRealisee[],
  });
}

// ---------------------------------------------------------------------------
// Étape 5 — génération
// ---------------------------------------------------------------------------

export async function genererPlanning(
  journeeId: string,
): Promise<ResultatAction> {
  const journee = await prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    include: {
      jours: { orderBy: { date: "asc" } },
      participations: { include: { eleve: true } },
    },
  });

  if (!journee) return { ok: false, message: "Journée introuvable." };
  if (journee.statut === "VALIDE") {
    return {
      ok: false,
      message: "Journée déjà validée : les affectations sont figées.",
    };
  }

  // GARDE-FOU : on vérifie la faisabilité AVANT toute écriture. Auparavant, un
  // effectif insuffisant n'était découvert qu'après avoir supprimé le planning
  // existant, ce qui laissait la journée dans un état pire qu'au départ.
  const apercu = await previsualiserGroupes(journeeId);
  if (!apercu.ok || !apercu.faisable) {
    return { ok: false, message: apercu.message };
  }

  const config = await chargerConfiguration(journee.anneeScolaireId);
  if (!config) return { ok: false, message: "Configuration introuvable." };

  const annee = await prisma.anneeScolaire.findUniqueOrThrow({
    where: { id: journee.anneeScolaireId },
  });
  const dateReference = resoudreDateReference(
    annee,
    config.reglages.dateReferenceAgeJour,
    config.reglages.dateReferenceAgeMois,
  );

  const idsJoursCourants = journee.jours.map((j) => j.id);

  const historique = await prisma.affectation.findMany({
    where: {
      jourPlanifie: {
        journeePedagogique: { anneeScolaireId: journee.anneeScolaireId },
        id: { notIn: idsJoursCourants },
      },
    },
    select: {
      jourPlanifieId: true,
      educateurId: true,
      quartCode: true,
      quartDebutMinutes: true,
      quartFinMinutes: true,
      presence: { select: { statut: true, remplacantId: true } },
    },
  });

  const tousEducateurs = await prisma.educateur.findMany();
  const declarations = await tranchesParEducateur(journee.anneeScolaireId);
  let compteurs: Map<string, CompteursEducateur> = calculerCompteurs({
    educateurIds: tousEducateurs.map((e) => e.id),
    affectations: historique as AffectationRealisee[],
  });

  const journeePrecedente = await prisma.journeePedagogique.findFirst({
    where: {
      anneeScolaireId: journee.anneeScolaireId,
      id: { not: journeeId },
      valideeLe: { not: null },
    },
    orderBy: { valideeLe: "desc" },
    include: { jours: { include: { affectations: true } } },
  });

  const quartsJourneePrecedente = new Map<string, Set<string>>();
  for (const j of journeePrecedente?.jours ?? []) {
    for (const a of j.affectations) {
      const set = quartsJourneePrecedente.get(a.educateurId) ?? new Set<string>();
      set.add(a.quartCode);
      quartsJourneePrecedente.set(a.educateurId, set);
    }
  }

  const participants: EleveRef[] = journee.participations.map((p) => ({
    id: p.eleve.id,
    nom: p.eleve.nom,
    prenom: p.eleve.prenom,
    dateNaissance: p.eleve.dateNaissance,
    niveauScolaire: p.eleve.niveauScolaire,
  }));

  const avertissements: string[] = [...apercu.avertissements];

  for (const jour of journee.jours) {
    const { groupes: constitues } = constituerGroupes({
      participants,
      tranches: config.tranches,
      mode: config.reglages.modeGroupement,
      dateReference,
      capaciteMaxGroupe: config.reglages.capaciteMaxGroupe,
    });

    // Les identifiants sont fabriqués ici plutôt que par la base : cela permet
    // un unique createMany au lieu d'un aller-retour réseau par groupe. Sur le
    // pooler, la différence se compte en dizaines de secondes.
    const groupes: GroupeConstitue[] = constitues.map((g) => ({
      ...g,
      id: randomUUID(),
    }));

    const resultat = genererJour({
      quarts: config.quarts,
      groupes,
      educateursDisponibles: await educateursDuJour(jour.id, tousEducateurs),
      compteurs,
      quartsJourneePrecedente,
      reglages: config.reglages,
      tranchesParEducateur: declarations,
    });

    if (!resultat.faisable) {
      return {
        ok: false,
        message: resultat.avertissements.map((a) => a.message).join(" "),
      };
    }

    // Tout le jour en une seule transaction : soit le planning est remplacé
    // entièrement, soit rien ne bouge.
    await prisma.$transaction([
      prisma.affectation.deleteMany({ where: { jourPlanifieId: jour.id } }),
      prisma.presenceEleve.deleteMany({ where: { jourPlanifieId: jour.id } }),
      prisma.groupe.deleteMany({ where: { jourPlanifieId: jour.id } }),
      prisma.groupe.createMany({
        data: groupes.map((g) => ({
          id: g.id,
          jourPlanifieId: jour.id,
          trancheAgeId: g.trancheAgeId,
          libelle: g.libelle,
          ordre: g.ordre,
        })),
      }),
      prisma.groupeEleve.createMany({
        data: groupes.flatMap((g) =>
          g.eleves.map((e) => ({ groupeId: g.id, eleveId: e.id })),
        ),
      }),
      prisma.affectation.createMany({
        data: resultat.affectations.map((a) => ({
          jourPlanifieId: jour.id,
          educateurId: a.educateurId,
          typeQuartId: a.typeQuartId,
          groupeId: a.groupeId,
          quartCode: a.quartCode,
          quartLibelle: a.quartLibelle,
          quartDebutMinutes: a.quartDebutMinutes,
          quartFinMinutes: a.quartFinMinutes,
          justification: a.justification,
          issueEnchainement: a.issueEnchainement,
        })),
      }),
    ]);

    for (const a of resultat.avertissements) avertissements.push(a.message);
    compteurs = resultat.compteursApres;
  }

  const version = await prisma.versionConfiguration.findFirst({
    where: { anneeScolaireId: journee.anneeScolaireId },
    orderBy: { numero: "desc" },
  });

  await prisma.journeePedagogique.update({
    where: { id: journeeId },
    data: {
      statut: "GENERE",
      genereeLe: new Date(),
      versionConfigurationId: version?.id ?? null,
    },
  });

  revalidatePath(`/journees/${journeeId}`);
  revalidatePath("/journees");

  return {
    ok: true,
    message:
      avertissements.length > 0
        ? `Planning généré. ${avertissements.join(" ")}`
        : "Planning généré.",
  };
}

/** Éducateurs retenus pour un jour : la saisie explicite, sinon tous les actifs. */
async function educateursDuJour(
  jourPlanifieId: string,
  tous: Array<{ id: string; nom: string; prenom: string; actif: boolean }>,
): Promise<EducateurRef[]> {
  const dispos = await prisma.disponibilite.findMany({
    where: { jourPlanifieId },
    select: { educateurId: true, disponible: true },
  });

  if (dispos.length === 0) {
    return tous
      .filter((e) => e.actif)
      .map((e) => ({ id: e.id, nom: e.nom, prenom: e.prenom }));
  }

  const retenus = new Set(
    dispos.filter((d) => d.disponible).map((d) => d.educateurId),
  );
  return tous
    .filter((e) => e.actif && retenus.has(e.id))
    .map((e) => ({ id: e.id, nom: e.nom, prenom: e.prenom }));
}

// ---------------------------------------------------------------------------
// Étapes 6 et 7 — ajuster, valider
// ---------------------------------------------------------------------------

export async function permuterAffectations(
  affectationA: string,
  affectationB: string,
): Promise<ResultatAction> {
  const [a, b] = await Promise.all([
    prisma.affectation.findUnique({ where: { id: affectationA } }),
    prisma.affectation.findUnique({ where: { id: affectationB } }),
  ]);

  if (!a || !b) return { ok: false, message: "Affectation introuvable." };
  if (a.jourPlanifieId !== b.jourPlanifieId) {
    return {
      ok: false,
      message: "Les deux affectations doivent être le même jour.",
    };
  }

  await prisma.$transaction([
    prisma.affectation.update({
      where: { id: a.id },
      data: {
        educateurId: b.educateurId,
        ajusteeManuellement: true,
        justification: "Permutation manuelle.",
      },
    }),
    prisma.affectation.update({
      where: { id: b.id },
      data: {
        educateurId: a.educateurId,
        ajusteeManuellement: true,
        justification: "Permutation manuelle.",
      },
    }),
  ]);

  const jour = await prisma.jourPlanifie.findUnique({
    where: { id: a.jourPlanifieId },
    select: { journeePedagogiqueId: true },
  });
  if (jour) revalidatePath(`/journees/${jour.journeePedagogiqueId}`);

  return { ok: true, message: "Éducateurs permutés." };
}

export async function validerJournee(
  journeeId: string,
): Promise<ResultatAction> {
  const journee = await prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    include: {
      jours: {
        include: {
          affectations: { select: { id: true } },
          groupes: { include: { membres: true } },
        },
      },
    },
  });

  if (!journee) return { ok: false, message: "Journée introuvable." };
  if (journee.statut !== "GENERE") {
    return { ok: false, message: "Générer le planning avant de le valider." };
  }

  for (const jour of journee.jours) {
    await prisma.presenceEducateur.createMany({
      data: jour.affectations.map((a) => ({
        affectationId: a.id,
        statut: "PRESENT" as const,
      })),
      skipDuplicates: true,
    });

    await prisma.presenceEleve.createMany({
      data: jour.groupes.flatMap((g) =>
        g.membres.map((m) => ({
          jourPlanifieId: jour.id,
          eleveId: m.eleveId,
          groupeId: g.id,
          statut: "PRESENT" as const,
        })),
      ),
      skipDuplicates: true,
    });
  }

  await prisma.journeePedagogique.update({
    where: { id: journeeId },
    data: { statut: "VALIDE", valideeLe: new Date() },
  });

  revalidatePath(`/journees/${journeeId}`);
  revalidatePath("/journees");
  return {
    ok: true,
    message:
      "Journée validée. Les présences sont pré-remplies à « présent » : il ne reste qu'à saisir les exceptions.",
  };
}
