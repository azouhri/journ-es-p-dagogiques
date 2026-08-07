/**
 * Algorithme de génération du planning — spec §8.
 *
 * L'algorithme ne contient AUCUNE règle métier en dur (§8.2). À chaque
 * exécution il relit : les quarts actifs et leurs propriétés, le mode de
 * groupement, la politique de sur-effectif à l'ouverture, l'autorisation du
 * double poste, le traitement des blocs de plusieurs jours et le critère de
 * départage. Passer de trois à cinq quarts ne demande aucune modification ici.
 *
 * Déroulé (§8.1) :
 *   Passe 1        — faisabilité : places requises, places absorbées par les
 *                    enchaînements, effectif manquant le cas échéant.
 *   Passes 2 à n   — un passage par type de quart, dans l'ordre chronologique.
 */

import { compteurDuQuart, copierCompteurs } from "./equite";
import { duree, seChevauchent } from "./temps";
import type {
  AffectationGeneree,
  Avertissement,
  CompteursEducateur,
  EducateurRef,
  GroupeConstitue,
  ReglagesConfig,
  TypeQuartConfig,
} from "./types";
import { compteursVides } from "./types";

// ---------------------------------------------------------------------------
// Entrées / sorties
// ---------------------------------------------------------------------------

export interface EntreeGeneration {
  quarts: TypeQuartConfig[];
  groupes: GroupeConstitue[];
  educateursDisponibles: EducateurRef[];
  /** Compteurs de l'année en cours. Jamais mutés : une copie est utilisée. */
  compteurs: Map<string, CompteursEducateur>;
  /** §8.1 critère 4 — quarts tenus lors de la journée pédagogique précédente. */
  quartsJourneePrecedente?: Map<string, Set<string>>;
  /** §8.1 — historique éducateur × tranche d'âge, pour la continuité. */
  historiqueTranches?: Map<string, Record<string, number>>;
  /**
   * Tranches d'âge DÉCLARÉES par éducateur (identifiants de TrancheAge).
   * Un éducateur absent de la table, ou dont l'ensemble est vide, est réputé
   * pouvoir encadrer toutes les tranches.
   */
  tranchesParEducateur?: Map<string, Set<string>>;
  reglages: ReglagesConfig;
}

export interface BesoinQuart {
  quartId: string;
  quartCode: string;
  /** Effectif retenu après application de la politique de sur-effectif. */
  effectif: number;
  /** Places pourvues d'office par un enchaînement venu du quart précédent. */
  placesAbsorbees: number;
  /** Places restant à pourvoir par tri sur compteurs. */
  placesAPourvoir: number;
}

export interface DiagnosticFaisabilite {
  faisable: boolean;
  nbGroupes: number;
  nbEducateursDisponibles: number;
  /** Nombre d'éducateurs DISTINCTS nécessaires, enchaînements déduits. */
  nbEducateursRequis: number;
  manquants: number;
  besoins: BesoinQuart[];
}

export interface ResultatGeneration {
  faisable: boolean;
  diagnostic: DiagnosticFaisabilite;
  affectations: AffectationGeneree[];
  /** Compteurs mis à jour, à réinjecter pour le jour suivant d'un bloc. */
  compteursApres: Map<string, CompteursEducateur>;
  avertissements: Avertissement[];
}

// ---------------------------------------------------------------------------
// Passe 1 — faisabilité
// ---------------------------------------------------------------------------

/**
 * Calcule l'effectif de chaque quart actif et les places absorbées par les
 * enchaînements.
 *
 * §4.3 — affecter quelqu'un à un quart qui enchaîne consomme aussi une place
 * du quart suivant. Pour k groupes avec 2 ouvertures, il faut k éducateurs le
 * matin (dont 2 arrivés tôt) et k l'après-midi, soit 2k mobilisés, pas 2k + 2.
 */
