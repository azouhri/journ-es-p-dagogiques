"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clesElevesExistants } from "@/lib/data/eleves";
import { essayer } from "@/lib/data/securise";
import {
  analyserImportEleves,
  type EleveImporte,
  type RapportImport,
} from "@/lib/import-eleves";
import { prisma } from "@/lib/prisma";
import { lireClasseur } from "@/lib/xlsx";
import type { ResultatAction } from "./journees";

const NIVEAUX = [
  "Maternelle",
  "1re année",
  "2e année",
  "3e année",
  "4e année",
  "5e année",
  "6e année",
];

/**
 * Étape 1 de l'import (§5.1) : prévisualisation.
 * N'écrit rien. Retourne le rapport ligne par ligne que l'écran affiche.
 */
export async function previsualiserImportEleves(
  donnees: FormData,
): Promise<RapportImport<EleveImporte>> {
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File)) {
    return {
      lignes: [],
      entetesManquantes: [],
      nbNouveaux: 0,
      nbDoublons: 0,
      nbErreurs: 0,
    };
  }

  const feuille = await lireClasseur(await fichier.arrayBuffer());
  // Sans base joignable, la prévisualisation reste possible : seuls les
  // doublons DÉJÀ ENREGISTRÉS échappent alors au contrôle.
  const existantes = await essayer(clesElevesExistants, new Set<string>());
  return analyserImportEleves(feuille, existantes);
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
 * ne fait pas autorité.
 */
export async function confirmerImportEleves(
  donnees: FormData,
): Promise<ResultatImport> {
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File)) return { importes: 0, ignores: 0 };

  const feuille = await lireClasseur(await fichier.arrayBuffer());
  const rapport = analyserImportEleves(feuille, await clesElevesExistants());

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
      prisma.journalModification.create({
        data: {
          entite: "Eleve",
          entiteId: "import",
          action: "import_classeur",
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

/** Lignes de l'export des élèves. */
export async function lignesElevesPourExport() {
  const eleves = await prisma.eleve.findMany({
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  return eleves.map((e) => [
    e.nom,
    e.prenom,
    e.dateNaissance.toISOString().slice(0, 10),
    e.niveauScolaire === null
      ? ""
      : (NIVEAUX[e.niveauScolaire] ?? String(e.niveauScolaire)),
    e.notes ?? "",
  ]);
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
