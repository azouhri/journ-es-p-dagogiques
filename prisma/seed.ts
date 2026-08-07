/**
 * Jeu de données de test — spec §12.
 *
 * Objectif : disposer immédiatement d'un historique réaliste pour vérifier que
 * l'équité tient sur la durée.
 *
 *   • 300 élèves sur toutes les tranches, avec des cas limites en bordure
 *   • 15 éducateurs, dont deux entrés en cours d'année et un désactivé
 *   • 2024-2025 : 8 journées pédagogiques complètes, planifiées et pointées
 *   • 2025-2026 : 10 journées dans le même état
 *   • 2026-2027 : créée et configurée, sans journée
 *   • Présences avec absences et remplacements, pour que le prévu et le
 *     réalisé diffèrent effectivement
 *   • Un changement de configuration en cours d'historique, pour vérifier que
 *     les journées antérieures restent intactes (§4.6)
 *
 * Le seed est DÉTERMINISTE : graine fixe, aucun Math.random(), aucune date
 * « maintenant ». Seuls les identifiants (cuid) diffèrent d'une exécution à
 * l'autre — les données, elles, sont identiques.
 */

// Le CLI Prisma lit .env tout seul ; tsx, non. Sans cette ligne, le seed
// lancé en direct ne verrait pas DATABASE_URL.
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { Alea } from "../lib/alea";
import { resoudreDateReference } from "../lib/domain/age";
import { calculerCompteurs, type AffectationRealisee } from "../lib/domain/equite";
import { constituerGroupes } from "../lib/domain/groupes";
import { genererJour } from "../lib/domain/generation";
import { versMinutes } from "../lib/domain/temps";
import type {
  CompteursEducateur,
  EducateurRef,
  EleveRef,
  GroupeConstitue,
  ReglagesConfig,
  TrancheAgeConfig,
  TypeQuartConfig,
} from "../lib/domain/types";
import { EDUCATEURS, NOMS_FAMILLE, PRENOMS } from "./noms";

const prisma = new PrismaClient();
const alea = new Alea(20260806);

const jour = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));

// ---------------------------------------------------------------------------
// Configuration des années scolaires
// ---------------------------------------------------------------------------

interface DefinitionAnnee {
  libelle: string;
  dateDebut: Date;
  dateFin: Date;
  statut: "PREPARATION" | "ACTIVE" | "ARCHIVEE";
  journees: Array<{ nom: string; dates: Date[] }>;
}

const ANNEES: DefinitionAnnee[] = [
  {
    libelle: "2024-2025",
    dateDebut: jour(2024, 8, 26),
    dateFin: jour(2025, 6, 20),
    statut: "ARCHIVEE",
    journees: [
      { nom: "Journée pédagogique d'octobre", dates: [jour(2024, 10, 11)] },
      { nom: "Journée pédagogique de novembre", dates: [jour(2024, 11, 15)] },
      { nom: "Journée pédagogique de décembre", dates: [jour(2024, 12, 2)] },
      { nom: "Journée pédagogique de janvier", dates: [jour(2025, 1, 24)] },
      { nom: "Semaine de relâche", dates: [jour(2025, 3, 3), jour(2025, 3, 4)] },
      { nom: "Journée pédagogique d'avril", dates: [jour(2025, 4, 25)] },
      { nom: "Journée pédagogique de mai", dates: [jour(2025, 5, 16)] },
      { nom: "Journée pédagogique de juin", dates: [jour(2025, 6, 6)] },
    ],
  },
  {
    libelle: "2025-2026",
    dateDebut: jour(2025, 8, 25),
    dateFin: jour(2026, 6, 19),
    statut: "ACTIVE",
    journees: [
      { nom: "Journée pédagogique de septembre", dates: [jour(2025, 9, 26)] },
      { nom: "Journée pédagogique d'octobre", dates: [jour(2025, 10, 17)] },
      { nom: "Journée pédagogique de novembre", dates: [jour(2025, 11, 14)] },
      { nom: "Journée pédagogique de décembre", dates: [jour(2025, 12, 1)] },
      { nom: "Journée pédagogique de janvier", dates: [jour(2026, 1, 23)] },
      { nom: "Semaine de relâche", dates: [jour(2026, 3, 2), jour(2026, 3, 3)] },
      { nom: "Journée pédagogique de mars", dates: [jour(2026, 3, 20)] },
      { nom: "Journée pédagogique d'avril", dates: [jour(2026, 4, 24)] },
      { nom: "Journée pédagogique de mai", dates: [jour(2026, 5, 15)] },
      { nom: "Journée pédagogique de juin", dates: [jour(2026, 6, 5)] },
    ],
  },
  {
    libelle: "2026-2027",
    dateDebut: jour(2026, 8, 31),
    dateFin: jour(2027, 6, 25),
    statut: "PREPARATION",
    journees: [], // prête pour la rentrée de septembre 2026
  },
];

