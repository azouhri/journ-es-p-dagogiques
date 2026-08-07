import Link from "next/link";
import { notFound } from "next/navigation";

import {
  devaliderJournee,
  genererPlanning,
  previsualiserGroupes,
  validerJournee,
} from "@/app/actions/planification";
import { ApercuGroupes } from "@/components/apercu-groupes";
import { BoutonAction } from "@/components/bouton-action";
import { Etape, FilEtapes, type EtatEtape } from "@/components/etape";
import { EtapeDisponibilites } from "@/components/etape-disponibilites";
import { EtapeParticipants } from "@/components/etape-participants";
import { PlanningJour } from "@/components/planning-jour";
import { SuppressionJournee } from "@/components/suppression-journee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chargerConfiguration } from "@/lib/data/configuration";
import {
  chargerApercuSuppression,
  chargerDroitsJournee,
} from "@/lib/data/journees";
import {
  ageALaDate,
  resoudreDateReference,
  trancheDeLEleve,
} from "@/lib/domain/age";
import { versTexteFr } from "@/lib/domain/temps";
import { prisma } from "@/lib/prisma";

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export default async function PageJournee({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const journee = await prisma.journeePedagogique.findUnique({
    where: { id },
    include: {
      anneeScolaire: true,
      versionConfiguration: true,
      participations: { select: { eleveId: true } },
      jours: {
        orderBy: { date: "asc" },
        include: {
          groupes: {
            orderBy: { ordre: "asc" },
            include: { _count: { select: { membres: true } } },
          },
          disponibilites: true,
          affectations: {
            include: { educateur: true, groupe: true },
            orderBy: [{ quartDebutMinutes: "asc" }],
          },
        },
      },
    },
  });

  if (!journee) notFound();

  const [eleves, educateurs, config, cycle, apercuSuppression] =
    await Promise.all([
      prisma.eleve.findMany({
        where: { actif: true },
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      }),
      prisma.educateur.findMany({
        where: { actif: true },
        orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      }),
      chargerConfiguration(journee.anneeScolaireId),
      chargerDroitsJournee(id),
      chargerApercuSuppression(id),
    ]);

  if (!cycle || !apercuSuppression) notFound();

  const droits = cycle.droits;
  // Le planning se fige quand la journée a été vécue, pas à la validation :
  // une journée validée mais à venir reste rouvrable (lib/domain/cycle-journee).
  const verrouille = !droits.modifierPlanning;
  const aGenere = journee.jours.some((j) => j.affectations.length > 0);
  const aParticipants = journee.participations.length > 0;
  const aDisponibilites = journee.jours.some(
    (j) => j.disponibilites.length > 0,
  );

  // État de chacune des huit étapes du parcours (§6).
  const etats: EtatEtape[] = [
    "fait", // 1 — la journée existe, sinon on ne serait pas sur cette page
    aParticipants ? "fait" : "encours",
    aDisponibilites ? "fait" : aParticipants ? "encours" : "encours",
    "fait", // 4 — tranches reprises de la configuration
    aGenere ? "fait" : aParticipants ? "encours" : "attente",
    aGenere ? (verrouille ? "fait" : "encours") : "attente",
    verrouille ? "fait" : aGenere ? "encours" : "attente",
    verrouille ? "encours" : "attente",
  ];

  // Âge et tranche calculés une fois côté serveur : le composant de sélection
  // s'en sert pour filtrer et cocher une tranche entière d'un coup.
  const dateReference = config
    ? resoudreDateReference(
        journee.anneeScolaire,
        config.reglages.dateReferenceAgeJour,
        config.reglages.dateReferenceAgeMois,
      )
    : null;

  const elevesAffiches = eleves.map((e) => {
    const ref = {
      id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      dateNaissance: e.dateNaissance,
      niveauScolaire: e.niveauScolaire,
    };
    const tranche =
      config && dateReference
        ? trancheDeLEleve(
            ref,
            config.tranches,
            config.reglages.modeGroupement,
            dateReference,
          )
        : null;
    return {
      id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      dateNaissance: e.dateNaissance.toISOString().slice(0, 10),
      age: dateReference ? ageALaDate(e.dateNaissance, dateReference) : null,
      tranche: tranche?.libelle ?? "hors tranche",
    };
  });

  async function actionApercu() {
    "use server";
    return previsualiserGroupes(id);
  }
  async function actionGenerer() {
    "use server";
    return genererPlanning(id);
  }
  async function actionValider() {
    "use server";
    return validerJournee(id);
  }
  async function actionDevalider() {
    "use server";
    return devaliderJournee(id);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/journees"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Journées pédagogiques
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {journee.nom}
          </h1>
          <p className="text-sm text-muted-foreground">
            {journee.jours.map((j) => dateFr.format(j.date)).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={verrouille ? "default" : "outline"}>
            {journee.statut === "BROUILLON"
              ? "Brouillon"
              : journee.statut === "GENERE"
                ? "Généré"
                : "Validé"}
          </Badge>
        </div>
      </div>

      <FilEtapes etats={etats} />

      {verrouille && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-muted bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            {droits.raisonPlanningFige} Les présences, elles, restent
            corrigeables à tout moment.
          </p>
          {droits.devalider && (
            <BoutonAction
              action={actionDevalider}
              libelle="Rouvrir pour modifier"
              libelleEnCours="Réouverture…"
              variant="outline"
              confirmation="Rouvrir la journée pour la modifier ? Le planning déjà diffusé devra être rediffusé après revalidation."
            />
          )}
        </div>
      )}

      <Etape
        numero={1}
        titre="Créer la journée"
        etat={etats[0]}
        description="Nom, date unique ou bloc de dates consécutives."
      >
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{journee.nom}</Badge>
          <Badge variant="outline">
            {journee.jours.length === 1
              ? "1 jour"
              : `${journee.jours.length} jours consécutifs`}
          </Badge>
          <Badge variant="outline">
            année {journee.anneeScolaire.libelle}
          </Badge>
        </div>
      </Etape>

      <Etape
        numero={2}
        titre="Sélectionner les élèves participants"
        etat={etats[1]}
        description="Liste des élèves confirmés."
        aide={
          <p>
            Inscrire les élèves dont la participation est confirmée. Les
            réponses des parents se collectent en dehors de l&apos;application.
          </p>
        }
      >
        <EtapeParticipants
          journeeId={id}
          verrouille={verrouille}
          eleves={elevesAffiches}
          dejaInscrits={journee.participations.map((p) => p.eleveId)}
        />
      </Etape>

      <Etape
        numero={3}
        titre="Confirmer les éducateurs disponibles"
        etat={etats[2]}
        description="Tous cochés par défaut ; décocher les absents."
        aide={
          <p>
            Un éducateur décoché ne sera pas affecté ce jour-là. Il sera
            prioritaire lors des prochaines journées, de façon à ce que
            personne ne se retrouve lésé sur l&apos;année.
          </p>
        }
      >
        <div className="space-y-6">
          {journee.jours.map((jour) => (
            <div key={jour.id} className="space-y-2">
              {journee.jours.length > 1 && (
                <p className="text-sm font-medium">{dateFr.format(jour.date)}</p>
              )}
              <EtapeDisponibilites
                jourPlanifieId={jour.id}
                verrouille={verrouille}
                educateurs={educateurs.map((e) => ({
                  id: e.id,
                  nom: e.nom,
                  prenom: e.prenom,
                }))}
                indisponiblesInitiaux={jour.disponibilites
                  .filter((d) => !d.disponible)
                  .map((d) => d.educateurId)}
              />
            </div>
          ))}
          <Button variant="ghost" size="sm" render={<Link href="/educateurs" />}>
            Ajouter un éducateur manquant
          </Button>
        </div>
      </Etape>

      <Etape
        numero={4}
        titre="Vérifier les tranches d'âge et l'effectif"
        etat={etats[3]}
        description="Aperçu des groupes et de l'effectif nécessaire."
        aide={
          <p>
Un aperçu, rien de plus : aucun planning n'est encore créé.
            Relancer la vérification après avoir modifié les élèves, les
            tranches d'âge ou les disponibilités.
          </p>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config?.tranches.map((t) => (
              <Badge key={t.id} variant="outline">
                {t.libelle} ({t.ageMin}–{t.ageMax} ans)
              </Badge>
            ))}
            <Badge variant="secondary">
              capacité max {config?.reglages.capaciteMaxGroupe ?? 20} par groupe
            </Badge>
          </div>

          <ApercuGroupes recharger={actionApercu} auto={aParticipants} />
        </div>
      </Etape>

      <Etape
        numero={5}
        titre="Générer"
        etat={etats[4]}
        raisonAttente="Inscrire au moins un élève à l'étape 2 avant de générer."
        description="Constitue les groupes, puis répartit les éducateurs."
        aide={
          <p>
S'il manque des éducateurs, l'étape 4 le signale d'abord : le
            planning existant n'est jamais effacé pour rien.
          </p>
        }
      >
        <div className="space-y-3">
          <BoutonAction
            action={actionGenerer}
            libelle={aGenere ? "Régénérer le planning" : "Générer le planning"}
            libelleEnCours="Génération…"
            disabled={verrouille}
            confirmation={
              aGenere
                ? "Régénérer efface le planning actuel et le recalcule depuis les compteurs. Continuer ?"
                : undefined
            }
          />

          {journee.jours.map((jour) =>
            jour.groupes.length === 0 ? null : (
              <div
                key={jour.id}
                className="rounded-md border bg-muted/40 p-3 text-sm"
              >
                <p className="font-medium">{dateFr.format(jour.date)}</p>
                <p className="text-muted-foreground">
                  {jour.groupes.length} groupe(s) —{" "}
                  {jour.groupes
                    .map((g) => `${g.libelle} (${g._count.membres})`)
                    .join(", ")}
                </p>
              </div>
            ),
          )}
        </div>
      </Etape>

      <Etape
        numero={6}
        titre="Ajuster"
        etat={etats[5]}
        raisonAttente="Générer le planning à l'étape 5 pour pouvoir l'ajuster."
        description="Cocher deux affectations pour les permuter."
        aide={
          <p>
La répartition proposée tient compte de ce que chacun a déjà
            fait cette année. Une permutation reste possible, mais elle peut
            créer un déséquilibre.
          </p>
        }
      >
        <div className="space-y-6">
          {journee.jours.map((jour) => (
            <div key={jour.id} className="space-y-2">
              {journee.jours.length > 1 && (
                <p className="text-sm font-medium">{dateFr.format(jour.date)}</p>
              )}
              <PlanningJour
                verrouille={verrouille}
                affectations={jour.affectations.map((a) => ({
                  id: a.id,
                  quartCode: a.quartCode,
                  quartLibelle: a.quartLibelle,
                  horaire: `${versTexteFr(a.quartDebutMinutes)} – ${versTexteFr(a.quartFinMinutes)}`,
                  educateur: `${a.educateur.nom} ${a.educateur.prenom}`,
                  groupe: a.groupe?.libelle ?? null,
                  justification: a.justification,
                  issueEnchainement: a.issueEnchainement,
                  ajusteeManuellement: a.ajusteeManuellement,
                }))}
              />
            </div>
          ))}
        </div>
      </Etape>

      <Etape
        numero={7}
        titre="Valider"
        etat={etats[6]}
        raisonAttente="Générer le planning à l'étape 5 avant de le valider."
        description="Rend le planning définitif."
        aide={
          <p>
Tout le monde est alors noté présent d'avance : le jour venu, il
            n'y aura que les absences et les remplacements à saisir.
          </p>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <BoutonAction
            action={actionValider}
            libelle="Valider la journée"
            libelleEnCours="Validation…"
            disabled={verrouille}
          />
          {verrouille && (
            <Button
              variant="outline"
              render={<Link href={`/journees/${id}/presences`} />}
            >
              Saisir les présences
            </Button>
          )}
        </div>
      </Etape>

      <Etape
        numero={8}
        titre="Exporter"
        etat={etats[7]}
        raisonAttente="Valider la journée à l'étape 7 pour pouvoir l'exporter."
        description="PDF pour affichage, Excel pour retraitement."
        aide={
          <p>
Les fichiers sont produits par l'application : aucune information
            sur les élèves n'est envoyée ailleurs.
          </p>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            render={<a href={`/journees/${id}/export/planning.pdf`} />}
          >
            Planning (PDF)
          </Button>
          <Button
            variant="outline"
            render={<a href={`/journees/${id}/export/presences.pdf`} />}
          >
            Feuille de présence vierge (PDF)
          </Button>
          <Button
            variant="outline"
            render={<a href={`/journees/${id}/export/planning.xlsx`} />}
          >
            Planning (Excel)
          </Button>
        </div>
      </Etape>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-4">
        <div className="text-sm">
          <p className="font-medium">Annuler cette journée</p>
          <p className="text-muted-foreground">
            {apercuSuppression.affectations > 0
              ? `${apercuSuppression.jours} jour(s), ${apercuSuppression.groupes} groupe(s) et ${apercuSuppression.affectations} affectation(s) seront effacés.`
              : "Rien n'a encore été planifié pour cette journée."}
          </p>
        </div>
        <SuppressionJournee
          journeeId={id}
          retourVers="/journees"
          apercu={{
            nom: apercuSuppression.nom,
            niveau: apercuSuppression.niveau,
            jours: apercuSuppression.jours,
            groupes: apercuSuppression.groupes,
            affectations: apercuSuppression.affectations,
            educateursImpactes: apercuSuppression.educateursImpactes,
            heuresRetirees:
              Math.round(apercuSuppression.minutesRetirees / 6) / 10,
            vecue: apercuSuppression.vecue,
          }}
        />
      </div>
    </div>
  );
}
