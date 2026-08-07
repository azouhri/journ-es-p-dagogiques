/**
 * Constitution automatique des groupes — spec §7.
 *
 *   1. Chaque élève est classé dans sa tranche d'âge.
 *   2. Une tranche sans élève ne produit aucun groupe.
 *   3. Une tranche qui dépasse la capacité maximale est scindée en
 *      sous-groupes ÉQUILIBRÉS : 27 élèves donnent 14 et 13, pas 20 et 7.
 *   4. Le nombre de groupes détermine l'effectif requis.
 */

import { trancheDeLEleve } from "./age";
import type {
  Avertissement,
  EleveRef,
  GroupeConstitue,
  ModeGroupement,
  TrancheAgeConfig,
} from "./types";

export interface EntreeConstitutionGroupes {
  participants: EleveRef[];
  tranches: TrancheAgeConfig[];
  mode: ModeGroupement;
  dateReference: Date;
  capaciteMaxGroupe: number;
}

export interface ResultatConstitutionGroupes {
  groupes: GroupeConstitue[];
  /** Élèves qui n'entrent dans aucune tranche : à signaler, jamais à ranger d'office. */
  nonClasses: EleveRef[];
  avertissements: Avertissement[];
}

/** Suffixes de sous-groupes : A, B, … Z, AA, AB, … */
function suffixe(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Répartit `total` élèves en `nbGroupes` parts aussi égales que possible.
 * 27 en 2 parts -> [14, 13]. Les parts les plus grandes viennent en premier.
 */
export function taillesEquilibrees(total: number, nbGroupes: number): number[] {
  const base = Math.floor(total / nbGroupes);
  const reste = total % nbGroupes;
  return Array.from({ length: nbGroupes }, (_, i) =>
    i < reste ? base + 1 : base,
  );
}

/**
 * Ordre déterministe des élèves à l'intérieur d'une tranche.
 *
 * Tri par date de naissance puis par nom : quand une tranche est scindée, le
 * sous-groupe A rassemble les plus âgés et le B les plus jeunes, ce qui donne
 * des sous-groupes cohérents plutôt qu'un découpage arbitraire. Le tri se
 * termine par l'identifiant pour garantir un ordre total, donc un résultat
 * reproductible (§8.1, critère de départage n° 4).
 */
function ordonner(eleves: EleveRef[]): EleveRef[] {
  return [...eleves].sort(
    (a, b) =>
      a.dateNaissance.getTime() - b.dateNaissance.getTime() ||
      a.nom.localeCompare(b.nom, "fr") ||
      a.prenom.localeCompare(b.prenom, "fr") ||
      a.id.localeCompare(b.id),
  );
}

export function constituerGroupes(
  entree: EntreeConstitutionGroupes,
): ResultatConstitutionGroupes {
  const { participants, tranches, mode, dateReference, capaciteMaxGroupe } =
    entree;

  if (capaciteMaxGroupe < 1) {
    throw new Error("La capacité maximale d'un groupe doit être d'au moins 1.");
  }

  const avertissements: Avertissement[] = [];
  const nonClasses: EleveRef[] = [];

  // 1. Classement de chaque élève dans sa tranche.
  const parTranche = new Map<string, EleveRef[]>();
  for (const eleve of participants) {
    const tranche = trancheDeLEleve(eleve, tranches, mode, dateReference);
    if (!tranche) {
      nonClasses.push(eleve);
      continue;
    }
    const seau = parTranche.get(tranche.id);
    if (seau) seau.push(eleve);
    else parTranche.set(tranche.id, [eleve]);
  }

  if (nonClasses.length > 0) {
    avertissements.push({
      niveau: "attention",
      code: "ELEVES_NON_CLASSES",
      message:
        mode === "NIVEAU_SCOLAIRE"
          ? `${nonClasses.length} élève(s) sans niveau scolaire renseigné ou hors des tranches définies. Ils ne sont dans aucun groupe.`
          : `${nonClasses.length} élève(s) dont l'âge ne correspond à aucune tranche. Ils ne sont dans aucun groupe.`,
    });
  }

  // 2 et 3. Un groupe par tranche, scindé si nécessaire.
  const groupes: GroupeConstitue[] = [];
  let ordre = 0;

  const tranchesOrdonnees = [...tranches].sort((a, b) => a.ordre - b.ordre);

  for (const tranche of tranchesOrdonnees) {
    const eleves = parTranche.get(tranche.id);
    // 2. Une tranche sans élève ne produit aucun groupe.
    if (!eleves || eleves.length === 0) continue;

    const ordonnes = ordonner(eleves);
    const nbGroupes = Math.ceil(ordonnes.length / capaciteMaxGroupe);
    const tailles = taillesEquilibrees(ordonnes.length, nbGroupes);

    let curseur = 0;
    for (let i = 0; i < nbGroupes; i++) {
      const membres = ordonnes.slice(curseur, curseur + tailles[i]);
      curseur += tailles[i];

      groupes.push({
        id: `${tranche.id}::${i}`,
        trancheAgeId: tranche.id,
        trancheAgeLibelle: tranche.libelle,
        // Le suffixe n'apparaît que si la tranche a effectivement été scindée.
        libelle:
          nbGroupes === 1
            ? tranche.libelle
            : `${tranche.libelle} — ${suffixe(i)}`,
        ordre: ordre++,
        eleves: membres,
      });
    }
  }

  if (groupes.length === 0) {
    avertissements.push({
      niveau: "blocage",
      code: "AUCUN_GROUPE",
      message:
        "Aucun groupe n'a pu être constitué : aucun élève participant ne correspond à une tranche.",
    });
  }

  return { groupes, nonClasses, avertissements };
}
