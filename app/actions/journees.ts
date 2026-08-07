"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { chargerApercuSuppression } from "@/lib/data/journees";
import { prisma } from "@/lib/prisma";

/** §6 étape 1 — nom, date unique ou plage de dates consécutives. */
const SchemaJournee = z
  .object({
    nom: z.string().trim().min(1, "Le nom est obligatoire."),
    dateDebut: z.string().min(1, "La date de début est obligatoire."),
    dateFin: z.string().optional(),
    anneeScolaireId: z.string().min(1, "L'année scolaire est obligatoire."),
  })
  .refine(
    (v) => !v.dateFin || v.dateFin >= v.dateDebut,
    { message: "La date de fin précède la date de début.", path: ["dateFin"] },
  );

export interface ResultatAction {
  ok: boolean;
  message: string;
  id?: string;
}

/** Toutes les dates de début à fin, incluses. */
function joursEntre(debut: string, fin: string): Date[] {
  const dates: Date[] = [];
  const courant = new Date(`${debut}T00:00:00.000Z`);
  const dernier = new Date(`${fin}T00:00:00.000Z`);
  while (courant <= dernier) {
    dates.push(new Date(courant));
    courant.setUTCDate(courant.getUTCDate() + 1);
  }
  return dates;
}

export async function creerJournee(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const analyse = SchemaJournee.safeParse({
    nom: donnees.get("nom"),
    dateDebut: donnees.get("dateDebut"),
    dateFin: donnees.get("dateFin") || undefined,
    anneeScolaireId: donnees.get("anneeScolaireId"),
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { nom, dateDebut, dateFin, anneeScolaireId } = analyse.data;
  const dates = joursEntre(dateDebut, dateFin || dateDebut);
  const premier = dates[0];
  const dernier = dates[dates.length - 1];

  const annee = await prisma.anneeScolaire.findUnique({
    where: { id: anneeScolaireId },
  });
  if (!annee) return { ok: false, message: "Année scolaire introuvable." };

  // Le formulaire borne déjà le calendrier à la période de l'année choisie ;
  // ce contrôle reste nécessaire côté serveur. Une journée hors de sa période
  // fausserait les compteurs d'équité de cette année-là.
  if (premier < annee.dateDebut || dernier > annee.dateFin) {
    const jourIso = (d: Date) => d.toISOString().slice(0, 10);
    return {
      ok: false,
      message:
        `Ces dates sortent de l'année ${annee.libelle} ` +
        `(${jourIso(annee.dateDebut)} au ${jourIso(annee.dateFin)}). ` +
        `Choisir une autre année, ou ajuster sa période dans les paramètres.`,
    };
  }

  const journee = await prisma.journeePedagogique.create({
    data: {
      anneeScolaireId: annee.id,
      nom,
      statut: "BROUILLON",
      // §4.4 — chaque jour du bloc est planifié séparément.
      jours: { create: dates.map((date) => ({ date })) },
    },
  });

  revalidatePath("/journees");
  return {
    ok: true,
    id: journee.id,
    message:
      dates.length === 1
        ? "Journée créée."
        : `Journée créée sur ${dates.length} jours consécutifs.`,
  };
}

/**
 * Supprime une journée et tout ce qui en dépend.
 *
 * La suppression reste possible à tout moment — une journée annulée en cours
 * d'année doit pouvoir disparaître — mais elle n'est jamais anodine : les
 * compteurs d'équité étant recalculés et non stockés (§9.5), effacer une
 * journée vécue retire ses heures à toute l'équipe, ce qui déplace les
 * prochaines affectations. L'effort demandé croît donc avec ce qui est
 * détruit : simple confirmation, annonce chiffrée des conséquences, ou saisie
 * du nom de la journée.
 */
export async function supprimerJournee(
  id: string,
  confirmation?: string,
): Promise<ResultatAction> {
  const apercu = await chargerApercuSuppression(id);
  if (!apercu) return { ok: false, message: "Journée introuvable." };

  if (
    apercu.niveau === "saisie_du_nom" &&
    (confirmation ?? "").trim().toLocaleLowerCase("fr") !==
      apercu.nom.trim().toLocaleLowerCase("fr")
  ) {
    return {
      ok: false,
      message: `Saisir « ${apercu.nom} » pour confirmer la suppression.`,
    };
  }

  await prisma.$transaction([
    // Le journal survit à la journée : il en garde la trace, exigée par la
    // Loi 25 pour toute suppression de données.
    prisma.journalModification.create({
      data: {
        entite: "JourneePedagogique",
        entiteId: id,
        action: "suppression",
        donneesAvant: {
          nom: apercu.nom,
          jours: apercu.jours,
          groupes: apercu.groupes,
          affectations: apercu.affectations,
          educateursImpactes: apercu.educateursImpactes,
          minutesRetirees: apercu.minutesRetirees,
          vecue: apercu.vecue,
        },
      },
    }),
    // Jours, groupes, affectations, présences et participations suivent en
    // cascade (schéma §11).
    prisma.journeePedagogique.delete({ where: { id } }),
  ]);

  revalidatePath("/journees");
  revalidatePath("/");
  return {
    ok: true,
    message:
      apercu.affectations > 0
        ? `« ${apercu.nom} » supprimée. Les compteurs d'équité ont été recalculés sans elle.`
        : `« ${apercu.nom} » supprimée.`,
  };
}