export function calculerBesoins(
  quartsActifs: TypeQuartConfig[],
  nbGroupes: number,
  reglages: ReglagesConfig,
): { besoins: BesoinQuart[]; effectifs: Map<string, number> } {
  const parId = new Map(quartsActifs.map((q) => [q.id, q]));

  // Effectif brut : un nombre fixe si TOUS_GROUPES, sinon un par groupe.
  const effectifBrut = (q: TypeQuartConfig): number =>
    q.portee === "TOUS_GROUPES"
      ? q.effectifRequis
      : q.effectifRequis * nbGroupes;

  const effectifs = new Map<string, number>();
  for (const q of quartsActifs) effectifs.set(q.id, effectifBrut(q));

  // §10 — si l'effectif requis à l'ouverture dépasse la capacité du quart sur
  // lequel il enchaîne, trois politiques possibles.
  for (const q of quartsActifs) {
    if (!q.enchaineSurId) continue;
    const suivant = parId.get(q.enchaineSurId);
    if (!suivant) continue;

    const effectifQ = effectifs.get(q.id)!;
    const effectifSuivant = effectifs.get(suivant.id)!;
    if (effectifQ <= effectifSuivant) continue;

    switch (reglages.surEffectifOuverture) {
      case "REDUIRE_AU_NOMBRE_DE_GROUPES":
        // On rabote le quart amont : il ne peut pas mobiliser plus de monde
        // que le quart aval ne peut en accueillir.
        effectifs.set(q.id, effectifSuivant);
        break;
      case "RENFORT_SUR_UN_GROUPE":
        // Le surnuméraire reste en renfort : le quart aval accueille plus de
        // monde que son effectif nominal.
        effectifs.set(suivant.id, effectifQ);
        break;
      case "AVANCE_PUIS_RETOUR":
        // Le surnuméraire ne poursuit pas sur le quart aval ; il est repris
        // par un quart ultérieur. Les effectifs nominaux ne bougent pas.
        break;
    }
  }

  // Places absorbées par les enchaînements.
  const absorbees = new Map<string, number>();
  for (const q of quartsActifs) {
    if (!q.enchaineSurId) continue;
    const suivant = parId.get(q.enchaineSurId);
    if (!suivant) continue;
    const transferables = Math.min(
      effectifs.get(q.id)!,
      effectifs.get(suivant.id)!,
    );
    absorbees.set(
      suivant.id,
      (absorbees.get(suivant.id) ?? 0) + transferables,
    );
  }

  const besoins: BesoinQuart[] = quartsActifs.map((q) => {
    const effectif = effectifs.get(q.id)!;
    const placesAbsorbees = Math.min(absorbees.get(q.id) ?? 0, effectif);
    return {
      quartId: q.id,
      quartCode: q.code,
      effectif,
      placesAbsorbees,
      placesAPourvoir: effectif - placesAbsorbees,
    };
  });

  return { besoins, effectifs };
}

// ---------------------------------------------------------------------------
// Tri des candidats — §8.1
// ---------------------------------------------------------------------------

interface ContexteTri {
  codeQuart: string;
  compteurs: Map<string, CompteursEducateur>;
  quartsJourneePrecedente: Map<string, Set<string>>;
  reglages: ReglagesConfig;
}

function compteursDe(
  compteurs: Map<string, CompteursEducateur>,
  educateurId: string,
): CompteursEducateur {
  let c = compteurs.get(educateurId);
  if (!c) {
    c = compteursVides(educateurId);
    compteurs.set(educateurId, c);
  }
  return c;
}

/**
 * Ordre de priorité pour un quart donné (§8.1) :
 *   1. compteur de CE type de quart, croissant
 *   2. critère de départage prioritaire (réglage §10)
 *   3. l'autre critère de départage
 *   4. n'a pas tenu le même quart lors de la journée pédagogique précédente
 *   5. ordre alphabétique — garantit que deux générations identiques donnent
 *      le même résultat
 */
export function comparerCandidats(
  a: EducateurRef,
  b: EducateurRef,
  ctx: ContexteTri,
): number {
  const ca = compteursDe(ctx.compteurs, a.id);
  const cb = compteursDe(ctx.compteurs, b.id);

  // 1. Compteur du quart.
  const parQuart =
    compteurDuQuart(ca, ctx.codeQuart) - compteurDuQuart(cb, ctx.codeQuart);
  if (parQuart !== 0) return parQuart;

  // 2 et 3. Critères de départage, dans l'ordre choisi par le réglage.
  const heures = ca.minutesCumulees - cb.minutesCumulees;
  const journees = ca.nbJourneesTravaillees - cb.nbJourneesTravaillees;
  if (ctx.reglages.critereDepartage === "HEURES_CUMULEES") {
    if (heures !== 0) return heures;
    if (journees !== 0) return journees;
  } else {
    if (journees !== 0) return journees;
    if (heures !== 0) return heures;
  }

  // 4. Éviter le même quart deux journées pédagogiques de suite.
  if (ctx.reglages.eviterMemeQuartConsecutif) {
    const aRepete = ctx.quartsJourneePrecedente.get(a.id)?.has(ctx.codeQuart)
      ? 1
      : 0;
    const bRepete = ctx.quartsJourneePrecedente.get(b.id)?.has(ctx.codeQuart)
      ? 1
      : 0;
    if (aRepete !== bRepete) return aRepete - bRepete;
  }

  // 5. Ordre alphabétique, puis identifiant : ordre total, donc déterminisme.
  return (
    a.nom.localeCompare(b.nom, "fr") ||
    a.prenom.localeCompare(b.prenom, "fr") ||
    a.id.localeCompare(b.id)
  );
}

