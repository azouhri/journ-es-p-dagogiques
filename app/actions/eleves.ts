"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ResultatAction } from "./journees";

import { genererCsv } from "@/lib/csv";
import { clesElevesExistants } from "@/lib/data/eleves";
import { essayer } from "@/lib/data/securise";
import { analyserImportEleves, type RapportImport, type EleveImporte } from "@/lib/import-eleves";
import { prisma } from "@/lib/prisma";

/**
 * Étape 1 de l'import (§5.1) : prévisualisation.
 * N'écrit rien. Retourne le rapport ligne par ligne que l'écran affiche.
 */
export async function previsualiserImportEleves(
  texte: string,
): Promise<RapportImport<EleveImporte>> {
  // L'analyse elle-même est une fonction pure. Si la base est injoignable, on
  // prévisualise quand même : seule la détection des doublons DÉJÀ EN BASE est
  // alors impossible, et les doublons internes au fichier restent détectés.
  const existantes = await essayer(clesElevesExistants, new Set<string>());
  return analyserImportEleves(texte, existantes);
}

export interface ResultatImport {
  importes: number;
  ignores: number;
}

/**
 * Étape 2 : import effectif.
 *
 * Le fichier est ré-analysé côté serveur plutôt que de faire confiance à ce
 * que renvoie le navigateur : la prévisualisation informe la responsable, elle
 * ne fait pas autorité. Seules les lignes « nouveau » sont insérées ; les
 * doublons et les lignes en erreur sont ignorés.
 */
export async function confirmerImportEleves(
  texte: string,
): Promise<ResultatImport> {
  const existantes = await clesElevesExistants();
  const rapport = analyserImportEleves(texte, existantes);

  const aInserer = rapport.lignes
    .filter((l) => l.statut === "nouveau" && l.donnees !== null)
    .map((l) => l.donnees!);

  if (aInserer.length > 0) {
    await prisma.$transaction([
      prisma.eleve.createMany({
        data: aInserer.map((e) => ({
          nom: e.nom,
          prenom: e.prenom,
          dateNaissance: e.dateNaissance,
          niveauScolaire: e.niveauScolaire,
          notes: e.notes,
        })),
        skipDuplicates: true,
      }),
      // §3 — journal des modifications (Loi 25).
      prisma.journalModification.create({
        data: {
          entite: "Eleve",
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

  revalidatePath("/eleves");
  return {
    importes: aInserer.length,
    ignores: rapport.nbDoublons + rapport.nbErreurs,
  };
}

/** §5.1 — export CSV. */
export async function exporterElevesCsv(): Promise<string> {
  const eleves = await prisma.eleve.findMany({
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  return genererCsv(
    ["nom", "prenom", "date de naissance", "niveau scolaire", "notes", "actif"],
    eleves.map((e) => [
      e.nom,
      e.prenom,
      e.dateNaissance.toISOString().slice(0, 10),
      e.niveauScolaire,
      e.notes,
      e.actif ? "oui" : "non",
    ]),
  );
}

/** §5.1 — fiche élève. Le niveau scolaire est facultatif, pas la naissance. */
const SchemaEleve = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  prenom: z.string().trim().min(1, "Le prénom est obligatoire."),
  dateNaissance: z
    .string()
    .min(1, "La date de naissance est obligatoire.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Date de naissance illisible."),
  niveauScolaire: z
    .union([z.coerce.number().int().min(0).max(6), z.literal("")])
    .optional(),
  notes: z.string().optional(),
});

export async function enregistrerEleve(
  _precedent: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const id = (donnees.get("id") as string) || null;

  const analyse = SchemaEleve.safeParse({
    nom: donnees.get("nom"),
    prenom: donnees.get("prenom"),
    dateNaissance: donnees.get("dateNaissance"),
    niveauScolaire: donnees.get("niveauScolaire") ?? "",
    notes: donnees.get("notes") ?? "",
  });

  if (!analyse.success) {
    return { ok: false, message: analyse.error.issues[0].message };
  }

  const { nom, prenom, dateNaissance, niveauScolaire, notes } = analyse.data;
  const valeurs = {
    nom,
    prenom,
    dateNaissance: new Date(`${dateNaissance}T00:00:00.000Z`),
    niveauScolaire:
      niveauScolaire === "" || niveauScolaire === undefined
        ? null
        : Number(niveauScolaire),
    notes: notes?.trim() ? notes.trim() : null,
  };

  try {
    if (id) {
      await prisma.eleve.update({ where: { id }, data: valeurs });
    } else {
      await prisma.eleve.create({ data: valeurs });
    }
  } catch (erreur) {
    // La contrainte d'unicité nom + prénom + date de naissance (§5.1).
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === "P2002"
    ) {
      return {
        ok: false,
        message: "Un élève portant ce nom et cette date de naissance existe déjà.",
      };
    }
    throw erreur;
  }

  revalidatePath("/eleves");
  return { ok: true, message: id ? "Élève modifié." : "Élève ajouté." };
}

export async function basculerActifEleve(id: string): Promise<void> {
  const eleve = await prisma.eleve.findUnique({ where: { id } });
  if (!eleve) return;

  await prisma.$transaction([
    prisma.eleve.update({ where: { id }, data: { actif: !eleve.actif } }),
    prisma.journalModification.create({
      data: {
        entite: "Eleve",
        entiteId: id,
        action: eleve.actif ? "desactivation" : "reactivation",
        donneesAvant: { actif: eleve.actif },
        donneesApres: { actif: !eleve.actif },
      },
    }),
  ]);

  revalidatePath("/eleves");
}
