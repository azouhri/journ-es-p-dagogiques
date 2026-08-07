/**
 * Types du domaine — spec §4, §7, §8, §10.
 *
 * Ce module ne dépend PAS de Prisma. L'algorithme est ainsi testable sans
 * base de données, et le jour où la persistance change, seule la couche de
 * chargement est à refaire.
 *
 * Toutes les heures sont en minutes depuis minuit.
 */

export type PorteeQuart = "TOUS_GROUPES" | "PAR_GROUPE";

export type ModeGroupement = "AGE_CALCULE" | "NIVEAU_SCOLAIRE";

export type PolitiqueDoublePoste =
  | "JAMAIS"
  | "SI_EFFECTIF_INSUFFISANT"
  | "TOUJOURS";

export type PolitiqueSurEffectifOuverture =
  | "REDUIRE_AU_NOMBRE_DE_GROUPES"
  | "RENFORT_SUR_UN_GROUPE"
  | "AVANCE_PUIS_RETOUR";

export type CritereDepartage = "HEURES_CUMULEES" | "NB_JOURNEES";

/**
 * Portée des tranches d'âge déclarées d'un éducateur.
 *
 * LIBRE    : aucune contrainte (comportement historique).
 * PREFERER : on privilégie les tranches déclarées, mais on s'en écarte plutôt
 *            que de laisser un groupe sans éducateur.
 * IMPOSER  : un éducateur n'encadre que ses tranches déclarées.
 */
export type PolitiqueTrancheEducateur = "LIBRE" | "PREFERER" | "IMPOSER";

/** §4.4 / §10 — traitement d'un bloc de plusieurs jours consécutifs. */
export type PolitiqueBloc =
  | "CHAQUE_JOUR_SEPAREMENT"
  | "MEME_EQUIPE_SUR_LE_BLOC";

export type StatutPresenceEducateur = "PRESENT" | "ABSENT" | "REMPLACE";

/** §4.1 — un type de quart, tel que lu depuis la configuration. */
export interface TypeQuartConfig {
  id: string;
  code: string;
  libelle: string;
  debutMinutes: number;
  finMinutes: number;
  portee: PorteeQuart;
  /**
   * Portée TOUS_GROUPES : effectif total.
   * Portée PAR_GROUPE   : effectif requis pour chaque groupe.
   */
  effectifRequis: number;
  /** §4.3 — le quart poursuivi obligatoirement ensuite, s'il y a lieu. */
  enchaineSurId: string | null;
  actif: boolean;
  ordre: number;
}

/** §5.1 / §10 — une tranche d'âge porte les deux découpages possibles. */
export interface TrancheAgeConfig {
  id: string;
  libelle: string;
  ageMin: number;
  ageMax: number;
  niveauMin: number | null;
  niveauMax: number | null;
  ordre: number;
}

/** §10 — l'intégralité des réglages lus à chaque génération. */
export interface ReglagesConfig {
  capaciteMaxGroupe: number;
  ratioMaxEleves: number;
  modeGroupement: ModeGroupement;
  dateReferenceAgeJour: number;
  dateReferenceAgeMois: number;
  eviterMemeQuartConsecutif: boolean;
  /** Privilégier la tranche où l'éducateur a le plus d'HISTORIQUE. */
  continuiteTrancheAge: boolean;
  /** Portée des tranches DÉCLARÉES de chaque éducateur. */
  politiqueTrancheEducateur: PolitiqueTrancheEducateur;
  doublePoste: PolitiqueDoublePoste;
  politiqueBloc: PolitiqueBloc;
  surEffectifOuverture: PolitiqueSurEffectifOuverture;
  critereDepartage: CritereDepartage;
}

export interface EleveRef {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: Date;
  niveauScolaire: number | null;
}

export interface EducateurRef {
  id: string;
  nom: string;
  prenom: string;
}

/** §7 — un groupe constitué pour un jour donné. */
export interface GroupeConstitue {
  id: string;
  trancheAgeId: string;
  trancheAgeLibelle: string;
  libelle: string;
  ordre: number;
  eleves: EleveRef[];
}

/**
 * §8.1 / §9.5 — les compteurs d'un éducateur pour l'année scolaire.
 * Jamais stockés : toujours recalculés depuis Affectation × PresenceEducateur.
 */
export interface CompteursEducateur {
  educateurId: string;
  /** Clé = code de quart. Inclut les codes de quarts désormais inactifs. */
  parQuart: Record<string, number>;
  /** Somme des durées des quarts effectivement crédités, en minutes. */
  minutesCumulees: number;
  /** Nombre de jours planifiés distincts où l'éducateur a été crédité. */
  nbJourneesTravaillees: number;
}

export function compteursVides(educateurId: string): CompteursEducateur {
  return {
    educateurId,
    parQuart: {},
    minutesCumulees: 0,
    nbJourneesTravaillees: 0,
  };
}

/** Une affectation produite par la génération, avant persistance. */
export interface AffectationGeneree {
  educateurId: string;
  typeQuartId: string;
  /** §4.6 — copie figée du quart au moment de la création. */
  quartCode: string;
  quartLibelle: string;
  quartDebutMinutes: number;
  quartFinMinutes: number;
  /** Null pour un quart de portée TOUS_GROUPES. */
  groupeId: string | null;
  /** §8.4 — la raison retenue, en clair. */
  justification: string;
  /** §4.3 — vrai si l'affectation découle d'un enchaînement. */
  issueEnchainement: boolean;
}

export type NiveauAvertissement = "info" | "attention" | "blocage";

export interface Avertissement {
  niveau: NiveauAvertissement;
  code: string;
  message: string;
}