// ---------------------------------------------------------------------------
// Génération d'un jour
// ---------------------------------------------------------------------------

export function genererJour(entree: EntreeGeneration): ResultatGeneration {
  const { reglages, groupes } = entree;
  const avertissements: Avertissement[] = [];

  // L'algorithme lit TOUJOURS les quarts actifs depuis la configuration (§4.6).
  const quartsActifs = entree.quarts
    .filter((q) => q.actif)
    .sort((a, b) => a.ordre - b.ordre || a.debutMinutes - b.debutMinutes);

  const nbGroupes = groupes.length;
  const compteurs = copierCompteurs(entree.compteurs);
  const quartsJourneePrecedente =
    entree.quartsJourneePrecedente ?? new Map<string, Set<string>>();

  const groupesOrdonnes = [...groupes].sort((a, b) => a.ordre - b.ordre);

  // --- Passe 1 : faisabilité ------------------------------------------------
  const { besoins } = calculerBesoins(quartsActifs, nbGroupes, reglages);
  const nbEducateursRequis = besoins.reduce(
    (total, b) => total + b.placesAPourvoir,
    0,
  );
  const nbEducateursDisponibles = entree.educateursDisponibles.length;
  const manquants = Math.max(0, nbEducateursRequis - nbEducateursDisponibles);

  const diagnostic: DiagnosticFaisabilite = {
    faisable: manquants === 0 && nbGroupes > 0,
    nbGroupes,
    nbEducateursDisponibles,
    nbEducateursRequis,
    manquants,
    besoins,
  };

  if (nbGroupes === 0) {
    avertissements.push({
      niveau: "blocage",
      code: "AUCUN_GROUPE",
      message: "Aucun groupe n'a été constitué : rien à planifier.",
    });
    return {
      faisable: false,
      diagnostic,
      affectations: [],
      compteursApres: compteurs,
      avertissements,
    };
  }

  if (manquants > 0) {
    // §7.4 — le système l'annonce AVANT de générer, en indiquant combien il
    // en manque.
    avertissements.push({
      niveau: "blocage",
      code: "EFFECTIF_INSUFFISANT",
      message:
        `Effectif insuffisant : ${nbGroupes} groupe(s) demandent ` +
        `${nbEducateursRequis} éducateurs, ${nbEducateursDisponibles} sont ` +
        `disponibles. Il en manque ${manquants}.`,
    });
    return {
      faisable: false,
      diagnostic,
      affectations: [],
      compteursApres: compteurs,
      avertissements,
    };
  }

  // --- Passes 2 à n : un passage par type de quart --------------------------
  const affectations: AffectationGeneree[] = [];
  const quartsParId = new Map(quartsActifs.map((q) => [q.id, q]));
  /** Réservations créées par les enchaînements : quartId -> éducateurs. */
  const reservations = new Map<string, EducateurRef[]>();
  /** Quarts déjà tenus aujourd'hui par chaque éducateur. */
  const quartsDuJour = new Map<string, TypeQuartConfig[]>();
  /** Éducateurs déjà comptés pour la journée (nbJourneesTravaillees). */
  const creditesAujourdhui = new Set<string>();
  /** §10 AVANCE_PUIS_RETOUR — éducateurs venus en avance, à reprendre plus tard. */
  const retoursAttendus = new Set<string>();

  const besoinsParId = new Map(besoins.map((b) => [b.quartId, b]));

  for (const quart of quartsActifs) {
    const besoin = besoinsParId.get(quart.id)!;
    const reserves = reservations.get(quart.id) ?? [];
    const aPourvoir = Math.max(0, besoin.effectif - reserves.length);

    const ctx: ContexteTri = {
      codeQuart: quart.code,
      compteurs,
      quartsJourneePrecedente,
      reglages,
    };

    const dejaReserve = new Set(reserves.map((e) => e.id));

    // Écarter les éducateurs déjà affectés à un quart qui chevauche celui-ci.
    const libres = entree.educateursDisponibles.filter((e) => {
      if (dejaReserve.has(e.id)) return false;
      const tenus = quartsDuJour.get(e.id) ?? [];
      return !tenus.some((t) => seChevauchent(t, quart));
    });

    // Un second quart non atteint par enchaînement est un DOUBLE POSTE.
    // Interprétation retenue : c'est bien ce que le réglage §10 gouverne.
    // Sans cette lecture, l'arithmétique de §4.3 (2k éducateurs mobilisés,
    // k le matin et k l'après-midi) ne tiendrait pas.
    const sansDoublePoste = libres.filter(
      (e) => (quartsDuJour.get(e.id) ?? []).length === 0,
    );
    const enDoublePoste = libres.filter(
      (e) => (quartsDuJour.get(e.id) ?? []).length > 0,
    );

    let pool: EducateurRef[];
    switch (reglages.doublePoste) {
      case "TOUJOURS":
        pool = libres;
        break;
      case "JAMAIS":
        pool = sansDoublePoste;
        break;
      case "SI_EFFECTIF_INSUFFISANT":
        // Le double poste ne sert que de rattrapage : on ne pioche dedans que
        // si les éducateurs encore libres ne suffisent pas.
        pool =
          sansDoublePoste.length >= aPourvoir
            ? sansDoublePoste
            : [...sansDoublePoste, ...enDoublePoste];
        break;
    }

    // Sous IMPOSER, un éducateur habilité pour aucune des tranches du jour ne
    // pourra être placé sur aucun groupe : l'écarter d'un quart PAR_GROUPE
    // évite de gaspiller une place au profit de quelqu'un d'inutilisable.
    if (
      reglages.politiqueTrancheEducateur === "IMPOSER" &&
      quart.portee === "PAR_GROUPE"
    ) {
      const utilisables = pool.filter((e) =>
        groupesOrdonnes.some((g) =>
          peutEncadrer(e.id, g.trancheAgeId, entree.tranchesParEducateur),
        ),
      );
      if (utilisables.length >= aPourvoir) pool = utilisables;
    }

    const tries = [...pool].sort((a, b) => comparerCandidats(a, b, ctx));

    // §10 AVANCE_PUIS_RETOUR — reprendre en priorité ceux venus en avance.
    if (retoursAttendus.size > 0) {
      tries.sort((a, b) => {
        const ra = retoursAttendus.has(a.id) ? 0 : 1;
        const rb = retoursAttendus.has(b.id) ? 0 : 1;
        return ra - rb;
      });
    }

    const choisis = tries.slice(0, aPourvoir);

    if (choisis.length < aPourvoir) {
      avertissements.push({
        niveau: "attention",
        code: "QUART_INCOMPLET",
        message:
          `${quart.libelle} : ${choisis.length + reserves.length} éducateur(s) ` +
          `affecté(s) sur ${besoin.effectif} requis.`,
      });
    }

    // Valeur minimale du compteur dans l'équipe, pour la justification (§8.4).
    const minCompteur = tries.length
      ? compteurDuQuart(compteursDe(compteurs, tries[0].id), quart.code)
      : 0;

    const equipe = [...reserves, ...choisis];

    // --- Attribution aux groupes -------------------------------------------
    const { attributions: cibles, groupesNonPourvus } = attribuerGroupes(
      equipe,
      quart,
      groupesOrdonnes,
      entree.historiqueTranches,
      entree.tranchesParEducateur,
      reglages,
      (a, b) => comparerCandidats(a, b, ctx),
    );

    if (groupesNonPourvus.length > 0) {
      avertissements.push({
        niveau: "blocage",
        code: "TRANCHE_SANS_EDUCATEUR",
        message:
          `${quart.libelle} : aucun éducateur habilité n'est disponible pour ` +
          `${groupesNonPourvus.map((g) => g.libelle).join(", ")}. ` +
          `Déclarer cette tranche pour un éducateur disponible, ou assouplir ` +
          `la règle des tranches d'âge dans les paramètres.`,
      });
    }

    for (const { educateur, groupeId } of cibles) {
      const parEnchainement = dejaReserve.has(educateur.id);
      const compteurAvant = compteurDuQuart(
        compteursDe(compteurs, educateur.id),
        quart.code,
      );

      affectations.push({
        educateurId: educateur.id,
        typeQuartId: quart.id,
        // §4.6 — copie figée du quart au moment de la création.
        quartCode: quart.code,
        quartLibelle: quart.libelle,
        quartDebutMinutes: quart.debutMinutes,
        quartFinMinutes: quart.finMinutes,
        groupeId,
        justification: parEnchainement
          ? `${quart.libelle} : enchaînement automatique depuis le quart précédent.`
          : construireJustification(quart, compteurAvant, minCompteur),
        issueEnchainement: parEnchainement,
      });

      // Mise à jour immédiate des compteurs : c'est ce qui fait qu'un
      // éducateur affecté le matin n'est pas prioritaire l'après-midi.
      const c = compteursDe(compteurs, educateur.id);
      c.parQuart[quart.code] = (c.parQuart[quart.code] ?? 0) + 1;
      c.minutesCumulees += duree(quart);
      if (!creditesAujourdhui.has(educateur.id)) {
        creditesAujourdhui.add(educateur.id);
        c.nbJourneesTravaillees += 1;
      }

      const tenus = quartsDuJour.get(educateur.id) ?? [];
      tenus.push(quart);
      quartsDuJour.set(educateur.id, tenus);

      retoursAttendus.delete(educateur.id);
    }

    // --- Réserver les places du quart suivant en cas d'enchaînement (§4.3) ---
    if (quart.enchaineSurId && quartsParId.has(quart.enchaineSurId)) {
      const suivantId = quart.enchaineSurId;
      const besoinSuivant = besoinsParId.get(suivantId)!;
      const transferables = equipe.slice(0, besoinSuivant.effectif);
      const surplus = equipe.slice(besoinSuivant.effectif);

      reservations.set(suivantId, [
        ...(reservations.get(suivantId) ?? []),
        ...transferables,
      ]);

      // Le surnuméraire ne poursuit pas : il devra être repris plus tard.
      if (
        surplus.length > 0 &&
        reglages.surEffectifOuverture === "AVANCE_PUIS_RETOUR"
      ) {
        for (const e of surplus) retoursAttendus.add(e.id);
      }
    }
  }

  if (retoursAttendus.size > 0) {
    avertissements.push({
      niveau: "attention",
      code: "RETOUR_NON_POURVU",
      message:
        `${retoursAttendus.size} éducateur(s) venu(s) en avance n'ont pas pu ` +
        `être repris sur un quart ultérieur.`,
    });
  }

  // Un groupe qu'aucun éducateur habilité ne peut prendre est bloquant : le
  // planning produit serait incomplet, mieux vaut le dire que le livrer.
  const bloque = avertissements.some((a) => a.niveau === "blocage");

  return {
    faisable: !bloque,
    diagnostic: { ...diagnostic, faisable: !bloque },
    affectations,
    compteursApres: compteurs,
    avertissements,
  };
}

