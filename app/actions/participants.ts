"use server";

import { revalidatePath } from "next/cache";

import { analyserCsv, genererCsv, normaliserEntete, trouverColonne } from "@/lib/csv";
import { chargerConfiguration } from "@/lib/data/configuration";
import { ageALaDate, resoudreDateReference, trancheDeLEleve } from "@/lib/domain/age";
import { cleEleve } from "@/lib/import-eleves";
import { prisma } from "@/lib/prisma";
import type { ResultatAction } from "./journees";

/**
 * Exporte la liste complète des élèves actifs avec une colonne « participe ».
 *
 * C'est le chemin de sélection en masse : la responsable exporte, supprime ou
 * marque les lignes dans Excel, puis réimporte. Sur 287 élèves, c'est plus
 * rapide que 287 cases à cocher.
 */
export async function exporterParticipantsCsv(
  journeeId: string,
): Promise<string> {
  const journee = await prisma.journeePedagogique.findUnique({
    where: { id: journeeId },
    include: { participations: { select: { eleveId: true } } },
  });
  if (!journee) return "";

  const inscrits = new Set(journee.participations.map((p) => p.eleveId));

  const eleves = await prisma.eleve.findMany({
    where: { actif: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  const config = await chargerConfiguration(journee.anneeScolaireId);
  const annee = await prisma.anneeScolaire.findUnique({
    where: { id: journee.anneeScolaireId },
  });

  const dateReference =
    config && annee
      ? resoudreDateReference(
          annee,
          config.reglages.dateReferenceAgeJour,
          config.reglages.dateReferenceAgeMois,
        )
      : null;

  return genererCsv(
    ["nom", "prenom", "date de naissance", "age", "tranche", "participe"],
    eleves.map((e) => {
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
    }),
  );
}

/**
 * Réimporte une liste de participants.
 *
 * Deux usages acceptés, sans réglage à choisir :
 *   • le fichier porte une colonne « participe » -> elle fait foi ;
 *   • sinon, toute ligne présente vaut inscription.
 * C'est ce qui permet de simplement supprimer des lignes dans Excel.
 */
export async function importerParticipantsCsv(
  journeeId: string,
  texte: string,
): Promise<ResultatAction> {
  const { entetes, lignes } = analyserCsv(texte);

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
        "Colonnes attendues : nom, prénom, date de naissance (et, facultatif, participe).",
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

    if (iParticipe !== -1) {
      const valeur = normaliserEntete(valeurs[iParticipe] ?? "");
      // Une colonne vide vaut « non » : seule une marque explicite inscrit.
      if (!["oui", "o", "yes", "y", "1", "vrai", "true", "x"].includes(valeur)) {
        continue;
      }
    }

    const date = new Date(`${dateBrute}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
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
