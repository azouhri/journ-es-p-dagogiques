"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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

export async function supprimerJournee(id: string): Promise<void> {
  // Seul un brouillon peut être supprimé : une journée validée fait partie de
  // l'historique d'équité (§4.6).
  const journee = await prisma.journeePedagogique.findUnique({
    where: { id },
    select: { statut: true },
  });
  if (!journee || journee.statut !== "BROUILLON") return;

  await prisma.journeePedagogique.delete({ where: { id } });
  revalidatePath("/journees");
}