function construireJustification(
  quart: TypeQuartConfig,
  compteurAvant: number,
  minCompteur: number,
): string {
  const unite = quart.libelle.toLowerCase();
  const base = `${quart.libelle} : ${compteurAvant} ${unite}${compteurAvant > 1 ? "s" : ""} au compteur`;
  return compteurAvant <= minCompteur
    ? `${base}, le plus bas de l'équipe.`
    : `${base} (minimum de l'équipe : ${minCompteur}).`;
}

/**
 * Un éducateur peut-il encadrer cette tranche d'âge ?
 *
 * Sans déclaration, il le peut : c'est le défaut, et il évite qu'activer la
 * politique fige toute génération tant que rien n'a été saisi.
 */
export function peutEncadrer(
  educateurId: string,
  trancheAgeId: string,
  tranches: Map<string, Set<string>> | undefined,
): boolean {
  const declarees = tranches?.get(educateurId);
  if (!declarees || declarees.size === 0) return true;
  return declarees.has(trancheAgeId);
}

/**
 * Appariement places × éducateurs sous contrainte d'éligibilité.
 *
 * Une attribution gloutonne ne suffit pas : elle peut placer sur un groupe
 * quelconque le seul éducateur habilité pour une autre tranche, et déclarer à
 * tort qu'aucune répartition n'existe. On utilise donc la recherche de
 * chemins augmentants (algorithme de Kuhn), qui trouve un couplage maximal.
 *
 * Les candidats sont parcourus dans l'ordre d'équité : à couplage égal, ce
 * sont les compteurs les plus bas qui sont retenus.
 */
