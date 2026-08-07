import Link from "next/link";

import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { GraphiqueMois } from "@/components/graphique-mois";
import { Vignette } from "@/components/vignette";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifierConnexion } from "@/lib/data/connexion";
import { essayer } from "@/lib/data/securise";
import { chargerTableauBord } from "@/lib/data/tableau-bord";
import { dureeEnTexte } from "@/lib/domain/temps";

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
  return `dans ${Math.round(jours / 7)} semaines`;
}

export default async function TableauDeBord() {
  const etat = await verifierConnexion();
  const bord = await essayer(() => chargerTableauBord(), null);

  if (!bord) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {!etat.ok && <BanniereConfiguration etat={etat} />}
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucune année scolaire active.
        </div>
      </div>
    );
  }

  const prochain = bord.prochains[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <Badge variant="outline">Année {bord.anneeLibelle}</Badge>
      </div>

      {/* Ce qui vient — la première question qu'on se pose en arrivant. */}
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
          libelle="Journées cette année"
          valeur={bord.journees.total}
          precision={`${bord.journees.valide} validée(s) · ${bord.journees.brouillon + bord.journees.genere} en préparation`}
          href="/journees"
        />
        <Vignette
          libelle="Jours à confirmer"
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
              ? `au plus large sur « ${bord.ecartMax.libelle} »`
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
              ? `${bord.educateurs.jamaisAffectes} sans affectation cette année`
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
                  Nombre de journées pédagogiques par mois sur
                  l&apos;année scolaire. Survoler une colonne pour le détail.
                </p>
                <p>
                  Les mois sans journée restent affichés : voir un creux aide à
                  répartir la charge sur l&apos;année.
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
            <CardTitle className="text-base">Moyennes par journée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Élèves inscrits</span>
              <span className="text-lg font-semibold">
                {bord.moyenneParticipants}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">Groupes constitués</span>
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
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines journées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {bord.prochains.length === 0 ? (
              <p className="text-muted-foreground">
                Aucune journée à venir cette année.
              </p>
            ) : (
              bord.prochains.map((p) => (
                <Link
                  key={`${p.journeeId}-${p.date.toISOString()}`}
                  href={`/journees/${p.journeeId}`}
                  className="flex items-baseline justify-between gap-2 rounded px-1 py-1 hover:bg-accent"
                >
                  <span className="min-w-0 truncate">{p.journeeNom}</span>
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
          <CardContent className="space-y-2 text-sm">
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
                  <span className="min-w-0 truncate">
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
              <Aide titre="Heures cumulées">
                <p>
                  Les trois éducateurs les plus sollicités et les trois qui le
                  sont le moins, sur l&apos;année scolaire.
                </p>
                <p>
                  Un écart marqué entre les deux groupes signale une rotation
                  qui ne s&apos;équilibre pas.
                </p>
              </Aide>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {bord.chargeHaute.map((c) => (
              <div key={c.nom} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">{c.nom}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {dureeEnTexte(c.minutes)}
                </span>
              </div>
            ))}
            {bord.chargeBasse.length > 0 && (
              <div className="my-2 border-t pt-2 text-xs text-muted-foreground">
                Les moins sollicités
              </div>
            )}
            {bord.chargeBasse.map((c) => (
              <div key={c.nom} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">{c.nom}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {dureeEnTexte(c.minutes)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