/** §4.2 — cinq quarts, trois actifs en Version 1. */
const QUARTS = [
  {
    code: "OUVERTURE",
    libelle: "Ouverture",
    debut: "06:45",
    fin: "09:00",
    portee: "TOUS_GROUPES" as const,
    effectifRequis: 2,
    enchaineSur: "MATINEE",
    actif: true,
    ordre: 1,
  },
  {
    code: "MATINEE",
    libelle: "Matinée",
    debut: "09:00",
    fin: "12:00",
    portee: "PAR_GROUPE" as const,
    effectifRequis: 1,
    enchaineSur: null,
    actif: true,
    ordre: 2,
  },
  {
    code: "APRES_MIDI",
    libelle: "Après-midi",
    debut: "12:00",
    fin: "17:30",
    portee: "PAR_GROUPE" as const,
    effectifRequis: 1,
    enchaineSur: null,
    actif: true,
    ordre: 3,
  },
  {
    code: "SOIREE",
    libelle: "Soirée",
    debut: "17:30",
    fin: "18:30",
    portee: "PAR_GROUPE" as const,
    effectifRequis: 1,
    enchaineSur: null,
    actif: false,
    ordre: 4,
  },
  {
    code: "FERMETURE",
    libelle: "Fermeture",
    debut: "18:30",
    fin: "19:00",
    portee: "TOUS_GROUPES" as const,
    effectifRequis: 2,
    enchaineSur: null,
    actif: false,
    ordre: 5,
  },
];

const TRANCHES = [
  { libelle: "4-5 ans", ageMin: 4, ageMax: 5, niveauMin: 0, niveauMax: 1, ordre: 0 },
  { libelle: "6-7 ans", ageMin: 6, ageMax: 7, niveauMin: 2, niveauMax: 3, ordre: 1 },
  { libelle: "8-9 ans", ageMin: 8, ageMax: 9, niveauMin: 4, niveauMax: 5, ordre: 2 },
  { libelle: "10-12 ans", ageMin: 10, ageMax: 12, niveauMin: 6, niveauMax: 6, ordre: 3 },
];

// ---------------------------------------------------------------------------
// Nettoyage
// ---------------------------------------------------------------------------

async function vider() {
  // Ordre imposé par les clés étrangères.
  await prisma.evaluationAffectation.deleteMany();
  await prisma.presenceEducateur.deleteMany();
  await prisma.presenceEleve.deleteMany();
  await prisma.affectation.deleteMany();
  await prisma.groupeEleve.deleteMany();
  await prisma.groupe.deleteMany();
  await prisma.disponibilite.deleteMany();
  await prisma.participation.deleteMany();
  await prisma.jourPlanifie.deleteMany();
  await prisma.journeePedagogique.deleteMany();
  await prisma.versionConfiguration.deleteMany();
  await prisma.reglages.deleteMany();
  await prisma.typeQuart.deleteMany();
  await prisma.trancheAge.deleteMany();
  await prisma.anneeScolaire.deleteMany();
  await prisma.eleveTuteur.deleteMany();
  await prisma.tuteur.deleteMany();
  await prisma.eleve.deleteMany();
  await prisma.educateur.deleteMany();
  await prisma.journalModification.deleteMany();
}