function apparier(
  places: GroupeConstitue[],
  equipe: EducateurRef[],
  estEligible: (educateurId: string, trancheAgeId: string) => boolean,
): Map<number, EducateurRef> {
  const placeParEducateur = new Map<string, number>();
  const educateurParPlace = new Map<number, EducateurRef>();

  function chercher(indexPlace: number, visites: Set<string>): boolean {
    for (const educateur of equipe) {
      if (visites.has(educateur.id)) continue;
      if (!estEligible(educateur.id, places[indexPlace].trancheAgeId)) continue;

      visites.add(educateur.id);
      const occupee = placeParEducateur.get(educateur.id);

      // Soit l'éducateur est libre, soit on relance sa place actuelle vers un
      // autre candidat : c'est le chemin augmentant.
      if (occupee === undefined || chercher(occupee, visites)) {
        placeParEducateur.set(educateur.id, indexPlace);
        educateurParPlace.set(indexPlace, educateur);
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < places.length; i++) {
    chercher(i, new Set());
  }

  return educateurParPlace;
}

/**
 * Attribution des éducateurs aux groupes (§8.1).
 *
 * Un quart de portée TOUS_GROUPES ne cible aucun groupe : c'est une équipe
 * commune. Un quart PAR_GROUPE distribue son équipe sur les groupes, avec
 * autant de places par groupe que l'effectif requis, plus les éventuels
 * renforts répartis à tour de rôle.
 */
function attribuerGroupes(
  equipe: EducateurRef[],
  quart: TypeQuartConfig,
  groupes: GroupeConstitue[],
  historiqueTranches: Map<string, Record<string, number>> | undefined,
  tranchesParEducateur: Map<string, Set<string>> | undefined,
  reglages: ReglagesConfig,
  comparer: (a: EducateurRef, b: EducateurRef) => number,
): {
  attributions: Array<{ educateur: EducateurRef; groupeId: string | null }>;
  groupesNonPourvus: GroupeConstitue[];
} {
  if (quart.portee === "TOUS_GROUPES") {
    return {
      attributions: equipe.map((educateur) => ({ educateur, groupeId: null })),
      groupesNonPourvus: [],
    };
  }

  // Une place par groupe et par unité d'effectif requis…
  const places: GroupeConstitue[] = [];
  for (let i = 0; i < quart.effectifRequis; i++) {
    for (const g of groupes) places.push(g);
  }
  // …puis les renforts éventuels, répartis à tour de rôle.
  let i = 0;
  while (places.length < equipe.length && groupes.length > 0) {
    places.push(groupes[i % groupes.length]);
    i++;
  }

  const ordonnee = [...equipe].sort(comparer);
  const politique = reglages.politiqueTrancheEducateur;

  // LIBRE : aucune contrainte, on garde l'attribution simple d'origine.
  if (politique === "LIBRE") {
    return {
      attributions: attribuerSansContrainte(
        places,
        ordonnee,
        historiqueTranches,
        reglages,
      ),
      groupesNonPourvus: [],
    };
  }

  const eligible = (educateurId: string, trancheAgeId: string) =>
    peutEncadrer(educateurId, trancheAgeId, tranchesParEducateur);

  const couplage = apparier(places, ordonnee, eligible);

  const attributions: Array<{
    educateur: EducateurRef;
    groupeId: string | null;
  }> = [];
  const utilises = new Set<string>();

  for (const [indexPlace, educateur] of couplage) {
    attributions.push({ educateur, groupeId: places[indexPlace].id });
    utilises.add(educateur.id);
  }

  const placesRestantes = places.filter((_, idx) => !couplage.has(idx));

  if (politique === "IMPOSER") {
    // Les places qu'aucun éducateur habilité ne peut prendre restent vides ;
    // l'appelant en fait un avertissement plutôt qu'un placement illégitime.
    return {
      attributions,
      groupesNonPourvus: dedupliquer(placesRestantes),
    };
  }

  // PREFERER — on comble les places restantes sans tenir compte des tranches
  // déclarées : mieux vaut un éducateur hors de sa tranche qu'un groupe seul.
  const disponibles = ordonnee.filter((e) => !utilises.has(e.id));
  for (const place of placesRestantes) {
    const educateur = disponibles.shift();
    if (!educateur) break;
    attributions.push({ educateur, groupeId: place.id });
  }

  return { attributions, groupesNonPourvus: [] };
}

function dedupliquer(groupes: GroupeConstitue[]): GroupeConstitue[] {
  const vus = new Map<string, GroupeConstitue>();
  for (const g of groupes) vus.set(g.id, g);
  return [...vus.values()];
}

/** Attribution historique, sans contrainte de tranche déclarée. */
function attribuerSansContrainte(
  places: GroupeConstitue[],
  ordonnee: EducateurRef[],
  historiqueTranches: Map<string, Record<string, number>> | undefined,
  reglages: ReglagesConfig,
): Array<{ educateur: EducateurRef; groupeId: string | null }> {
  const restants = [...ordonnee];
  const resultat: Array<{ educateur: EducateurRef; groupeId: string | null }> =
    [];

  for (const place of places) {
    if (restants.length === 0) break;

    let index = 0;
    if (reglages.continuiteTrancheAge && historiqueTranches) {
      // On privilégie la tranche d'âge où l'éducateur a le plus d'historique.
      let meilleur = -1;
      for (let k = 0; k < restants.length; k++) {
        const score =
          historiqueTranches.get(restants[k].id)?.[place.trancheAgeId] ?? 0;
        if (score > meilleur) {
          meilleur = score;
          index = k;
        }
      }
    }

    const [educateur] = restants.splice(index, 1);
    resultat.push({ educateur, groupeId: place.id });
  }

  return resultat;
}

// ---------------------------------------------------------------------------
// Blocs de plusieurs jours — §4.4, §10
// ---------------------------------------------------------------------------

export interface EntreeJour {
  jourPlanifieId: string;
  groupes: GroupeConstitue[];
  educateursDisponibles: EducateurRef[];
}

export interface ResultatJour extends ResultatGeneration {
  jourPlanifieId: string;
}

/**
 * Planifie un bloc de jours consécutifs.
 *
 * CHAQUE_JOUR_SEPAREMENT : chaque jour est généré à son tour, les compteurs du
 * jour précédent étant réinjectés — la rotation se poursuit d'un jour au
 * suivant (§4.4).
 *
 * MEME_EQUIPE_SUR_LE_BLOC : le premier jour est généré normalement, puis la
 * même répartition est reconduite à l'identique sur les jours suivants.
 */
export function genererBloc(
  jours: EntreeJour[],
  commun: Omit<
    EntreeGeneration,
    "groupes" | "educateursDisponibles"
  >,
): ResultatJour[] {
  const resultats: ResultatJour[] = [];
  let compteurs = commun.compteurs;

  for (const [index, jour] of jours.entries()) {
    if (
      index > 0 &&
      commun.reglages.politiqueBloc === "MEME_EQUIPE_SUR_LE_BLOC"
    ) {
      const premier = resultats[0];
      // Les groupes changent d'identifiant d'un jour à l'autre : on reporte
      // l'affectation sur le groupe de même rang.
      const rangParGroupeId = new Map(
        jours[0].groupes
          .slice()
          .sort((a, b) => a.ordre - b.ordre)
          .map((g, rang) => [g.id, rang]),
      );
      const groupesDuJour = [...jour.groupes].sort((a, b) => a.ordre - b.ordre);

      const affectations = premier.affectations.map((a) => ({
        ...a,
        groupeId:
          a.groupeId === null
            ? null
            : (groupesDuJour[rangParGroupeId.get(a.groupeId) ?? 0]?.id ?? null),
        justification: `${a.justification} Équipe reconduite sur l'ensemble du bloc.`,
      }));

      resultats.push({
        jourPlanifieId: jour.jourPlanifieId,
        faisable: premier.faisable,
        diagnostic: premier.diagnostic,
        affectations,
        compteursApres: compteurs,
        avertissements: [],
      });
      continue;
    }

    const resultat = genererJour({
      ...commun,
      compteurs,
      groupes: jour.groupes,
      educateursDisponibles: jour.educateursDisponibles,
    });

    compteurs = resultat.compteursApres;
    resultats.push({ ...resultat, jourPlanifieId: jour.jourPlanifieId });
  }

  return resultats;
}
