import "server-only";

import { calculerCompteurs, ecartSurQuart } from "@/lib/domain/equite";
import { prisma } from "@/lib/prisma";

export interface MoisJournees {
  cle: string;
  libelle: string;
  journees: number;
  jours: number;
}

export interface JourAVenir {
  journeeId: string;
  journeeNom: string;
  date: Date;
  dansCombienDeJours: number;
  statut: string;
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
  journees: number;
}

export interface TableauBord {
  anneeLibelle: string;
  anneeDebut: Date;
  anneeFin: Date;

  eleves: { actifs: number; total: number };
  educateurs: { actifs: number; total: number; jamaisAffectes: number };

  journees: { total: number; brouillon: number; genere: number; valide: number };
  jours: { total: number; aConfirmer: number; passes: number };

  /** Moyenne d'élèves inscrits par journée pédagogique. */
  moyenneParticipants: number;
  /** Moyenne de groupes constitués par jour planifié. */
  moyenneGroupes: number;
  /** Moyenne d'éducateurs mobilisés par jour planifié. */
  moyenneEducateurs: number;

  /** Présents / total, sur les jours dont les présences ont été confirmées. */
  tauxPresenceEleves: number | null;
  absencesEducateurs: number;
  remplacements: number;

  /** Écart max-min sur un même quart, entre éducateurs actifs. */
  ecartMax: { libelle: string; ecart: number } | null;

  parMois: MoisJournees[];
  prochains: JourAVenir[];
  aConfirmer: JourAConfirmer[];
  chargeHaute: ChargeEducateur[];
  chargeBasse: ChargeEducateur[];
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

/** Différence en jours entiers, sans tenir compte de l'heure. */
function joursEntre(de: Date, a: Date): number {
  const jour = 86_400_000;
  const d = Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate());
  const f = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.round((f - d) / jour);
}

/**
 * Agrège tout ce que le tableau de bord affiche, pour l'année scolaire active.
 *
 * Une seule fonction plutôt qu'une requête par vignette : la plupart des
 * indicateurs se déduisent des mêmes journées, et les recharger séparément
 * multiplierait les allers-retours sans rien apporter.
 */
export async function chargerTableauBord(
  aujourdhui = new Date(),
): Promise<TableauBord | null> {
  const annee = await prisma.anneeScolaire.findFirst({
    where: { statut: "ACTIVE" },
  });
  if (!annee) return null;

  const [
    elevesTotal,
    elevesActifs,
    educateursTotal,
    educateursActifs,
    journees,
    educateurs,
    typesQuart,
  ] = await Promise.all([
    prisma.eleve.count(),
    prisma.eleve.count({ where: { actif: true } }),
    prisma.educateur.count(),
    prisma.educateur.count({ where: { actif: true } }),
    prisma.journeePedagogique.findMany({
      where: { anneeScolaireId: annee.id },
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
    }),
    prisma.educateur.findMany({
      select: { id: true, nom: true, prenom: true, actif: true },
    }),
    prisma.typeQuart.findMany({
      where: { anneeScolaireId: annee.id, actif: true },
      orderBy: { ordre: "asc" },
    }),
  ]);

  const tousJours = journees.flatMap((j) => j.jours);
  const affectations = tousJours.flatMap((j) => j.affectations);

  // --- Compteurs d'équité, pour l'écart le plus criant ---------------------
  const compteurs = calculerCompteurs({
    educateurIds: educateurs.map((e) => e.id),
    affectations,
  });

  const compteursActifs = educateurs
    .filter((e) => e.actif)
    .map((e) => compteurs.get(e.id)!)
    .filter(Boolean);

  let ecartMax: TableauBord["ecartMax"] = null;
  for (const tq of typesQuart) {
    const ecart = ecartSurQuart(compteursActifs, tq.code);
    if (!ecartMax || ecart > ecartMax.ecart) {
      ecartMax = { libelle: tq.libelle, ecart };
    }
  }

  // --- Répartition mensuelle ----------------------------------------------
  const parMoisBrut = new Map<string, { journees: Set<string>; jours: number }>();
  for (const journee of journees) {
    for (const jour of journee.jours) {
      const cle = `${jour.date.getUTCFullYear()}-${String(jour.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const entree = parMoisBrut.get(cle) ?? { journees: new Set(), jours: 0 };
      entree.journees.add(journee.id);
      entree.jours += 1;
      parMoisBrut.set(cle, entree);
    }
  }

  // Tous les mois de l'année scolaire, y compris ceux sans journée : un creux
  // est une information, pas une absence de donnée.
  const parMois: MoisJournees[] = [];
  const curseur = new Date(
    Date.UTC(annee.dateDebut.getUTCFullYear(), annee.dateDebut.getUTCMonth(), 1),
  );
  const fin = new Date(
    Date.UTC(annee.dateFin.getUTCFullYear(), annee.dateFin.getUTCMonth(), 1),
  );
  while (curseur <= fin) {
    const cle = `${curseur.getUTCFullYear()}-${String(curseur.getUTCMonth() + 1).padStart(2, "0")}`;
    const entree = parMoisBrut.get(cle);
    parMois.push({
      cle,
      libelle: MOIS[curseur.getUTCMonth()],
      journees: entree?.journees.size ?? 0,
      jours: entree?.jours ?? 0,
    });
    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }

  // --- Prochaines échéances et retards ------------------------------------
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
          statut: journee.statut,
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

  // --- Présences ----------------------------------------------------------
  const presences = tousJours.flatMap((j) => j.presencesEleve);
  const presents = presences.filter((p) => p.statut !== "ABSENT").length;

  const absencesEducateurs = affectations.filter(
    (a) => a.presence?.statut === "ABSENT",
  ).length;
  const remplacements = affectations.filter(
    (a) => a.presence?.statut === "REMPLACE",
  ).length;

  // --- Charge par éducateur ------------------------------------------------
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
    .sort((a, b) => b.minutes - a.minutes);

  const joursAvecGroupes = tousJours.filter((j) => j._count.groupes > 0);
  const joursAvecAffectations = tousJours.filter(
    (j) => j.affectations.length > 0,
  );

  const moyenne = (total: number, sur: number) =>
    sur === 0 ? 0 : Math.round((total / sur) * 10) / 10;

  return {
    anneeLibelle: annee.libelle,
    anneeDebut: annee.dateDebut,
    anneeFin: annee.dateFin,

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
      aConfirmer: tousJours.filter(
        (j) => j.statutConfirmation === "A_CONFIRMER",
      ).length,
      passes: tousJours.filter((j) => joursEntre(aujourdhui, j.date) < 0).length,
    },

    moyenneParticipants: moyenne(
      journees.reduce((s, j) => s + j._count.participations, 0),
      journees.length,
    ),
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
    absencesEducateurs,
    remplacements,

    ecartMax,
    parMois,
    prochains: prochains.slice(0, 4),
    aConfirmer: aConfirmer.slice(0, 4),
    chargeHaute: charges.slice(0, 3),
    chargeBasse: charges.slice(-3).reverse(),
  };
}
