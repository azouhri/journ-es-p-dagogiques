import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur — §12.
 *
 * Il ne sert QU'À l'authentification : toutes les lectures et écritures de
 * données passent par Prisma. C'est aussi pour cela que la clé publiable
 * suffit ici, alors qu'elle ne peut rien lire des tables (RLS activé, aucune
 * politique).
 */
export async function clientSupabaseServeur() {
  const boiteACookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return boiteACookies.getAll();
        },
        setAll(cookiesAEcrire) {
          try {
            for (const { name, value, options } of cookiesAEcrire) {
              boiteACookies.set(name, value, options);
            }
          } catch {
            // Un composant serveur ne peut pas écrire de cookie. Le
            // rafraîchissement de session est assuré par le middleware, donc
            // cette erreur est sans conséquence.
          }
        },
      },
    },
  );
}

/**
 * Utilisateur connecté, ou null.
 *
 * On utilise `getUser()` et non `getSession()` : getSession lit le cookie sans
 * le vérifier, alors que getUser valide le jeton auprès de Supabase. Pour une
 * décision d'autorisation, seul le second est digne de confiance.
 */
export async function utilisateurCourant() {
  const supabase = await clientSupabaseServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
