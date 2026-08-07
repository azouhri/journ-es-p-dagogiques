import "server-only";

import {
  calculerCompteurs,
  ecartSurQuart,
  separerComparables,
} from "@/lib/domain/equite";
import { prisma } from "@/lib/prisma";

export interface MoisJournees {
  cle: string;
  libelle: string;
  /** Année civile, affichée seulement quand elle change dans la série. */
  annee: number;
  journees: number;
  jours: number;
  /** Vrai si ces jours tombent hors des bornes de l'année scolaire. */
  horsAnnee: boolean;
}

export interface JourAVenir {
  journeeId: string;
  journeeNom: string;
  date: Date;
  dansCombienDeJours: number;
  eleves: number;
}

export interface JourAConfirmer {
  journeeId: string;
  journeeNom: string;
  date: Date;
  ecarts: number;
}

export interface ChargeEducateur {
  nom: string;
  minutes: number;
  /** Nombre de jours travaillés — sans lui, un écart d'heures est illisible. */
  journees: number;
}

export interface AnneeOption {
  id: string;
  libelle: string;
  statut: string;
}

/** Chiffres comparables d'une année à l'autre. */
export interface ResumeAnnee {
  libelle: string;
  journees: number;
  jours: number;
  moyenneParticipants: number;
  tauxPresenceEleves: number | null;
  moyenneHeures: number;
}

export interface TableauBord {
  annees: AnneeOption[];
  anneeId: string;
  anneeLibelle: string;
  estAnneeActive: boolean;

  eleves: { actifs: number; total: number };
  educateurs: { actifs: number; total: number; jamaisAffectes: number };

  journees: { total: number; brouillon: number; genere: number; valide: number };
  jours: { total: number; aConfirmer: number; horsAnnee: number };

  moyenneParticipants: number;
  moyenneGroupes: number;
  moyenneEducateurs: number;

  tauxPresenceEleves: number | null;
  absencesEducateurs: number;
  remplacements: number;

  ecartMax: {
    libelle: string;
    ecart: number;
    /** Éducateurs retenus dans la comparaison. */
    compares: number;
    /** Éducateurs écartés parce que présents une partie de l'année seulement. */
    partiels: number;
  } | null;

  parMois: MoisJournees[];
  prochains: JourAVenir[];
  aConfirmer: JourAConfirmer[];
  charges: ChargeEducateur[];

  /** Année précédente, si elle existe et comporte des journées. */
  precedente: ResumeAnnee | null;
  courante: ResumeAnnee;
}

const MOIS = [
  "janv.",
  "févr.",
  "mars",
  "avril",
  "mai",
  "juin",
  "juill.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function joursEntre(de: Date, a: Date): number {
  const jour = 86_400_000;
  const d = Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate());
  const f = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.round((f - d) / jour);
}

const moyenne = (total: number, sur: number) =>
  sur === 0 ? 0 : Math.round((total / sur) * 10) / 10;

const cleMois = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Charge toutes les journées d'une année, avec ce qu'il faut pour les compter. */
async function journeesDeLAnnee(anneeScolaireId: string) {
  return prisma.journeePedagogique.findMany({
    where: { anneeScolaireId },
    include: {
      _count: { select: { participations: true } },
      jours: {
        orderBy: { date: "asc" },
        include: {
          _count: { select: { groupes: true } },
          affectations: {
            select: {
              educateurId: true,
              quartCode: true,
              quartDebutMinutes: true,
              quartFinMinutes: true,
              jourPlanifieId: true,
              presence: { select: { statut: true, remplacantId: true } },
            },
          },
          presencesEleve: { select: { statut: true } },
        },
      },
    },
  });
}

type JourneesChargees = Awaited<ReturnType<typeof journeesDeLAnnee>>;

/** Chiffres résumés d'une année — la base de la comparaison d'une année à l'autre. */
function resumer(
  libelle: string,
  journees: JourneesChargees,
  educateurIds: string[],
): ResumeAnnee {
  const tousJours = journees.flatMap((j) => j.jours);
  const affectations = tousJours.flatMap((j) => j.affectations);
  const presences = tousJours.flatMap((j) => j.presencesEleve);
  const presents = presences.filter((p) => p.statut !== "ABSENT").length;

  const compteurs = calculerCompteurs({ educateurIds, affectations });
  const minutes = [...compteurs.values()].reduce(
    (s, c) => s + c.minutesCumulees,
    0,
  );
  // Moyenne sur les seuls éducateurs ayant travaillé : inclure ceux à zéro
  // ferait chuter la moyenne dès qu'on ajoute quelqu'un en fin d'année.
  const actifs = [...compteurs.values()].filter(
    (c) => c.minutesCumulees > 0,
  ).length;

  return {
    libelle,
    journees: journees.length,
    jours: tousJours.length,
    moyenneParticipants: moyenne(
      journees.reduce((s, j) => s + j._count.participations, 0),
      journees.length,
    ),
    tauxPresenceEleves:
      presences.length === 0
        ? null
        : Math.round((presents / presences.length) * 1000) / 10,
    moyenneHeures: actifs === 0 ? 0 : Math.round(minutes / actifs / 6) / 10,
  };
}

