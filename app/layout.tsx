import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";

import { BarreLaterale, EnteteApplication } from "@/components/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { utilisateurCourant } from "@/lib/supabase/serveur";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Générateur de planning des journées pédagogiques",
  description:
    "Constitution des groupes et affectation équitable des éducateurs pour les journées pédagogiques.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // L'état replié est mémorisé côté serveur : sans cela, la barre s'ouvre
  // toujours au chargement puis se replie, ce qui provoque un saut visible.
  const boiteACookies = await cookies();
  const ouverte = boiteACookies.get("sidebar_state")?.value !== "false";

  // Sans utilisateur, la seule page atteignable est l'écran de connexion — le
  // middleware redirige tout le reste. On l'affiche donc sans la coquille de
  // navigation, qui n'aurait aucun sens avant d'être authentifié.
  const utilisateur = await utilisateurCourant();

  return (
    <html
      lang="fr-CA"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {utilisateur ? (
          <SidebarProvider defaultOpen={ouverte}>
            <BarreLaterale courriel={utilisateur.email ?? null} />
            <SidebarInset className="min-w-0">
              <EnteteApplication />
              <main className="min-w-0 flex-1">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        ) : (
          children
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
