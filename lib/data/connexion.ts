import "server-only";

import { prisma } from "@/lib/prisma";

export type EtatConnexion =
  | { ok: true }
  | { ok: false; titre: string; message: string; detail: string };

/**
 * Vérifie que la base est joignable AVANT de rendre une page qui en dépend.
 *
 * Sans ce garde-fou, un `.env` incomplet produit une trace d'exception Prisma
 * au milieu de l'écran. Ici, l'application explique ce qui manque et où le
 * trouver — c'est la première chose que voit quelqu'un qui installe le projet.
 */
export async function verifierConnexion(): Promise<EtatConnexion> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return {
      ok: false,
      titre: "Base de données non configurée",
      message: "La variable DATABASE_URL est absente du fichier .env.",
      detail:
        "Copier .env.example vers .env, puis y coller les chaînes de connexion du projet Supabase.",
    };
  }

  if (url.includes("[PASSWORD]") || url.includes("[POOLER_HOST]") || url.includes("[REF]")) {
    return {
      ok: false,
      titre: "Chaîne de connexion incomplète",
      message:
        "DATABASE_URL contient encore les espaces réservés du modèle ([PASSWORD], [POOLER_HOST]).",
      detail:
        "Tableau de bord Supabase > Project Settings > Database > Connection string. " +
        "Copier l'URI du pooler de transaction (port 6543) dans DATABASE_URL et " +
        "l'URI directe (port 5432) dans DIRECT_URL, en remplaçant [YOUR-PASSWORD] " +
        "par le mot de passe de la base.",
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (erreur) {
    return {
      ok: false,
      titre: "Connexion à la base impossible",
      message:
        erreur instanceof Error ? erreur.message.split("\n")[0] : String(erreur),
      detail:
        "Vérifier le mot de passe et le nom d'hôte du pooler dans .env, puis relancer le serveur.",
    };
  }
}