// ---------------------------------------------------------------------------
// Élèves et éducateurs
// ---------------------------------------------------------------------------

/** Date de référence de l'année 2025-2026, pivot du calcul des âges. */
const REFERENCE_PIVOT = jour(2025, 9, 30);

async function creerEleves() {
  const vus = new Set<string>();
  const donnees: Array<{
    nom: string;
    prenom: string;
    dateNaissance: Date;
    niveauScolaire: number | null;
    notes: string | null;
    actif: boolean;
    dateInscription: Date;
  }> = [];

  // Quelques cas limites volontaires, en bordure exacte de tranche : ils
  // permettent de vérifier que le classement par âge ne dérape pas d'un jour.
  const casLimites: Array<{ age: number; decalageJours: number; note: string }> = [
    { age: 5, decalageJours: 0, note: "Anniversaire pile à la date de référence" },
    { age: 5, decalageJours: 1, note: "Anniversaire au lendemain de la date de référence" },
    { age: 6, decalageJours: 0, note: "Bordure basse de la tranche 6-7 ans" },
    { age: 7, decalageJours: 1, note: "Bordure haute de la tranche 6-7 ans" },
    { age: 8, decalageJours: 0, note: "Bordure basse de la tranche 8-9 ans" },
    { age: 9, decalageJours: 1, note: "Bordure haute de la tranche 8-9 ans" },
    { age: 10, decalageJours: 0, note: "Bordure basse de la tranche 10-12 ans" },
    { age: 12, decalageJours: 1, note: "Bordure haute de la tranche 10-12 ans" },
  ];

  for (const cas of casLimites) {
    const d = new Date(REFERENCE_PIVOT);
    d.setUTCFullYear(d.getUTCFullYear() - cas.age);
    d.setUTCDate(d.getUTCDate() + cas.decalageJours);
    donnees.push({
      nom: alea.parmi(NOMS_FAMILLE),
      prenom: alea.parmi(PRENOMS),
      dateNaissance: d,
      niveauScolaire: Math.max(0, Math.min(6, cas.age - 5)),
      notes: cas.note,
      actif: true,
      dateInscription: jour(2025, 8, 25),
    });
  }

  while (donnees.length < 300) {
    // Âge au 30 septembre 2025, réparti sur toutes les tranches.
    const age = alea.entier(4, 12);
    const d = new Date(REFERENCE_PIVOT);
    d.setUTCFullYear(d.getUTCFullYear() - age);
    // Anniversaire dispersé dans l'année, toujours avant la date de référence.
    d.setUTCDate(d.getUTCDate() - alea.entier(0, 360));

    const nom = alea.parmi(NOMS_FAMILLE);
    const prenom = alea.parmi(PRENOMS);
    const cle = `${nom}|${prenom}|${d.toISOString()}`;
    // La contrainte d'unicité (nom, prénom, date de naissance) sert aussi à la
    // détection de doublons à l'import CSV (§5.1) : on ne la viole pas ici.
    if (vus.has(cle)) continue;
    vus.add(cle);

    donnees.push({
      nom,
      prenom,
      dateNaissance: d,
      // §5.1 — le niveau scolaire est facultatif.
      niveauScolaire: alea.chance(0.85)
        ? Math.max(0, Math.min(6, age - 5))
        : null,
      notes: alea.chance(0.08) ? "Fréquente le service de garde en soirée" : null,
      actif: alea.chance(0.96),
      dateInscription: alea.chance(0.5) ? jour(2024, 8, 26) : jour(2025, 8, 25),
    });
  }

  await prisma.eleve.createMany({ data: donnees });
  return prisma.eleve.findMany({ orderBy: [{ nom: "asc" }, { prenom: "asc" }] });
}

/** Deux éducateurs entrés en cours d'année, un désactivé (§12). */
const EMBAUCHE_TARDIVE = new Set([10, 11]);
const INDEX_DESACTIVE = 14;
const DATE_EMBAUCHE_TARDIVE = jour(2026, 1, 5);
const DATE_DEPART_DESACTIVE = jour(2025, 6, 30);

