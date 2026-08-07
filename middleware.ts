import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Chemins accessibles sans être connecté. */
const PUBLICS = ["/connexion", "/auth"];

/**
 * Rafraîchit la session et protège l'application — §12, §3 (Loi 25).
 *
 * L'application manipule des données de mineurs : aucune page ne doit être
 * lisible sans authentification. Le contrôle est fait ici, en amont du rendu,
 * plutôt que page par page — un oubli dans une nouvelle page serait sinon une
 * fuite silencieuse.
 */
export async function middleware(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return requete.cookies.getAll();
        },
        setAll(cookiesAEcrire) {
          for (const { name, value } of cookiesAEcrire) {
            requete.cookies.set(name, value);
          }
          reponse = NextResponse.next({ request: requete });
          for (const { name, value, options } of cookiesAEcrire) {
            reponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() valide le jeton auprès de Supabase ; getSession() se contenterait
  // de lire un cookie que n'importe qui peut fabriquer.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = requete.nextUrl.pathname;
  const estPublic = PUBLICS.some((p) => chemin.startsWith(p));

  if (!user && !estPublic) {
    const versConnexion = requete.nextUrl.clone();
    versConnexion.pathname = "/connexion";
    // On mémorise la destination pour y revenir après la connexion.
    versConnexion.searchParams.set("suite", chemin);
    return NextResponse.redirect(versConnexion);
  }

  if (user && chemin.startsWith("/connexion")) {
    const versAccueil = requete.nextUrl.clone();
    versAccueil.pathname = "/";
    versAccueil.search = "";
    return NextResponse.redirect(versAccueil);
  }

  return reponse;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les ressources statiques et les images.
     * Les exports (PDF/Excel) sont volontairement INCLUS : ils contiennent des
     * noms d'élèves et doivent être protégés comme le reste.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
