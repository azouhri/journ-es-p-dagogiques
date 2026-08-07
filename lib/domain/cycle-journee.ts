/**
 * Cycle de vie d'une journée pédagogique : ce qui reste modifiable, et quand.
 *
 * L'axe déterminant n'est PAS « validée ou non » mais « vécue ou non ».
 *
 * Une journée validée mais à venir n'est qu'un planning affiché : le modifier
 * coûte une communication à refaire, rien de plus. Une journée déjà vécue est
 * autre chose — ses affectations croisées avec les présences constituent le
 * relevé de qui a réellement travaillé, et c'est de là que sortent les
 * compteurs d'équité (§9.5). La réécrire fausserait l'historique de toute
 * l'équipe.
 *
 * D'où la règle générale : le PLANNING se fige quand la journée a été vécue ;
 * les PRÉSENCES, elles, restent corrigeables indéfiniment — §9.5 le demande
 * explicitement, une correction tardive devant se répercuter aussitôt.
 */

export type StatutJournee = "BROUILLON" | "GENERE" | "VALIDE";

export interface EtatJournee {
  statut: StatutJournee;
  /** Le premier jour est-il déjà passé ? */
  commencee: boolean;
  /** Au moins un jour dont les présences ont été confirmées. */
  confirmee: boolean;
  /**
   * Présences s'écartant du pré-remplissage : absences, remplacements, élèves
   * absents ou partis tôt. Leur existence prouve que quelqu'un a constaté le
   * déroulement réel de la journée.
   */
  exceptionsSaisies: number;
}

/**
 * Une journée dont on a déjà relevé le déroulement réel.
 * C'est le critère qui fige le planning.
 */
export function estVecue(etat: EtatJournee): boolean {
  return etat.confirmee || etat.exceptionsSaisies > 0;
}

/** Effort demandé avant de détruire quelque chose d'irréversible. */
export type NiveauConfirmation = "simple" | "consequences" | "saisie_du_nom";

export interface DroitsJournee {
  /** Participants, disponibilités, génération, permutation. */
  modifierPlanning: boolean;
  /** Repasser une journée validée en modifiable. */
  devalider: boolean;
  supprimer: boolean;
  /** Saisir ou corriger les présences. */
  saisirPresences: boolean;
  /** Niveau de confirmation exigé pour la suppression. */
  confirmationSuppression: NiveauConfirmation;
  /** Pourquoi le planning n'est pas modifiable, le cas échéant. */
  raisonPlanningFige: string | null;
  /** Pourquoi la dévalidation est refusée, le cas échéant. */
  raisonDevalidationRefusee: string | null;
}

export function droitsJournee(etat: EtatJournee): DroitsJournee {
  const validee = etat.statut === "VALIDE";
  const vecue = estVecue(etat);

  // Tant que la journée n'est pas validée, tout se modifie librement.
  const modifierPlanning = !validee;

  // On peut rouvrir une journée validée tant que personne n'a relevé son
  // déroulement. Passé ce point, rouvrir permettrait de permuter deux
  // éducateurs alors qu'une absence a déjà été saisie sur leur affectation :
  // l'absence se retrouverait attribuée à quelqu'un d'autre.
  const devalider = validee && !vecue;

  let raisonDevalidationRefusee: string | null = null;
  if (validee && vecue) {
    raisonDevalidationRefusee = etat.confirmee
      ? "Les présences de cette journée ont été confirmées. Le planning ne peut plus être rouvert, mais les présences restent corrigeables."
      : `${etat.exceptionsSaisies} absence(s) ou remplacement(s) ont déjà été saisis. Le planning ne peut plus être rouvert, mais les présences restent corrigeables.`;
  }

  let raisonPlanningFige: string | null = null;
  if (validee) {
    raisonPlanningFige = vecue
      ? "Journée vécue : son planning fait partie de l'historique."
      : "Journée validée. La rouvrir pour la modifier.";
  }

  // La suppression reste possible à tout moment — une journée annulée doit
  // pouvoir disparaître — mais l'effort demandé croît avec ce qu'elle détruit.
  let confirmationSuppression: NiveauConfirmation = "simple";
  if (vecue || (validee && etat.commencee)) {
    confirmationSuppression = "saisie_du_nom";
  } else if (etat.statut !== "BROUILLON") {
    confirmationSuppression = "consequences";
  }

  return {
    modifierPlanning,
    devalider,
    supprimer: true,
    // §9.5 — corriger une présence doit rester possible indéfiniment.
    saisirPresences: validee,
    confirmationSuppression,
    raisonPlanningFige,
    raisonDevalidationRefusee,
  };
}

export interface ConsequencesSuppression {
  jours: number;
  groupes: number;
  affectations: number;
  /** Éducateurs dont les compteurs d'équité vont diminuer. */
  educateursImpactes: number;
  /** Minutes qui disparaîtront des compteurs. */
  minutesRetirees: number;
  /** La journée a-t-elle déjà été vécue ? */
  vecue: boolean;
}

/**
 * Résume ce qu'une suppression détruit, pour l'annoncer AVANT de la faire.
 *
 * Les compteurs d'équité étant recalculés et non stockés (§9.5), supprimer
 * une journée retire silencieusement ses heures à toute l'équipe. Silencieux
 * est précisément ce qu'il ne faut pas : on chiffre l'effet.
 */
export function resumerSuppression(
  etat: EtatJournee,
  affectations: ReadonlyArray<{
    educateurId: string;
    quartDebutMinutes: number;
    quartFinMinutes: number;
  }>,
  jours: number,
  groupes: number,
): ConsequencesSuppression {
  const educateurs = new Set(affectations.map((a) => a.educateurId));
  const minutes = affectations.reduce(
    (s, a) => s + (a.quartFinMinutes - a.quartDebutMinutes),
    0,
  );

  return {
    jours,
    groupes,
    affectations: affectations.length,
    educateursImpactes: educateurs.size,
    minutesRetirees: minutes,
    vecue: estVecue(etat),
  };
}