async function creerEducateurs() {
  const donnees = EDUCATEURS.map((e, i) => ({
    nom: e.nom,
    prenom: e.prenom,
    courriel: `${e.prenom.toLowerCase().replace(/[^a-z]/g, "")}.${e.nom.toLowerCase()}@ecole.example.qc.ca`,
    statutEmploi: alea.chance(0.7)
      ? ("TEMPS_PLEIN" as const)
      : ("TEMPS_PARTIEL" as const),
    dateEmbauche: EMBAUCHE_TARDIVE.has(i)
      ? DATE_EMBAUCHE_TARDIVE
      : jour(2019 + alea.entier(0, 5), alea.entier(1, 12), alea.entier(1, 28)),
    // §5.2 — désactiver un éducateur ne supprime ni ses affectations passées
    // ni ses compteurs.
    actif: i !== INDEX_DESACTIVE,
  }));

  await prisma.educateur.createMany({ data: donnees });
  return prisma.educateur.findMany({ orderBy: [{ nom: "asc" }, { prenom: "asc" }] });
}

/** Un éducateur est-il en poste à cette date ? */
function enPoste(
  educateur: { dateEmbauche: Date | null; actif: boolean },
  date: Date,
): boolean {
  if (educateur.dateEmbauche && date < educateur.dateEmbauche) return false;
  if (!educateur.actif && date > DATE_DEPART_DESACTIVE) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("Nettoyage…");
  await vider();

  console.log("Élèves et éducateurs…");
  const eleves = await creerEleves();
  const educateurs = await creerEducateurs();
  console.log(`  ${eleves.length} élèves, ${educateurs.length} éducateurs`);

  for (const definition of ANNEES) {
    console.log(`\nAnnée ${definition.libelle}…`);
    await creerAnnee(definition, eleves, educateurs);
  }

  console.log("\nTerminé.");
}

type EleveDb = Awaited<ReturnType<typeof creerEleves>>[number];
type EducateurDb = Awaited<ReturnType<typeof creerEducateurs>>[number];

