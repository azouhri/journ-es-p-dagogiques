"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ResultatAction } from "./journees";

import { genererCsv } from "@/lib/csv";
import { courrielsExistants } from "@/lib/data/educateurs";
import { essayer } from "@/lib/data/securise";
import {
  analyserImportEducateurs,
  type EducateurImporte,
  type RapportImport,
} from "@/lib/import-eleves";
import { prisma } from "@/lib/prisma";
import type { ResultatImport } from "./eleves";

export async function previsualiserImportEducateurs(
  texte: string,
): Promise<RapportImport<EducateurImporte>> {
  // Même principe que pour les élèves : la prévisualisation reste possible
  // sans base, seuls les doublons déjà enregistrés échappent alors au contrôle.
  const existants = await essayer(courrielsExistants, new Set<string>());
  return analyserImportEducateurs(texte, existants);
}

export async function confirmerImportEducateurs(
  texte: string,
): Promise<ResultatImport> {
  const rapport = analyserImportEducateurs(texte, await courrielsExistants());

  const aInserer = rapport.lignes
    .filter((l) => l.statut === "nouveau" && l.donnees !== null)
    .map((l) => l.donnees!);

  if (aInserer.length > 0) {
    await prisma.$transaction([
      prisma.educateur.createMany({
        data: aInserer.map((e) => ({
          nom: e.nom,
          prenom: e.prenom,
          courriel: e.courriel,
          statutEmploi: e.statutEmploi,
          dateEmbauche: e.dateEmbauche,
        })),
        skipDuplicates: true,
      }),
      prisma.journalModification.create({
        data: {
          entite: "Educateur",
          entiteId: "import",
          action: "import_csv",
          donneesApres: {
            nbImportes: aInserer.length,
            nbIgnores: rapport.nbDoublons + rapport.nbErreurs,
          },
        },
      }),
    ]);
  }

  revalidatePath("/educateurs");
  return {
    importes: aInserer.length,
    ignores: rapport.nbDoublons + rapport.nbErreurs,
  };
}

export async function exporterEducateursCsv(): Promise<string> {
  const educateurs = await prisma.educateur.findMany({
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  return genererCsv(
    ["nom", "prenom", "courriel", "statut", "date d'embauche", "actif"],
    educateurs.map((e) => [
      e.nom,
      e.prenom,
      e.courriel,
      e.statutEmploi,
      e.dateEmbauche?.toISOString().slice(0, 10) ?? "",
      e.actif ? "oui" : "non",
    ]),
  );
}

/**
 * §5.2 — RÈGLE IMPORTANTE : désactiver un éducateur ne supprime ni ses
 * affectations passées ni ses compteurs. On ne bascule qu'un booléen ; aucune
 * donnée historique n'est touchée, et le tableau d'équité reste intact.
 */
/** §5.2 — fiche éducateur. Le temps partiel n'est pas modélisé dans l'équité. */
const SchemaEducateur = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  prenom: z.string().trim().min(1, "Le prénom est obligatoire."),
  courriel: z
    .union([z.string().trim().email("Courriel invalide."), z.literal("")])
    .optional(),
  statutEmploi: z.enum([
    "TEMPS_PLEIN",
    "TEMPS_PARTIEL",
    "OCCASIONNEL",
    "REMPLACANT",
  ]),
  dateEmbauche: z.string().optional(),
});

export async function enregistrerEducateur(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const id = (donnees.get("id") as string) || null;

  const analyse = SchemaEducateur.safeParse({
    nom: donnees.get("nom"),
    prenom: donnees.get("prenom"),
    courriel: donnees.get("courriel") ?? "",
    statutEmploi: donnees.get("statutEmploi") || "TEMPS_PLEIN",
    dateEmbauche: donnees.get("dateEmbauche") ?? "",
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { nom, prenom, courriel, statutEmploi, dateEmbauche } = analyse.data;
  const valeurs = {
    nom,
    prenom,
    courriel: courriel ? courriel : null,
    statutEmploi,
    dateEmbauche: dateEmbauche
      ? new Date(`${dateEmbauche}T00:00:00.000Z`)
      : null,
  };

  // Tranches d'âge que l'éducateur encadre. Aucune case cochée = toutes les
  // tranches, ce qui est aussi le comportement par défaut côté algorithme.
  const tranches = donnees.getAll("tranches").filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );

  try {
    const educateurId = id
      ? (await prisma.educateur.update({ where: { id }, data: valeurs })).id
      : (await prisma.educateur.create({ data: valeurs })).id;

    await prisma.$transaction([
      prisma.educateurTrancheAge.deleteMany({ where: { educateurId } }),
      prisma.educateurTrancheAge.createMany({
        data: tranches.map((trancheAgeId) => ({ educateurId, trancheAgeId })),
        skipDuplicates: true,
      }),
    ]);
  } catch (erreur) {
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === "P2002"
    ) {
      return { ok: false, message: "Ce courriel est déjà utilisé." };
    }
    throw erreur;
  }

  revalidatePath("/educateurs");
  return { ok: true, message: id ? "Éducateur modifié." : "Éducateur ajouté." };
}

export async function basculerActifEducateur(id: string): Promise<void> {
  const educateur = await prisma.educateur.findUnique({ where: { id } });
  if (!educateur) return;

  await prisma.$transaction([
    prisma.educateur.update({
      where: { id },
      data: { actif: !educateur.actif },
    }),
    prisma.journalModification.create({
      data: {
        entite: "Educateur",
        entiteId: id,
        action: educateur.actif ? "desactivation" : "reactivation",
        donneesAvant: { actif: educateur.actif },
        donneesApres: { actif: !educateur.actif },
      },
    }),
  ]);

  revalidatePath("/educateurs");
}
