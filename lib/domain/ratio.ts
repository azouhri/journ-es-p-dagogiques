/**
 * Contrôle du ratio éducateurs / élèves — spec §3, §9.3.
 *
 * « Ratio maximal de 1 éducateur pour 20 élèves PRÉSENTS ; seuls les membres
 * du personnel effectivement présents auprès des élèves comptent. »
 *
 * Le mot important est « présents », des deux côtés. Un ratio calculé sur
 * l'effectif de toute la journée est faux pour un quart qui ne couvre qu'une
 * partie de celle-ci : à l'ouverture de 6 h 45, les élèves arrivent au
 * compte-gouttes et la quasi-totalité du groupe n'est pas encore là.
 */

import type { StatutPresenceEducateur } from "./types";

export type StatutPresenceEleve = "PRESENT" | "ABSENT" | "PARTI_TOT";

export interface PresenceEleveFenetre {
  statut: StatutPresenceEleve;
  /** Minutes depuis minuit ; null si l'heure n'a pas été relevée. */
  arriveeMinutes: number | null;
  departMinutes: number | null;
}

export interface PresenceEducateurFenetre {
  statut: StatutPresenceEducateur;
  remplacantId: string | null;
}

export interface ComptageEleves {
  nombre: number;
  /**
   * Vrai si au moins un élève a été compté faute d'heure d'arrivée relevée.
   * Le nombre est alors une BORNE SUPÉRIEURE, pas une mesure.
   */
  estime: boolean;
}

/**
 * Nombre d'élèves effectivement présents pendant [debut, fin[.
 *
 * Un élève sans heure relevée est compté sur tout le quart : en l'absence
 * d'information, mieux vaut surestimer la charge que masquer un dépassement.
 * Le drapeau `estime` dit que ce choix a été fait, pour que l'appelant sache
 * qu'il manipule une hypothèse et non une mesure.
 */
export function elevesPresentsPendant(
  presences: readonly PresenceEleveFenetre[],
  debutMinutes: number,
  finMinutes: number,
): ComptageEleves {
  let nombre = 0;
  let estime = false;

  for (const p of presences) {
    if (p.statut === "ABSENT") continue;

    // Intervalles semi-ouverts : un élève parti à 12 h 00 n'est plus là
    // pendant l'après-midi qui commence à 12 h 00.
    const { arriveeMinutes: arrivee, departMinutes: depart } = p;

    if (arrivee !== null && arrivee >= finMinutes) continue;
    if (depart !== null && depart <= debutMinutes) continue;

    nombre++;
    if (arrivee === null) estime = true;
  }

  return { nombre, estime };
}

/**
 * Nombre d'éducateurs effectivement auprès des élèves (§3).
 *
 * Un titulaire absent ne compte pas. Un titulaire remplacé ne compte pas non
 * plus, mais son remplaçant si — à condition qu'il ait été désigné : sans
 * remplaçant nommé, la place est restée vide.
 */
export function educateursPresents(
  presences: readonly (PresenceEducateurFenetre | null)[],
): number {
  return presences.filter((p) => {
    // Une affectation sans ligne de présence est réputée tenue : les présences
    // sont pré-remplies à « présent » dès la validation (§9.4).
    if (!p) return true;
    if (p.statut === "PRESENT") return true;
    return p.statut === "REMPLACE" && p.remplacantId !== null;
  }).length;
}

export interface RatioQuart {
  eleves: number;
  educateurs: number;
  /** null si aucun éducateur : la division n'a pas de sens. */
  ratio: number | null;
  depasse: boolean;
  /** Le ratio repose sur une hypothèse d'effectif, pas sur des heures relevées. */
  indetermine: boolean;
}

export interface OptionsRatio {
  /**
   * Quart d'accueil ou de dispersion — portée TOUS_GROUPES (§4.1).
   *
   * §4.3 : l'effectif d'un tel quart « correspond à deux postes physiques
   * distincts […] C'est un besoin de SURVEILLANCE, pas un besoin
   * d'encadrement par groupe. » Il est fixé par la configuration, pas déduit
   * d'un ratio.
   *
   * S'y ajoute que les élèves arrivent au compte-gouttes : sans heures
   * relevées, comparer l'effectif de toute la journée aux deux personnes
   * présentes à 6 h 45 produit une alerte systématique et fausse. On signale
   * donc le quart comme indéterminé plutôt que comme non conforme.
   */
  quartDAccueil?: boolean;
}

export function calculerRatio(
  comptage: ComptageEleves,
  educateurs: number,
  plafond: number,
  options: OptionsRatio = {},
): RatioQuart {
  const { nombre: eleves, estime } = comptage;

  // Un quart d'accueil dont l'effectif n'est qu'une estimation ne peut pas
  // être déclaré non conforme : on ne sait pas combien d'élèves étaient
  // réellement là. Relever les heures d'arrivée lève l'indétermination.
  const indetermine = Boolean(options.quartDAccueil) && estime;

  if (educateurs === 0) {
    return {
      eleves,
      educateurs,
      ratio: null,
      // Aucun éducateur alors que des élèves sont là : c'est un dépassement,
      // et le plus grave qui soit — y compris à l'accueil.
      depasse: eleves > 0,
      indetermine: false,
    };
  }

  const ratio = eleves / educateurs;
  return {
    eleves,
    educateurs,
    ratio,
    depasse: !indetermine && ratio > plafond,
    indetermine,
  };
}