async function creerAnnee(
  definition: DefinitionAnnee,
  eleves: EleveDb[],
  educateurs: EducateurDb[],
) {
  const annee = await prisma.anneeScolaire.create({
    data: {
      libelle: definition.libelle,
      dateDebut: definition.dateDebut,
      dateFin: definition.dateFin,
      statut: definition.statut,
    },
  });

  // --- Tranches d'âge ------------------------------------------------------
  await prisma.trancheAge.createMany({
    data: TRANCHES.map((t) => ({ ...t, anneeScolaireId: annee.id })),
  });
  const tranchesDb = await prisma.trancheAge.findMany({
    where: { anneeScolaireId: annee.id },
    orderBy: { ordre: "asc" },
  });
  const tranches: TrancheAgeConfig[] = tranchesDb.map((t) => ({
    id: t.id,
    libelle: t.libelle,
    ageMin: t.ageMin,
    ageMax: t.ageMax,
    niveauMin: t.niveauMin,
    niveauMax: t.niveauMax,
    ordre: t.ordre,
  }));

  // --- Types de quart ------------------------------------------------------
  await prisma.typeQuart.createMany({
    data: QUARTS.map((q) => ({
      anneeScolaireId: annee.id,
      code: q.code,
      libelle: q.libelle,
      debutMinutes: versMinutes(q.debut),
      finMinutes: versMinutes(q.fin),
      portee: q.portee,
      effectifRequis: q.effectifRequis,
      actif: q.actif,
      ordre: q.ordre,
    })),
  });
  const quartsDb = await prisma.typeQuart.findMany({
    where: { anneeScolaireId: annee.id },
  });
  const parCode = new Map(quartsDb.map((q) => [q.code, q]));

  // Câblage des enchaînements (§4.3), une fois les identifiants connus.
  for (const q of QUARTS) {
    if (!q.enchaineSur) continue;
    await prisma.typeQuart.update({
      where: { id: parCode.get(q.code)!.id },
      data: { enchaineSurId: parCode.get(q.enchaineSur)!.id },
    });
  }

  const quarts: TypeQuartConfig[] = QUARTS.map((q) => ({
    id: parCode.get(q.code)!.id,
    code: q.code,
    libelle: q.libelle,
    debutMinutes: versMinutes(q.debut),
    finMinutes: versMinutes(q.fin),
    portee: q.portee,
    effectifRequis: q.effectifRequis,
    enchaineSurId: q.enchaineSur ? parCode.get(q.enchaineSur)!.id : null,
    actif: q.actif,
    ordre: q.ordre,
  }));

  // --- Réglages ------------------------------------------------------------
  const reglagesDb = await prisma.reglages.create({
    data: { anneeScolaireId: annee.id },
  });
  const reglages: ReglagesConfig = {
    capaciteMaxGroupe: reglagesDb.capaciteMaxGroupe,
    ratioMaxEleves: reglagesDb.ratioMaxEleves,
    modeGroupement: reglagesDb.modeGroupement,
    dateReferenceAgeJour: reglagesDb.dateReferenceAgeJour,
    dateReferenceAgeMois: reglagesDb.dateReferenceAgeMois,
    eviterMemeQuartConsecutif: reglagesDb.eviterMemeQuartConsecutif,
    continuiteTrancheAge: reglagesDb.continuiteTrancheAge,
    politiqueTrancheEducateur: reglagesDb.politiqueTrancheEducateur,
    doublePoste: reglagesDb.doublePoste,
    politiqueBloc: reglagesDb.politiqueBloc,
    surEffectifOuverture: reglagesDb.surEffectifOuverture,
    critereDepartage: reglagesDb.critereDepartage,
  };

  let version = await creerVersion(annee.id, 1, quarts, tranches, reglages,
    "Configuration initiale de l'année.");

  const dateReference = resoudreDateReference(
    { dateDebut: definition.dateDebut, dateFin: definition.dateFin },
    reglages.dateReferenceAgeJour,
    reglages.dateReferenceAgeMois,
  );

  // --- Journées pédagogiques ----------------------------------------------
  /** Historique réalisé de l'année, source unique des compteurs (§9.5). */
  const realise: AffectationRealisee[] = [];
  let quartsJourneePrecedente = new Map<string, Set<string>>();
  let indexJournee = 0;

  for (const definitionJournee of definition.journees) {
    indexJournee++;

    // §12 — un changement de configuration en cours d'historique, pour
    // vérifier que les journées antérieures restent intactes (§4.6).
    if (definition.libelle === "2025-2026" && indexJournee === 6) {
      const apresMidi = quarts.find((q) => q.code === "APRES_MIDI")!;
      apresMidi.finMinutes = versMinutes("17:45");
      await prisma.typeQuart.update({
        where: { id: apresMidi.id },
        data: { finMinutes: apresMidi.finMinutes },
      });
      version = await creerVersion(annee.id, 2, quarts, tranches, reglages,
        "Après-midi prolongé de 17 h 30 à 17 h 45.");
      console.log("  → changement de configuration : après-midi jusqu'à 17 h 45");
    }

    const journee = await prisma.journeePedagogique.create({
      data: {
        anneeScolaireId: annee.id,
        nom: definitionJournee.nom,
        statut: "VALIDE",
        versionConfigurationId: version.id,
        genereeLe: definitionJournee.dates[0],
        valideeLe: definitionJournee.dates[0],
      },
    });

    // Étape 2 — sélection des élèves participants.
    const eligibles = eleves.filter((e) => e.actif);
    const participants = alea.echantillon(eligibles, alea.entier(55, 85));
    await prisma.participation.createMany({
      data: participants.map((e) => ({
        eleveId: e.id,
        journeePedagogiqueId: journee.id,
      })),
    });

    for (const date of definitionJournee.dates) {
      await creerJourPlanifie({
        journeeId: journee.id,
        date,
        participants,
        educateurs,
        quarts,
        tranches,
        reglages,
        dateReference,
        realise,
        quartsJourneePrecedente,
      });
    }

    // Le tie-break « pas le même quart deux journées de suite » se calcule
    // d'une JOURNÉE pédagogique à la suivante (§8.1, critère 3).
    quartsJourneePrecedente = new Map();
    const idsJours = (
      await prisma.jourPlanifie.findMany({
        where: { journeePedagogiqueId: journee.id },
        select: { id: true },
      })
    ).map((j) => j.id);
    for (const a of realise.filter((r) => idsJours.includes(r.jourPlanifieId))) {
      const set = quartsJourneePrecedente.get(a.educateurId) ?? new Set<string>();
      set.add(a.quartCode);
      quartsJourneePrecedente.set(a.educateurId, set);
    }
  }

  if (definition.journees.length > 0) {
    console.log(
      `  ${definition.journees.length} journées, ${realise.length} affectations`,
    );
  }
}

