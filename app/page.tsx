import Link from "next/link";
import { Suspense } from "react";

import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { ChargeEducateurs } from "@/components/charge-educateurs";
import { ComparaisonAnnees } from "@/components/comparaison-annees";
import { GraphiqueMois } from "@/components/graphique-mois";
import { SelecteurAnnee } from "@/components/selecteur-annee";
import { Vignette } from "@/components/vignette";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifierConnexion } from "@/lib/data/connexion";
import { essayer } from "@/lib/data/securise";
import { chargerTableauBord } from "@/lib/data/tableau-bord";

const dateCourte = new Intl.DateTimeFormat("fr-CA", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function delai(jours: number): string {
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours < 7) return `dans ${jours} jours`;
  if (jours < 14) return "la semaine prochaine";
  if (jours < 60) return `dans ${Math.round(jours / 7)} semaines`;
  return `dans ${Math.round(jours / 30)} mois`;
}

export default async function TableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>;
}) {
  const { annee } = await searchParams;
  const etat = await verifierConnexion();
  const bord = await essayer(() => chargerTableauBord(annee), null);

  if (!bord) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {!etat.ok && <BanniereConfiguration etat={etat} />}
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucune année scolaire définie.
        </div>
      </div>
    );
  }

  const prochain = bord.prochains[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <div className="flex flex-wrap items-center gap-2">
          {!bord.estAnneeActive && (
            <Badge variant="secondary">Année archivée</Badge>
          )}
          <Suspense fallback={null}>
            <SelecteurAnnee annees={bord.annees} courante={bord.anneeId} />
          </Suspense>
        </div>
      </div>

      {bord.jours.horsAnnee > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          {bord.jours.horsAnnee} jour(s) planifié(s) hors des dates de
          l&apos;année {bord.anneeLibelle}
          <Aide titre="Jours hors année">
            <p>
              Ces jours comptent dans les chiffres ci-dessous et apparaissent en
              ambre dans le graphique.
            </p>
            <p>
              Leur rattachement à cette année fausse la comparaison d&apos;une
              année à l&apos;autre : mieux vaut corriger leurs dates ou les
              rattacher à la bonne année.
            </p>
          </Aide>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Vignette
          libelle="Prochaine journée"
          valeur={prochain ? dateCourte.format(prochain.date) : "—"}
          precision={
            prochain
              ? `${delai(prochain.dansCombienDeJours)} · ${prochain.eleves} élève(s)`
              : "aucune à venir"
          }
          href="/journees"
        />
        <Vignette
          libelle="Journées pédagogiques"
          valeur={bord.journees.total}
          precision={`${bord.jours.total} jour(s) · ${bord.journees.valide} validée(s)`}
          href="/journees"
        />
        <Vignette
          libelle="Présences à vérifier"
          valeur={bord.jours.aConfirmer}
          precision={`sur ${bord.jours.total} jour(s) planifié(s)`}
          href="/journees"
          ton={bord.jours.aConfirmer > 0 ? "attention" : "neutre"}
        />
        <Vignette
          libelle="Écart d'équité"
          valeur={bord.ecartMax ? bord.ecartMax.ecart : "—"}
          precision={
            bord.ecartMax
              ? `sur « ${bord.ecartMax.libelle} », entre ${bord.ecartMax.compares} éducateurs` +
                (bord.ecartMax.partiels > 0
                  ? ` · ${bord.ecartMax.partiels} à temps partiel exclu(s)`
                  : "")
              : "aucun quart actif"
          }
          href="/equite"
          ton={bord.ecartMax && bord.ecartMax.ecart > 2 ? "attention" : "neutre"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Vignette
          libelle="Élèves actifs"
          valeur={bord.eleves.actifs}
          precision={`${bord.eleves.total} au total`}
          href="/eleves"
        />
        <Vignette
          libelle="Éducateurs actifs"
          valeur={bord.educateurs.actifs}
          precision={
            bord.educateurs.jamaisAffectes > 0
              ? `${bord.educateurs.jamaisAffectes} sans affectation`
              : "tous ont été affectés"
          }
          href="/educateurs"
        />
        <Vignette
          libelle="Présence des élèves"
          valeur={
            bord.tauxPresenceEleves === null
              ? "—"
              : `${bord.tauxPresenceEleves} %`
          }
          precision="sur les journées pointées"
        />
        <Vignette
          libelle="Absences d'éducateurs"
          valeur={bord.absencesEducateurs}
          precision={`${bord.remplacements} remplacement(s)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              Journées par mois
              <Aide titre="Répartition sur l'année">
                <p>
                  Nombre de journées pédagogiques par mois. Survoler une colonne
                  pour le détail.
                </p>
                <p>
                  Les mois sans journée restent affichés : voir un creux aide à
                  répartir la charge. Une colonne ambre signale des jours hors
                  des dates de l&apos;année scolaire.
                </p>
              </Aide>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraphiqueMois mois={bord.parMois} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {bord.precedente
                ? `Comparé à ${bord.precedente.libelle}`
                : "Moyennes par journée"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bord.precedente ? (
              <ComparaisonAnnees
                courante={bord.courante}
                precedente={bord.precedente}
              />
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">Élèves inscrits</span>
                  <span className="text-lg font-semibold">
                    {bord.moyenneParticipants}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">
                    Groupes constitués
                  </span>
                  <span className="text-lg font-semibold">
                    {bord.moyenneGroupes}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">
                    Éducateurs mobilisés
                  </span>
                  <span className="text-lg font-semibold">
                    {bord.moyenneEducateurs}
                  </span>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">
                  Aucune année antérieure à comparer.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines journées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {bord.prochains.length === 0 ? (
              <p className="text-muted-foreground">
                Aucune journée à venir sur cette année.
              </p>
            ) : (
              bord.prochains.map((p) => (
                <Link
                  key={`${p.journeeId}-${p.date.toISOString()}`}
                  href={`/journees/${p.journeeId}`}
                  className="flex items-baseline justify-between gap-2 rounded px-1 py-1 hover:bg-accent"
                >
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums">
                      {dateCourte.format(p.date)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.journeeNom}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {delai(p.dansCombienDeJours)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={bord.aConfirmer.length > 0 ? "border-amber-500/40" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              Présences à vérifier
              <Aide titre="Journées passées non confirmées">
                <p>
                  Tout le monde y est noté présent d&apos;avance. Tant
                  qu&apos;elles ne sont pas confirmées, les chiffres
                  d&apos;équité les comptent comme travaillées.
                </p>
              </Aide>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {bord.aConfirmer.length === 0 ? (
              <p className="text-muted-foreground">
                Toutes les journées passées sont confirmées.
              </p>
            ) : (
              bord.aConfirmer.map((j) => (
                <Link
                  key={`${j.journeeId}-${j.date.toISOString()}`}
                  href={`/journees/${j.journeeId}/presences`}
                  className="flex items-baseline justify-between gap-2 rounded px-1 py-1 hover:bg-accent"
                >
                  <span className="min-w-0 truncate tabular-nums">
                    {dateCourte.format(j.date)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {j.ecarts > 0 ? `${j.ecarts} écart(s)` : "à confirmer"}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              Charge de travail
              <Aide titre="Heures par éducateur">
                <p>
                  Heures cumulées sur l&apos;année, du plus au moins sollicité.
                </p>
                <p>
                  Le nombre de jours travaillés est indiqué à côté : quelqu&apos;un
                  arrivé en cours d&apos;année cumule forcément moins
                  d&apos;heures sans avoir été lésé. Ces cas sont marqués
                  «&nbsp;partiel&nbsp;».
                </p>
              </Aide>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChargeEducateurs charges={bord.charges} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
