import Link from "next/link";
import { notFound } from "next/navigation";

import {
  annulerConfirmation,
  confirmerJour,
  marquerToutPresent,
} from "@/app/actions/presences";
import { Aide } from "@/components/aide";
import { BoutonAction } from "@/components/bouton-action";
import { JourPliable } from "@/components/jour-pliable";
import {
  LignePresenceEducateur,
  LignePresenceEleve,
} from "@/components/saisie-presences";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculerRatio,
  educateursPresents,
  elevesPresentsPendant,
} from "@/lib/domain/ratio";
import { versTexteFr } from "@/lib/domain/temps";
import { prisma } from "@/lib/prisma";

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export default async function PagePresences({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const journee = await prisma.journeePedagogique.findUnique({
    where: { id },
    include: {
      anneeScolaire: { include: { reglages: true } },
      jours: {
        orderBy: { date: "asc" },
        include: {
          groupes: { orderBy: { ordre: "asc" } },
          presencesEleve: {
            include: { eleve: true },
            orderBy: { eleve: { nom: "asc" } },
          },
          affectations: {
            include: { educateur: true, groupe: true, presence: true, typeQuart: true },
            orderBy: { quartDebutMinutes: "asc" },
          },
        },
      },
    },
  });

  if (!journee) notFound();

  const educateurs = await prisma.educateur.findMany({
    where: { actif: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  const plafond = journee.anneeScolaire.reglages?.ratioMaxEleves ?? 20;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div>
        <Link
          href={`/journees/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Journées pédagogiques
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {journee.nom}
        </h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Présences
          <Aide titre="Saisie des présences">
            <p>
              Tout le monde est noté présent d&apos;avance : il n&apos;y a que
              les absences et les remplacements à saisir.
            </p>
            <p>
              Confirmer la journée une fois les vérifications faites.
            </p>
          </Aide>
        </p>
      </div>

      {journee.jours.map((jour) => {
        const verrouille = false;

        // §3 / §9.3 — le ratio se calcule QUART PAR QUART, sur les élèves
        // effectivement là pendant ce quart. À l'ouverture de 6 h 45, les
        // élèves arrivent au compte-gouttes : les compter tous fausserait
        // complètement l'indicateur.
        const fenetres = jour.presencesEleve.map((p) => ({
          statut: p.statut,
          arriveeMinutes: p.heureArriveeMinutes,
          departMinutes: p.heureDepartMinutes,
        }));

        const parQuart = new Map<
          string,
          {
            libelle: string;
            debut: number;
            fin: number;
            communeATousLesGroupes: boolean;
            presences: Array<{
              statut: "PRESENT" | "ABSENT" | "REMPLACE";
              remplacantId: string | null;
            } | null>;
          }
        >();

        for (const a of jour.affectations) {
          const entree = parQuart.get(a.quartCode) ?? {
            libelle: a.quartLibelle,
            debut: a.quartDebutMinutes,
            fin: a.quartFinMinutes,
            communeATousLesGroupes: a.typeQuart.portee === "TOUS_GROUPES",
            presences: [],
          };
          entree.presences.push(
            a.presence
              ? { statut: a.presence.statut, remplacantId: a.presence.remplacantId }
              : null,
          );
          parQuart.set(a.quartCode, entree);
        }

        const ratios = [...parQuart.values()].map((q) => ({
          ...q,
          ...calculerRatio(
            elevesPresentsPendant(fenetres, q.debut, q.fin),
            educateursPresents(q.presences),
            plafond,
            // §4.3 — l'ouverture et la fermeture sont des quarts de
            // surveillance à effectif fixe, pas d'encadrement par groupe.
            { quartDAccueil: q.communeATousLesGroupes },
          ),
        }));

        const depassements = ratios.filter((r) => r.depasse).length;
        const presentsJournee = jour.presencesEleve.filter(
          (p) => p.statut !== "ABSENT",
        ).length;
        const ecarts = jour.affectations.filter(
          (a) => a.presence && a.presence.statut !== "PRESENT",
        );

        async function actionToutPresent() {
          "use server";
          return marquerToutPresent(jour.id);
        }
        async function actionConfirmer() {
          "use server";
          return confirmerJour(jour.id);
        }
        async function actionAnnuler() {
          "use server";
          return annulerConfirmation(jour.id);
        }

        return (
          <JourPliable
            key={jour.id}
            titre={dateFr.format(jour.date)}
            confirme={jour.statutConfirmation === "CONFIRME"}
            resume={
              `${presentsJournee} / ${jour.presencesEleve.length} élève(s) présent(s) · ` +
              `${jour.groupes.length} groupe(s) · ${ecarts.length} écart(s)`
            }
            alerte={
              depassements > 0
                ? `${depassements} ratio(s) dépassé(s)`
                : null
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <BoutonAction
                action={actionToutPresent}
                libelle="Tout marquer présent"
                variant="outline"
              />
              {jour.statutConfirmation === "A_CONFIRMER" ? (
                <BoutonAction
                  action={actionConfirmer}
                  libelle="Confirmer la journée"
                />
              ) : (
                <BoutonAction
                  action={actionAnnuler}
                  libelle="Annuler la confirmation"
                  variant="outline"
                />
              )}
            </div>

            {/* §9.3 — contrôle du ratio, quart par quart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  Ratio par quart
                  <Aide titre="Comment le ratio est calculé">
                    <p>
                      Maximum permis : 1 éducateur pour {plafond} élèves
                      présents.
                    </p>
                    <p>
                      Seuls les élèves présents <em>pendant le quart</em>{" "}
                      comptent. Un éducateur absent ne compte pas ; un
                      remplaçant désigné compte.
                    </p>
                  </Aide>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ratios.map((q) => (
                    <div
                      key={q.libelle}
                      className={`rounded-md border p-3 text-sm ${
                        q.depasse
                          ? "border-destructive bg-destructive/5"
                          : "bg-muted/40"
                      }`}
                    >
                      <p className="font-medium">{q.libelle}</p>
                      <p className="text-xs text-muted-foreground">
                        {versTexteFr(q.debut)} – {versTexteFr(q.fin)}
                        {q.communeATousLesGroupes && " · accueil, tous groupes"}
                      </p>
                      <p className="mt-1 tabular-nums">
                        {q.eleves} élève(s) / {q.educateurs} éducateur(s)
                        {q.ratio !== null && !q.indetermine && (
                          <span
                            className={
                              q.depasse ? " font-semibold text-destructive" : ""
                            }
                          >
                            {" "}
                            = {q.ratio.toFixed(1)}
                          </span>
                        )}
                      </p>
                      {q.depasse && (
                        <p className="mt-1 text-xs font-medium text-destructive">
                          {q.educateurs === 0
                            ? "Aucun éducateur présent"
                            : `Dépasse le maximum de ${plafond}`}
                        </p>
                      )}
                      {q.indetermine && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          Effectif fixe
                          <Aide titre="Ratio non calculé">
                            <p>
                              À l&apos;accueil, les élèves arrivent peu à peu :
                              sans heures d&apos;arrivée notées, on ne peut pas
                              savoir combien étaient présents.
                            </p>
                            <p>
                              Le nombre d&apos;éducateurs pour ce quart est
                              défini dans les paramètres.
                            </p>
                          </Aide>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* §9.2 — présences des éducateurs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Éducateurs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t">
                  {jour.affectations.map((a) =>
                    a.presence ? (
                      <LignePresenceEducateur
                        key={a.id}
                        verrouille={verrouille}
                        remplacants={educateurs
                          .filter((e) => e.id !== a.educateurId)
                          .map((e) => ({
                            id: e.id,
                            nom: `${e.nom} ${e.prenom}`,
                          }))}
                        presence={{
                          id: a.presence.id,
                          nom: `${a.educateur.nom} ${a.educateur.prenom}`,
                          quart: a.quartLibelle,
                          groupe: a.groupe?.libelle ?? null,
                          statut: a.presence.statut,
                          remplacantId: a.presence.remplacantId,
                        }}
                      />
                    ) : null,
                  )}
                </div>
              </CardContent>
            </Card>

            {/* §9.4 — le prévu et le réalisé côte à côte */}
            {ecarts.length > 0 && (
              <Card className="border-amber-500/40">
                <CardHeader>
                  <CardTitle className="text-base">
                    Écarts entre le prévu et le réalisé
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {ecarts.map((a) => (
                    <p key={a.id}>
                      <span className="font-medium text-foreground">
                        {a.educateur.nom} {a.educateur.prenom}
                      </span>{" "}
                      — prévu {a.quartLibelle},{" "}
                      {a.presence?.statut === "ABSENT"
                        ? "absent"
                        : "remplacé"}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* §9.1 — présences des élèves, par groupe */}
            {jour.groupes.map((groupe) => {
              const membres = jour.presencesEleve.filter(
                (p) => p.groupeId === groupe.id,
              );
              if (membres.length === 0) return null;
              const absents = membres.filter((m) => m.statut === "ABSENT").length;

              return (
                <Card key={groupe.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {groupe.libelle}
                      <Badge variant="outline">
                        {membres.length - absents} / {membres.length} présent(s)
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border-t">
                      {membres.map((p) => (
                        <LignePresenceEleve
                          key={p.id}
                          verrouille={verrouille}
                          presence={{
                            id: p.id,
                            nom: `${p.eleve.nom} ${p.eleve.prenom}`,
                            statut: p.statut,
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </JourPliable>
        );
      })}
    </div>
  );
}