async function creerVersion(
  anneeScolaireId: string,
  numero: number,
  quarts: TypeQuartConfig[],
  tranches: TrancheAgeConfig[],
  reglages: ReglagesConfig,
  commentaire: string,
) {
  return prisma.versionConfiguration.create({
    data: {
      anneeScolaireId,
      numero,
      commentaire,
      // Instantané opaque : il ne doit dépendre d'aucune table vivante (§4.6).
      snapshot: JSON.parse(JSON.stringify({ quarts, tranches, reglages })),
    },
  });
}

interface EntreeJourPlanifie {
  journeeId: string;
  date: Date;
  participants: EleveDb[];
  educateurs: EducateurDb[];
  quarts: TypeQuartConfig[];
  tranches: TrancheAgeConfig[];
  reglages: ReglagesConfig;
  dateReference: Date;
  realise: AffectationRealisee[];
  quartsJourneePrecedente: Map<string, Set<string>>;
}

async function creerJourPlanifie(entree: EntreeJourPlanifie) {
  const jourDb = await prisma.jourPlanifie.create({
    data: {
      journeePedagogiqueId: entree.journeeId,
      date: entree.date,
      // Les journées passées ont été pointées et confirmées.
      statutConfirmation: "CONFIRME",
      confirmeLe: entree.date,
      confirmePar: "seed",
    },
  });

  // --- Étape 5a : constitution des groupes (§7) ----------------------------
  const refs: EleveRef[] = entree.participants.map((e) => ({
    id: e.id,
    nom: e.nom,
    prenom: e.prenom,
    dateNaissance: e.dateNaissance,
    niveauScolaire: e.niveauScolaire,
  }));

  const { groupes: groupesConstitues } = constituerGroupes({
    participants: refs,
    tranches: entree.tranches,
    mode: entree.reglages.modeGroupement,
    dateReference: entree.dateReference,
    capaciteMaxGroupe: entree.reglages.capaciteMaxGroupe,
  });

  // Persistance des groupes, pour disposer des identifiants définitifs.
  const groupes: GroupeConstitue[] = [];
  for (const g of groupesConstitues) {
    const cree = await prisma.groupe.create({
      data: {
        jourPlanifieId: jourDb.id,
        trancheAgeId: g.trancheAgeId,
        libelle: g.libelle,
        ordre: g.ordre,
      },
    });
    await prisma.groupeEleve.createMany({
      data: g.eleves.map((e) => ({ groupeId: cree.id, eleveId: e.id })),
    });
    groupes.push({ ...g, id: cree.id });
  }

  // --- Étape 3 : disponibilité des éducateurs ------------------------------
  const enPosteCeJour = entree.educateurs.filter((e) => enPoste(e, entree.date));
  const disponibles: EducateurDb[] = [];
  for (const e of enPosteCeJour) {
    // ~10 % d'indisponibilités, comme dans la vraie vie.
    const dispo = alea.chance(0.9);
    await prisma.disponibilite.create({
      data: {
        educateurId: e.id,
        jourPlanifieId: jourDb.id,
        disponible: dispo,
        motif: dispo ? null : "Non disponible",
      },
    });
    if (dispo) disponibles.push(e);
  }

  // --- Étape 5b : génération du planning (§8) ------------------------------
  const compteurs: Map<string, CompteursEducateur> = calculerCompteurs({
    educateurIds: entree.educateurs.map((e) => e.id),
    affectations: entree.realise,
  });

  const refsEducateurs: EducateurRef[] = disponibles.map((e) => ({
    id: e.id,
    nom: e.nom,
    prenom: e.prenom,
  }));

  const resultat = genererJour({
    quarts: entree.quarts,
    groupes,
    educateursDisponibles: refsEducateurs,
    compteurs,
    quartsJourneePrecedente: entree.quartsJourneePrecedente,
    reglages: entree.reglages,
  });

  if (!resultat.faisable) {
    console.warn(
      `  ⚠ ${entree.date.toISOString().slice(0, 10)} : ${resultat.avertissements
        .map((a) => a.message)
        .join(" ")}`,
    );
    return;
  }

  // --- Persistance du PRÉVU ------------------------------------------------
  const affectationsDb = [];
  for (const a of resultat.affectations) {
    affectationsDb.push(
      await prisma.affectation.create({
        data: {
          jourPlanifieId: jourDb.id,
          educateurId: a.educateurId,
          typeQuartId: a.typeQuartId,
          groupeId: a.groupeId,
          quartCode: a.quartCode,
          quartLibelle: a.quartLibelle,
          quartDebutMinutes: a.quartDebutMinutes,
          quartFinMinutes: a.quartFinMinutes,
          justification: a.justification,
          issueEnchainement: a.issueEnchainement,
        },
      }),
    );
  }

  // --- Persistance du RÉALISÉ ---------------------------------------------
  // §9.4 — les présences sont pré-remplies à « présent » ; on n'introduit ici
  // que les exceptions, pour que le prévu et le réalisé diffèrent vraiment.
  const affectesCeJour = new Set(resultat.affectations.map((a) => a.educateurId));
  const remplacantsPossibles = enPosteCeJour.filter(
    (e) => !affectesCeJour.has(e.id),
  );

  for (const aff of affectationsDb) {
    let statut: "PRESENT" | "ABSENT" | "REMPLACE" = "PRESENT";
    let remplacantId: string | null = null;

    const tirage = alea.suivant();
    if (tirage < 0.05 && remplacantsPossibles.length > 0) {
      statut = "REMPLACE";
      remplacantId = alea.parmi(remplacantsPossibles).id;
    } else if (tirage < 0.08) {
      statut = "ABSENT";
    }

    await prisma.presenceEducateur.create({
      data: {
        affectationId: aff.id,
        statut,
        remplacantId,
        note: statut === "ABSENT" ? "Absence non remplacée" : null,
      },
    });

    entree.realise.push({
      jourPlanifieId: jourDb.id,
      educateurId: aff.educateurId,
      quartCode: aff.quartCode,
      quartDebutMinutes: aff.quartDebutMinutes,
      quartFinMinutes: aff.quartFinMinutes,
      presence: { statut, remplacantId },
    });
  }

  // Présences des élèves (§9.1).
  const presencesEleve = groupes.flatMap((g) =>
    g.eleves.map((e) => {
      const tirage = alea.suivant();
      const statut =
        tirage < 0.07 ? "ABSENT" : tirage < 0.1 ? "PARTI_TOT" : "PRESENT";
      return {
        jourPlanifieId: jourDb.id,
        eleveId: e.id,
        groupeId: g.id,
        statut: statut as "PRESENT" | "ABSENT" | "PARTI_TOT",
        heureArriveeMinutes:
          statut === "ABSENT" ? null : versMinutes("06:45") + alea.entier(0, 150),
        heureDepartMinutes:
          statut === "ABSENT"
            ? null
            : statut === "PARTI_TOT"
              ? versMinutes("12:00") + alea.entier(0, 120)
              : versMinutes("15:30") + alea.entier(0, 120),
      };
    }),
  );
  await prisma.presenceEleve.createMany({ data: presencesEleve });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (erreur) => {
    console.error(erreur);
    await prisma.$disconnect();
    process.exit(1);
  });