/**
 * Agrège le tableau de bord pour une année scolaire.
 *
 * @param anneeId année à afficher ; par défaut l'année active.
 */
export async function chargerTableauBord(
  anneeId?: string,
  aujourdhui = new Date(),
): Promise<TableauBord | null> {
  const annees = await prisma.anneeScolaire.findMany({
    orderBy: { dateDebut: "desc" },
  });
  if (annees.length === 0) return null;

  const annee =
    annees.find((a) => a.id === anneeId) ??
    annees.find((a) => a.statut === "ACTIVE") ??
    annees[0];

  // L'année précédente est celle qui démarre juste avant.
  const precedenteAnnee = annees
    .filter((a) => a.dateDebut < annee.dateDebut)
    .sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime())[0];

  const [
    elevesTotal,
    elevesActifs,
    educateursTotal,
    educateursActifs,
    journees,
    educateurs,
    typesQuart,
    journeesPrecedentes,
  ] = await Promise.all([
    prisma.eleve.count(),
    prisma.eleve.count({ where: { actif: true } }),
    prisma.educateur.count(),
    prisma.educateur.count({ where: { actif: true } }),
    journeesDeLAnnee(annee.id),
    prisma.educateur.findMany({
      select: { id: true, nom: true, prenom: true, actif: true },
    }),
    prisma.typeQuart.findMany({
      where: { anneeScolaireId: annee.id, actif: true },
      orderBy: { ordre: "asc" },
    }),
    precedenteAnnee ? journeesDeLAnnee(precedenteAnnee.id) : Promise.resolve([]),
  ]);

  const educateurIds = educateurs.map((e) => e.id);
  const tousJours = journees.flatMap((j) => j.jours);
  const affectations = tousJours.flatMap((j) => j.affectations);

  const compteurs = calculerCompteurs({ educateurIds, affectations });

  // L'écart ne compare que des éducateurs comparables : ceux présents sur une
  // part suffisante de l'année. Sans ce filtre, une embauche de janvier
  // ferait afficher un écart maximal permanent qui ne dit rien de la rotation.
  const compteursActifs = educateurs
    .filter((e) => e.actif)
    .map((e) => compteurs.get(e.id)!)
    .filter(Boolean);

  const { comparables, partiels: nbPartiels } =
    separerComparables(compteursActifs);

  let ecartMax: TableauBord["ecartMax"] = null;
  for (const tq of typesQuart) {
    const ecart = ecartSurQuart(comparables, tq.code);
    if (!ecartMax || ecart > ecartMax.ecart) {
      ecartMax = { libelle: tq.libelle, ecart, compares: comparables.length, partiels: nbPartiels };
    }
  }

  // --- Répartition mensuelle ----------------------------------------------
  const parMoisBrut = new Map<string, { journees: Set<string>; jours: number }>();
  for (const journee of journees) {
    for (const jour of journee.jours) {
      const cle = cleMois(jour.date);
      const entree = parMoisBrut.get(cle) ?? { journees: new Set(), jours: 0 };
      entree.journees.add(journee.id);
      entree.jours += 1;
      parMoisBrut.set(cle, entree);
    }
  }

  // La série couvre les bornes de l'année ET tout jour qui en sortirait.
  // Se limiter aux bornes ferait disparaître silencieusement des journées du
  // graphique, qui ne totaliserait alors plus la vignette « Journées ».
  const dates = tousJours.map((j) => j.date);
  const debut = new Date(
    Math.min(annee.dateDebut.getTime(), ...dates.map((d) => d.getTime())),
  );
  const fin = new Date(
    Math.max(annee.dateFin.getTime(), ...dates.map((d) => d.getTime())),
  );

  const parMois: MoisJournees[] = [];
  const curseur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
  const dernier = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 1));

  while (curseur <= dernier) {
    const cle = cleMois(curseur);
    const entree = parMoisBrut.get(cle);
    const finDuMois = new Date(
      Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 0),
    );
    parMois.push({
      cle,
      libelle: MOIS[curseur.getUTCMonth()],
      annee: curseur.getUTCFullYear(),
      journees: entree?.journees.size ?? 0,
      jours: entree?.jours ?? 0,
      horsAnnee: finDuMois < annee.dateDebut || curseur > annee.dateFin,
    });
    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }

  // --- Échéances -----------------------------------------------------------
  const prochains: JourAVenir[] = [];
  const aConfirmer: JourAConfirmer[] = [];

  for (const journee of journees) {
    for (const jour of journee.jours) {
      const ecart = joursEntre(aujourdhui, jour.date);

      if (ecart >= 0) {
        prochains.push({
          journeeId: journee.id,
          journeeNom: journee.nom,
          date: jour.date,
          dansCombienDeJours: ecart,
          eleves: journee._count.participations,
        });
      }

      if (jour.statutConfirmation === "A_CONFIRMER" && ecart < 0) {
        aConfirmer.push({
          journeeId: journee.id,
          journeeNom: journee.nom,
          date: jour.date,
          ecarts: jour.affectations.filter(
            (a) => a.presence && a.presence.statut !== "PRESENT",
          ).length,
        });
      }
    }
  }

  prochains.sort((a, b) => a.date.getTime() - b.date.getTime());
  aConfirmer.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Une journée sur cinq jours consécutifs occuperait toute la liste et
  // masquerait les suivantes : on ne garde que sa première échéance.
  const vues = new Set<string>();
  const prochainsDistincts = prochains.filter((p) => {
    if (vues.has(p.journeeId)) return false;
    vues.add(p.journeeId);
    return true;
  });

  const presences = tousJours.flatMap((j) => j.presencesEleve);
  const presents = presences.filter((p) => p.statut !== "ABSENT").length;

  const joursAvecGroupes = tousJours.filter((j) => j._count.groupes > 0);
  const joursAvecAffectations = tousJours.filter((j) => j.affectations.length > 0);

  // Classement complet, décroissant : la vue décide combien en montrer, et il
  // n'y a plus de risque que « les plus » et « les moins » se recouvrent.
  const charges: ChargeEducateur[] = educateurs
    .filter((e) => e.actif)
    .map((e) => {
      const c = compteurs.get(e.id);
      return {
        nom: `${e.nom} ${e.prenom}`,
        minutes: c?.minutesCumulees ?? 0,
        journees: c?.nbJourneesTravaillees ?? 0,
      };
    })
    .sort((a, b) => b.minutes - a.minutes || a.nom.localeCompare(b.nom, "fr"));

  const courante = resumer(annee.libelle, journees, educateurIds);

  return {
    annees: annees.map((a) => ({
      id: a.id,
      libelle: a.libelle,
      statut: a.statut,
    })),
    anneeId: annee.id,
    anneeLibelle: annee.libelle,
    estAnneeActive: annee.statut === "ACTIVE",

    eleves: { actifs: elevesActifs, total: elevesTotal },
    educateurs: {
      actifs: educateursActifs,
      total: educateursTotal,
      jamaisAffectes: educateurs.filter(
        (e) => e.actif && (compteurs.get(e.id)?.nbJourneesTravaillees ?? 0) === 0,
      ).length,
    },

    journees: {
      total: journees.length,
      brouillon: journees.filter((j) => j.statut === "BROUILLON").length,
      genere: journees.filter((j) => j.statut === "GENERE").length,
      valide: journees.filter((j) => j.statut === "VALIDE").length,
    },
    jours: {
      total: tousJours.length,
      aConfirmer: tousJours.filter((j) => j.statutConfirmation === "A_CONFIRMER")
        .length,
      horsAnnee: tousJours.filter(
        (j) => j.date < annee.dateDebut || j.date > annee.dateFin,
      ).length,
    },

    moyenneParticipants: courante.moyenneParticipants,
    moyenneGroupes: moyenne(
      joursAvecGroupes.reduce((s, j) => s + j._count.groupes, 0),
      joursAvecGroupes.length,
    ),
    moyenneEducateurs: moyenne(
      joursAvecAffectations.reduce(
        (s, j) => s + new Set(j.affectations.map((a) => a.educateurId)).size,
        0,
      ),
      joursAvecAffectations.length,
    ),

    tauxPresenceEleves:
      presences.length === 0
        ? null
        : Math.round((presents / presences.length) * 1000) / 10,
    absencesEducateurs: affectations.filter(
      (a) => a.presence?.statut === "ABSENT",
    ).length,
    remplacements: affectations.filter((a) => a.presence?.statut === "REMPLACE")
      .length,

    ecartMax,
    parMois,
    prochains: prochainsDistincts.slice(0, 5),
    aConfirmer: aConfirmer.slice(0, 5),
    charges,

    courante,
    // Une année précédente sans aucune journée ne se compare à rien.
    precedente:
      precedenteAnnee && journeesPrecedentes.length > 0
        ? resumer(precedenteAnnee.libelle, journeesPrecedentes, educateurIds)
        : null,
  };
}
