import "server-only";

import { prisma } from "@/lib/prisma";

export type EtatConnexion =
  | { ok: true }
  | { ok: false; titre: string; message: string };

/**
 * Vérifie que la base est joignable AVANT de rendre une page qui en dépend.
 *
 * Le message rendu est volontairement NON TECHNIQUE : la responsable du
 * service de garde n'a que faire d'une chaîne de connexion ou d'un nom de
 * variable d'environnement. Le diagnostic exploitable part dans le journal
 * du serveur, où l'administrateur le trouvera.
 */
export async function verifierConnexion(): Promise<EtatConnexion> {
  const url = process.env.DATABASE_URL;

  const indisponible = (diagnostic: string): EtatConnexion => {
    console.error(`[connexion] ${diagnostic}`);
    return {
      ok: false,
      titre: "Service momentanément indisponible",
      message:
        "Les données ne sont pas accessibles pour le moment. Réessayer dans quelques instants ; si le problème persiste, prévenir la personne qui administre l'application.",
    };
  };

  if (!url) {
    return indisponible("DATABASE_URL absente de l'environnement.");
  }

  if (
    url.includes("[PASSWORD]") ||
    url.includes("[POOLER_HOST]") ||
    url.includes("[REF]")
  ) {
    return indisponible(
      "DATABASE_URL contient encore les espaces réservés du modèle. " +
        "Renseigner la chaîne de connexion du projet (pooler de transaction, port 6543).",
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (erreur) {
    return indisponible(
      erreur instanceof Error ? erreur.message.split("\n")[0] : String(erreur),
    );
  }
}
