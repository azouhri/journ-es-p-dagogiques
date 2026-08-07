import Link from "next/link";

import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifierConnexion } from "@/lib/data/connexion";
import { essayer } from "@/lib/data/securise";
import { compterEducateurs } from "@/lib/data/educateurs";
import { compterEleves } from "@/lib/data/eleves";
import { prisma } from "@/lib/prisma";

export default async function TableauDeBord() {
  const etat = await verifierConnexion();

  const [eleves, educateurs, anneeActive, aConfirmer] = await Promise.all([
    essayer(compterEleves, { total: 0, actifs: 0, inactifs: 0 }),
    essayer(compterEducateurs, { total: 0, actifs: 0, inactifs: 0 }),
    essayer(
      () => prisma.anneeScolaire.findFirst({ where: { statut: "ACTIVE" } }),
      null,
    ),
    // §9.6 — les journées pointées mais non confirmées.
    essayer(
      () =>
        prisma.jourPlanifie.count({
          where: { statutConfirmation: "A_CONFIRMER" },
        }),
      0,
    ),
  ]);

  const vignettes = [
    { titre: "Élèves actifs", valeur: eleves.actifs, detail: `${eleves.total} au total`, href: "/eleves" },
    { titre: "Éducateurs actifs", valeur: educateurs.actifs, detail: `${educateurs.total} au total`, href: "/educateurs" },
    { titre: "Année scolaire", valeur: anneeActive?.libelle ?? "—", detail: anneeActive ? "en cours" : "aucune année active", href: "/parametres" },
    { titre: "Journées à confirmer", valeur: aConfirmer, detail: "présences non vérifiées", href: "/journees" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vignettes.map((v) => (
          <Link key={v.titre} href={v.href}>
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {v.titre}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{v.valeur}</p>
                <p className="text-xs text-muted-foreground">{v.detail}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {aConfirmer > 0 && (
        <Link href="/journees">
          <Card className="border-amber-500/40 transition-colors hover:border-amber-500/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                {aConfirmer} journée(s) en attente de confirmation
                <Aide titre="Pourquoi ce rappel">
                  <p>
                    Tout le monde y est noté présent d&apos;avance. Ces
                    journées ne sont pas fausses, elles n&apos;ont simplement
                    pas encore été vérifiées.
                  </p>
                  <p>
                    Ce rappel évite d&apos;oublier les absences.
                  </p>
                </Aide>
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
      )}
    </div>
  );
}
