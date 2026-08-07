"use server";

import { revalidatePath } from "next/cache";

import { chargerConfiguration } from "@/lib/data/configuration";
import {
  ageALaDate,
  resoudreDateReference,
  trancheDeLEleve,
} from "@/lib/domain/age";
import { cleEleve } from "@/lib/import-eleves";
import { prisma } from "@/lib/prisma";
import { analyserDate, estAffirmatif, trouverColonne } from "@/lib/tableur";
import { ecrireClasseur, lireClasseur } from "@/lib/xlsx";
import type { ResultatAction } from "./journees";

/**
 * Construit le classeur des participants d'une journée.
 *
 * C'est le chemin de sélection en masse : la responsable exporte, marque ou
 * supprime des lignes dans Excel, puis réimporte. Sur trois cents élèves,
 * c'est nettement plus rapide que trois cents cases à cocher.
 */
export async function classeurParticipants(
  journeeId: string,
): Promise<ArrayBuffer | null> {
  const journee = await prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    include: { participations: { select: { eleveId: true } } },
  });
  if (!journee) return null;

  const inscrits = new Set(journee.participations.map((p) => p.eleveId));

  const [eleves, config, annee] = await Promise.all([
    prisma.eleve.findMany({
      where: { actif: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
    chargerConfiguration(journee.anneeScolaireId),
    prisma.anneeScolaire.findUnique({ where: { id: journee.anneeScolaireId } }),
  ]);

  const dateReference =
    config && annee
      ? resoudreDateReference(
          annee,
          config.reglages.dateReferenceAgeJour,
          config.reglages.dateReferenceAgeMois,
        )
      : null;

  const lignes = eleves.map((e) => {
    const tranche =
      config && dateReference
        ? trancheDeLEleve(
            {
              id: e.id,
              nom: e.nom,
              prenom: e.prenom,
              dateNaissance: e.dateNaissance,
              niveauScolaire: e.niveauScolaire,
            },
            config.tranches,
            config.reglages.modeGroupement,
            dateReference,
          )
        : null;

    return [
      e.nom,
      e.prenom,
      e.dateNaissance.toISOString().slice(0, 10),
      dateReference ? ageALaDate(e.dateNaissance, dateReference) : "",
      tranche?.libelle ?? "hors tranche",
      inscrits.has(e.id) ? "oui" : "non",
    ];
  });

  const tampon = await ecrireClasseur({
    nomFeuille: "Participants",
    titre: journee.nom,
    sousTitre:
      "Mettre « oui » dans la colonne Participe, ou supprimer les lignes non concernées, puis réimporter ce fichier.",
    colonnes: [
      { entete: "Nom", largeur: 22 },
      { entete: "Prénom", largeur: 22 },
      { entete: "Date de naissance", largeur: 20 },
      { entete: "Âge", largeur: 8 },
      { entete: "Tranche", largeur: 16 },
      {
        entete: "Participe",
        largeur: 14,
        note: "oui ou non. Une ligne supprimée équivaut à « non ».",
      },
    ],
    lignes,
    // Les inscrits ressortent d'un coup d'œil dans le classeur.
    surligner: (ligne) =>
      String(ligne.getCell(6).value ?? "").toLowerCase() === "oui"
        ? "FFE6EEF8"
        : null,
  });

  return tampon as ArrayBuffer;
}

/**
 * Réimporte une liste de participants.
 *
 * Deux usages acceptés, sans réglage à choisir :
 *   • le fichier porte une colonne « Participe » -> elle fait foi ;
 *   • sinon, toute ligne présente vaut inscription.
 * C'est ce qui permet de simplement supprimer des lignes dans Excel.
 */
export async function importerParticipants(
  journeeId: string,
  donnees: FormData,
): Promise<ResultatAction> {
  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File)) {
    return { ok: false, message: "Aucun fichier reçu." };
  }

  const { entetes, lignes } = await lireClasseur(await fichier.arrayBuffer());

  const iNom = trouverColonne(entetes, ["nom"]);
  const iPrenom = trouverColonne(entetes, ["prenom", "prénom"]);
  const iDate = trouverColonne(entetes, [
    "date de naissance",
    "datenaissance",
    "ddn",
  ]);
  const iParticipe = trouverColonne(entetes, ["participe", "inscrit"]);

  if (iNom === -1 || iPrenom === -1 || iDate === -1) {
    return {
      ok: false,
      message:
        "Colonnes attendues : Nom, Prénom, Date de naissance. Repartir de la liste exportée.",
    };
  }

  const eleves = await prisma.eleve.findMany({
    select: { id: true, nom: true, prenom: true, dateNaissance: true },
  });
  const parCle = new Map(eleves.map((e) => [cleEleve(e), e.id]));

  const retenus = new Set<string>();
  const introuvables: string[] = [];

  for (const valeurs of lignes) {
    const nom = (valeurs[iNom] ?? "").trim();
    const prenom = (valeurs[iPrenom] ?? "").trim();
    const dateBrute = (valeurs[iDate] ?? "").trim();
    if (!nom || !prenom || !dateBrute) continue;

    // Une colonne « Participe » vide vaut non : seule une marque explicite
    // inscrit l'élève.
    if (iParticipe !== -1 && !estAffirmatif(valeurs[iParticipe] ?? "")) continue;

    const date = analyserDate(dateBrute);
    if (!date) {
      introuvables.push(`${nom} ${prenom}`);
      continue;
    }

    const id = parCle.get(cleEleve({ nom, prenom, dateNaissance: date }));
    if (id) retenus.add(id);
    else introuvables.push(`${nom} ${prenom}`);
  }

  await prisma.$transaction([
    prisma.participation.deleteMany({
      where: { journeePedagogiqueId: journeeId },
    }),
    prisma.participation.createMany({
      data: [...retenus].map((eleveId) => ({
        eleveId,
        journeePedagogiqueId: journeeId,
      })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath(`/journees/${journeeId}`);

  return {
    ok: true,
    message:
      introuvables.length > 0
        ? `${retenus.size} élève(s) inscrit(s). ${introuvables.length} ligne(s) sans correspondance : ${introuvables.slice(0, 3).join(", ")}${introuvables.length > 3 ? "…" : ""}`
        : `${retenus.size} élève(s) inscrit(s).`,
  };
}
