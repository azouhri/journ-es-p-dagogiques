import "server-only";

import {
  droitsJournee,
  resumerSuppression,
  type ConsequencesSuppression,
  type DroitsJournee,
  type EtatJournee,
} from "@/lib/domain/cycle-journee";
import { prisma } from "@/lib/prisma";

export interface JourneeAvecDroits {
  id: string;
  nom: string;
  anneeScolaireId: string;
  etat: EtatJournee;
  droits: DroitsJournee;
}

/**
 * Lit l'état d'une journée et en déduit ce qui reste permis.
 *
 * Point unique de vérité : chaque action mutante s'y réfère, plutôt que de
 * redécider dans son coin. Les écrans masquaient déjà les commandes
 * interdites, mais rien ne gardait les actions elles-mêmes — un appel direct
 * passait outre.
 */
export async function chargerDroitsJournee(
  journeeId: string,
  aujourdhui = new Date(),
): Promise<JourneeAvecDroits | null> {
  const journee = await prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    select: {
      id: true,
      nom: true,
      statut: true,
      anneeScolaireId: true,
      jours: {
        select: {
          date: true,
          statutConfirmation: true,
          presencesEleve: { select: { statut: true } },
          affectations: {
            select: { presence: { select: { statut: true } } },
          },
        },
      },
    },
  });

  if (!journee) return null;

  // Une exception est une présence qui s'écarte du pré-remplissage : quelqu'un
  // a donc constaté le déroulement réel de la journée.
  const exceptionsSaisies = journee.jours.reduce(
    (total, jour) =>
      total +
      jour.affectations.filter(
        (a) => a.presence && a.presence.statut !== "PRESENT",
      ).length +
      jour.presencesEleve.filter((p) => p.statut !== "PRESENT").length,
    0,
  );

  const debut = journee.jours
    .map((j) => j.date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const etat: EtatJournee = {
    statut: journee.statut,
    commencee: debut ? debut < aujourdhui : false,
    confirmee: journee.jours.some((j) => j.statutConfirmation === "CONFIRME"),
    exceptionsSaisies,
  };

  return {
    id: journee.id,
    nom: journee.nom,
    anneeScolaireId: journee.anneeScolaireId,
    etat,
    droits: droitsJournee(etat),
  };
}

export interface ApercuSuppression extends ConsequencesSuppression {
  nom: string;
  /** Effort de confirmation exigé. */
  niveau: DroitsJournee["confirmationSuppression"];
}

/** Ce qu'une suppression détruirait, chiffré avant de la proposer. */
export async function chargerApercuSuppression(
  journeeId: string,
): Promise<ApercuSuppression | null> {
  const journee = await chargerDroitsJournee(journeeId);
  if (!journee) return null;

  const [affectations, jours, groupes] = await Promise.all([
    prisma.affectation.findMany({
      where: { jourPlanifie: { journeePedagogiqueId: journeeId } },
      select: {
        educateurId: true,
        quartDebutMinutes: true,
        quartFinMinutes: true,
      },
    }),
    prisma.jourPlanifie.count({ where: { journeePedagogiqueId: journeeId } }),
    prisma.groupe.count({
      where: { jourPlanifie: { journeePedagogiqueId: journeeId } },
    }),
  ]);

  return {
    ...resumerSuppression(journee.etat, affectations, jours, groupes),
    nom: journee.nom,
    niveau: journee.droits.confirmationSuppression,
  };
}

/**
 * Refuse la modification du planning d'une journée figée.
 * Retourne le motif du refus, ou `null` si la modification est permise.
 */
export async function refusSiPlanningFige(
  journeeId: string,
): Promise<string | null> {
  const journee = await chargerDroitsJournee(journeeId);
  if (!journee) return "Journée introuvable.";
  return journee.droits.modifierPlanning ? null : journee.droits.raisonPlanningFige;
}

/** Même contrôle, à partir d'un jour du bloc. */
export async function refusSiPlanningFigePourJour(
  jourPlanifieId: string,
): Promise<string | null> {
  const jour = await prisma.jourPlanifie.findUnique({
    where: { id: jourPlanifieId },
    select: { journeePedagogiqueId: true },
  });
  if (!jour) return "Journée introuvable.";
  return refusSiPlanningFige(jour.journeePedagogiqueId);
}
