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
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { nom, dateDebut, dateFin } = analyse.data;
  const dates = joursEntre(dateDebut, dateFin || dateDebut);

  // La journée est rattachée à l'année scolaire qui CONTIENT ses dates, pas
  // simplement à l'année active. Sans cela, une journée d'août se retrouverait
  // dans l'année qui s'est terminée en juin, et ses affectations viendraient
  // fausser les compteurs d'équité de cette année-là.
  const premier = dates[0];
  const dernier = dates[dates.length - 1];

  const annee = await prisma.anneeScolaire.findFirst({
    where: { dateDebut: { lte: premier }, dateFin: { gte: dernier } },
  });

  if (!annee) {
    const annees = await prisma.anneeScolaire.findMany({
      orderBy: { dateDebut: "asc" },
      select: { libelle: true, dateDebut: true, dateFin: true },
    });
    const periodes = annees
      .map(
        (a) =>
          `${a.libelle} (${a.dateDebut.toISOString().slice(0, 10)} au ${a.dateFin.toISOString().slice(0, 10)})`,
      )
      .join(", ");

    return {
      ok: false,
      message: annees.length
        ? `Aucune année scolaire ne couvre ces dates. Années définies : ${periodes}.`
        : "Aucune année scolaire définie. En créer une avant de planifier une journée.",
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
