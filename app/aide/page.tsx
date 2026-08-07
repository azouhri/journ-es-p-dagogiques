import Link from "next/link";

import { SectionAide } from "@/components/section-aide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { chargerConfiguration } from "@/lib/data/configuration";
import { essayer } from "@/lib/data/securise";
import { versTexteFr } from "@/lib/domain/temps";
import { NIVEAUX_SCOLAIRES } from "@/lib/tableur";

export const metadata = { title: "Guide d'utilisation" };

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Les mêmes libellés que dans les listes déroulantes des paramètres. */
const LIBELLES: Record<string, string> = {
  AGE_CALCULE: "Par âge calculé",
  NIVEAU_SCOLAIRE: "Par niveau scolaire",
  HEURES_CUMULEES: "Heures cumulées",
  NB_JOURNEES: "Nombre de journées travaillées",
  JAMAIS: "Jamais",
  SI_EFFECTIF_INSUFFISANT: "Uniquement en cas d'effectif insuffisant",
  TOUJOURS: "Toujours autorisé",
  REDUIRE_AU_NOMBRE_DE_GROUPES: "Réduire l'ouverture au nombre de groupes",
  RENFORT_SUR_UN_GROUPE: "Le surnuméraire reste en renfort",
  AVANCE_PUIS_RETOUR: "Venir en avance puis revenir plus tard",
  LIBRE: "Libre — chacun peut encadrer n'importe quel âge",
  PREFERER: "Privilégier les tranches déclarées",
  IMPOSER: "Imposer — un éducateur n'encadre que ses tranches",
  CHAQUE_JOUR_SEPAREMENT: "Chaque jour planifié séparément",
  MEME_EQUIPE_SUR_LE_BLOC: "Même équipe sur tout le bloc",
  TOUS_GROUPES: "Toute la journée",
  PAR_GROUPE: "Un par groupe",
};

function Terme({ mot, children }: { mot: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="font-medium">{mot}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}

export default async function PageAide() {
  const config = await essayer(() => chargerConfiguration(), null);
  const r = config?.reglages;

  const reglages = r
    ? [
        {
          nom: "Capacité maximale d'un groupe",
          valeur: `${r.capaciteMaxGroupe} élèves`,
          effet:
            "Au-delà, un deuxième groupe est ouvert et les élèves répartis à parts égales.",
        },
        {
          nom: "Ratio maximal",
          valeur: `1 éducateur pour ${r.ratioMaxEleves} élèves`,
          effet:
            "Plafond réglementaire. Il peut être resserré, jamais dépassé : 20 est le maximum permis.",
        },
        {
          nom: "Mode de groupement",
          valeur: LIBELLES[r.modeGroupement],
          effet:
            "Décide si les groupes se forment sur l'âge des élèves ou sur leur classe.",
        },
        {
          nom: "Date de référence de l'âge",
          valeur: `${r.dateReferenceAgeJour} ${MOIS[r.dateReferenceAgeMois - 1]}`,
          effet:
            "L'âge de chaque élève est figé à cette date pour toute l'année : un enfant ne change pas de groupe le jour de son anniversaire.",
        },
        {
          nom: "Critère de départage",
          valeur: LIBELLES[r.critereDepartage],
          effet:
            "Entre deux éducateurs à égalité sur un quart, celui qui en a le moins accumulé passe devant.",
        },
        {
          nom: "Double poste le même jour",
          valeur: LIBELLES[r.doublePoste],
          effet:
            "Autorise ou non un même éducateur sur deux quarts non enchaînés dans la même journée.",
        },
        {
          nom: "Ouverture excédentaire",
          valeur: LIBELLES[r.surEffectifOuverture],
          effet:
            "Que faire quand l'ouverture demande plus d'éducateurs qu'il n'y a de groupes ensuite.",
        },
        {
          nom: "Tranches d'âge des éducateurs",
          valeur: LIBELLES[r.politiqueTrancheEducateur],
          effet:
            "Portée des tranches déclarées sur chaque fiche d'éducateur. En mode « Imposer », une répartition impossible est refusée et expliquée avant la génération.",
        },
        {
          nom: "Bloc de plusieurs jours",
          valeur: LIBELLES[r.politiqueBloc],
          effet:
            "Sur une semaine de relâche, faut-il replanifier chaque jour ou garder la même équipe du lundi au vendredi.",
        },
        {
          nom: "Éviter le même quart deux fois de suite",
          valeur: r.eviterMemeQuartConsecutif ? "Activé" : "Désactivé",
          effet:
            "Évite que la même personne enchaîne les fermetures d'une journée pédagogique à la suivante.",
        },
        {
          nom: "Continuité éducateur / tranche d'âge",
          valeur: r.continuiteTrancheAge ? "Activée" : "Désactivée",
          effet:
            "Cherche à confier à chacun la tranche d'âge qu'il encadre le plus souvent.",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Guide d&apos;utilisation
        </h1>
        <p className="text-sm text-muted-foreground">
          Le vocabulaire, le déroulement d&apos;une journée, et les réglages
          actuellement en vigueur.
        </p>
      </div>

      <div className="space-y-3">
        <SectionAide
          titre="En bref"
          sousTitre="Ce que fait l'application"
          ouvertParDefaut
        >
          <p>
            Lors d&apos;une journée pédagogique, le service de garde accueille
            les élèves toute la journée. Il faut constituer des groupes par âge
            et placer un éducateur devant chaque groupe, à chaque heure de la
            journée, sans dépasser le ratio autorisé — et sans que ce soient
            toujours les mêmes qui ouvrent à 6 h 45 ou ferment à 18 h.
          </p>
          <p>
            L&apos;application tient le compte de ce que chacun a déjà fait
            depuis le début de l&apos;année et propose la répartition la plus
            équilibrée. Elle propose : c&apos;est vous qui validez, et vous
            pouvez toujours permuter deux personnes avant de le faire.
          </p>
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium">L&apos;ordre habituel des choses</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Une fois par an : créer l&apos;année scolaire, vérifier les
                horaires et les tranches d&apos;âge dans les paramètres.
              </li>
              <li>
                Importer ou saisir les élèves et les éducateurs, et déclarer
                pour chacun les tranches d&apos;âge qu&apos;il encadre.
              </li>
              <li>
                Pour chaque journée pédagogique : créer la journée, inscrire les
                élèves, générer, ajuster, valider, exporter.
              </li>
              <li>
                Le jour venu : saisir les absences et les remplacements, puis
                confirmer.
              </li>
              <li>
                À tout moment : consulter l&apos;écart d&apos;équité et corriger
                le tir sur la journée suivante.
              </li>
            </ol>
          </div>
        </SectionAide>

        <SectionAide
          titre="Créer, modifier, supprimer une journée"
          sousTitre="Ce qui reste possible, et à quel moment"
        >
          <p>
            Une journée passe par trois états : <strong>brouillon</strong> tant
            que rien n&apos;est généré, <strong>généré</strong> une fois la
            répartition proposée, <strong>validé</strong> quand vous l&apos;avez
            arrêtée et diffusée.
          </p>
          <p>
            Ce qui décide de ce que vous pouvez encore changer n&apos;est pas
            tant la validation que le fait que la journée ait{" "}
            <strong>déjà été vécue</strong> — c&apos;est-à-dire qu&apos;une
            absence, un remplacement ou une confirmation y ait été saisi. Une
            journée validée mais encore à venir n&apos;est qu&apos;un planning
            affiché : le rouvrir ne coûte qu&apos;une rediffusion. Une journée
            déjà vécue, elle, est le relevé de qui a réellement travaillé, et
            c&apos;est de là que sortent les compteurs d&apos;équité.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Brouillon / Généré</TableHead>
                  <TableHead>Validée, à venir</TableHead>
                  <TableHead>Validée, déjà vécue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Modifier élèves, dispos, planning</TableCell>
                  <TableCell>Oui</TableCell>
                  <TableCell>Après réouverture</TableCell>
                  <TableCell className="text-muted-foreground">Non</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Rouvrir</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>Oui</TableCell>
                  <TableCell className="text-muted-foreground">Non</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Saisir ou corriger les présences</TableCell>
                  <TableCell className="text-muted-foreground">
                    Pas encore
                  </TableCell>
                  <TableCell>Oui</TableCell>
                  <TableCell>Oui, sans limite de délai</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Supprimer</TableCell>
                  <TableCell>Confirmation simple</TableCell>
                  <TableCell>Conséquences annoncées</TableCell>
                  <TableCell>Saisie du nom exigée</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="font-medium">Rouvrir une journée validée</p>
            <p className="text-muted-foreground">
              Le bouton «&nbsp;Rouvrir pour modifier&nbsp;» apparaît en haut de
              la journée. Elle repasse en «&nbsp;généré&nbsp;», les présences
              pré-remplies sont effacées et tout redevient modifiable. Pensez à
              rediffuser le planning après l&apos;avoir revalidée.
            </p>
            <p className="font-medium">Supprimer une journée</p>
            <p className="text-muted-foreground">
              Le bouton se trouve au bas de la page de la journée. Avant de
              confirmer, l&apos;application annonce ce qui disparaît : les
              groupes, les affectations, et surtout les heures qui seront
              retirées des compteurs de chaque éducateur concerné. Ces heures ne
              sont pas stockées mais recalculées : supprimer une journée passée
              modifie donc l&apos;équilibre et influence les prochaines
              affectations. La suppression est définitive, mais elle laisse une
              trace datée dans le journal.
            </p>
          </div>
        </SectionAide>

        <SectionAide
          titre="Les huit étapes d'une journée"
          sousTitre="Ce qu'on attend de vous à chacune"
        >
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Créer la journée</strong> — un nom, une année scolaire, et
              une date ou une plage de dates consécutives.
            </li>
            <li>
              <strong>Sélectionner les élèves</strong> — ceux dont la
              participation est confirmée. Les réponses des parents se
              recueillent en dehors de l&apos;application.
            </li>
            <li>
              <strong>Confirmer les éducateurs disponibles</strong> — tous sont
              cochés d&apos;avance ; décochez les absents. Un éducateur décoché
              n&apos;est pas pénalisé : il passera prioritaire la fois suivante.
            </li>
            <li>
              <strong>Vérifier les tranches et l&apos;effectif</strong> — un
              aperçu, sans rien créer. S&apos;il manque des éducateurs,
              c&apos;est annoncé ici, avant que le planning existant ne soit
              touché.
            </li>
            <li>
              <strong>Générer</strong> — les groupes sont constitués puis les
              éducateurs répartis. Régénérer efface la proposition précédente et
              recalcule tout.
            </li>
            <li>
              <strong>Ajuster</strong> — cochez deux affectations pour permuter
              leurs éducateurs. Chaque permutation est marquée comme manuelle.
            </li>
            <li>
              <strong>Valider</strong> — le planning devient définitif et tout
              le monde est noté présent d&apos;avance : le jour venu, il ne
              reste que les écarts à saisir.
            </li>
            <li>
              <strong>Exporter</strong> — le planning en PDF pour
              l&apos;affichage ou en Excel pour le retraitement, et la feuille
              de présence vierge à imprimer.
            </li>
          </ol>
        </SectionAide>

        <SectionAide
          titre="Le vocabulaire"
          sousTitre="Quart, portée, enchaînement, tranche, écart…"
        >
          <dl className="space-y-3">
            <Terme mot="Année scolaire">
              La période de référence, avec ses propres horaires, tranches
              d&apos;âge et réglages. Les compteurs d&apos;équité repartent de
              zéro à chaque année.
            </Terme>
            <Terme mot="Journée pédagogique">
              Une journée sans classe où le service de garde accueille les
              élèves. Elle peut couvrir plusieurs jours consécutifs — on parle
              alors d&apos;un <em>bloc</em>, comme la semaine de relâche.
            </Terme>
            <Terme mot="Quart">
              Une plage horaire à couvrir : ouverture, matinée, après-midi,
              fermeture. Les horaires ne sont pas figés dans le programme, ils
              se modifient dans les paramètres.
            </Terme>
            <Terme mot="Portée d'un quart">
              «&nbsp;Un par groupe&nbsp;» : il faut un éducateur devant chaque
              groupe. «&nbsp;Toute la journée&nbsp;» : un effectif fixe suffit,
              quel que soit le nombre de groupes — typiquement l&apos;ouverture
              et la fermeture, où les enfants sont réunis.
            </Terme>
            <Terme mot="Enchaînement">
              Certains quarts se poursuivent obligatoirement : qui ouvre
              enchaîne sur la matinée. Affecter quelqu&apos;un à
              l&apos;ouverture consomme donc aussi une place de la matinée —
              c&apos;est pourquoi ouvrir avec deux personnes ne demande pas
              quatre personnes mais deux.
            </Terme>
            <Terme mot="Tranche d'âge">
              Un intervalle d&apos;âges — ou de niveaux scolaires — qui sert à
              regrouper les élèves. Deux tranches ne peuvent pas se chevaucher,
              sans quoi un élève appartiendrait à deux groupes.
            </Terme>
            <Terme mot="Groupe">
              Les élèves d&apos;une même tranche pour une journée donnée. Si la
              tranche dépasse la capacité maximale, elle est scindée en groupes
              d&apos;effectifs équilibrés — 27 élèves donnent 14 et 13, pas 20
              et 7.
            </Terme>
            <Terme mot="Affectation">
              Un éducateur, sur un quart, un jour donné, devant un groupe. Une
              journée générée en compte plusieurs dizaines.
            </Terme>
            <Terme mot="Ratio">
              Le nombre d&apos;élèves présents par éducateur. Contrôlé à chaque
              heure de la journée lors de la saisie des présences.
            </Terme>
            <Terme mot="Compteurs">
              Les heures et le nombre de journées accumulés par chaque
              éducateur. Ils ne sont jamais stockés : ils se recalculent à
              partir des affectations et des présences. Corriger une présence
              deux semaines plus tard corrige donc aussitôt les compteurs.
            </Terme>
            <Terme mot="Écart d'équité">
              La différence entre l&apos;éducateur le plus sollicité et le moins
              sollicité, sur l&apos;année. Les personnes arrivées en cours
              d&apos;année sont comptées à part : sans cela, elles gonfleraient
              artificiellement l&apos;écart.
            </Terme>
            <Terme mot="Double poste">
              Un même éducateur sur deux quarts non enchaînés dans la même
              journée — par exemple l&apos;ouverture et la fermeture.
            </Terme>
            <Terme mot="Remplacement">
              Un éducateur absent dont l&apos;affectation est reprise par un
              autre. Les heures vont au remplaçant, pas au titulaire.
            </Terme>
            <Terme mot="Confirmation">
              La déclaration que la saisie des présences d&apos;un jour est
              terminée. Tant qu&apos;elle manque, le jour est signalé comme
              «&nbsp;à confirmer&nbsp;».
            </Terme>
            <Terme mot="Version de configuration">
              Une photo datée des horaires, tranches et réglages. Chaque
              modification en crée une nouvelle ; les anciennes ne sont jamais
              écrasées. C&apos;est ce qui garantit qu&apos;un changement
              d&apos;horaire en février ne réécrit pas la journée
              d&apos;octobre.
            </Terme>
          </dl>
        </SectionAide>

        <SectionAide
          titre="Vos réglages actuels"
          sousTitre={
            config
              ? `Année ${config.anneeLibelle} — modifiables dans Paramètres`
              : "Configuration momentanément illisible"
          }
        >
          {!config ? (
            <p className="text-muted-foreground">
              Les réglages n&apos;ont pas pu être lus. Le reste du guide reste
              consultable.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Année {config.anneeLibelle}</Badge>
                <Badge variant="secondary">
                  version {config.versionCourante}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href="/parametres" />}
                >
                  Ouvrir les paramètres
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[42rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Réglage</TableHead>
                      <TableHead>Valeur actuelle</TableHead>
                      <TableHead>Ce qu&apos;il change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reglages.map((ligne) => (
                      <TableRow key={ligne.nom}>
                        <TableCell className="font-medium">
                          {ligne.nom}
                        </TableCell>
                        <TableCell>{ligne.valeur}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {ligne.effet}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="font-medium">Horaires en vigueur</p>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[38rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quart</TableHead>
                      <TableHead>Horaire</TableHead>
                      <TableHead>Portée</TableHead>
                      <TableHead className="text-right">Effectif</TableHead>
                      <TableHead>Enchaîne sur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.quarts.map((q) => (
                      <TableRow
                        key={q.id}
                        className={q.actif ? "" : "opacity-50"}
                      >
                        <TableCell className="font-medium">
                          {q.libelle}
                          {!q.actif && (
                            <span className="text-muted-foreground">
                              {" "}
                              (inactif)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {versTexteFr(q.debutMinutes)} –{" "}
                          {versTexteFr(q.finMinutes)}
                        </TableCell>
                        <TableCell>{LIBELLES[q.portee]}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {q.effectifRequis}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {config.quarts.find((a) => a.id === q.enchaineSurId)
                            ?.libelle ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="font-medium">Tranches d&apos;âge</p>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[30rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tranche</TableHead>
                      <TableHead>Âges</TableHead>
                      <TableHead>Niveaux scolaires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.tranches.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.libelle}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {t.ageMin} à {t.ageMax} ans
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.niveauMin === null || t.niveauMax === null
                            ? "non précisés"
                            : t.niveauMin === t.niveauMax
                              ? NIVEAUX_SCOLAIRES[t.niveauMin]
                              : `${NIVEAUX_SCOLAIRES[t.niveauMin]} à ${NIVEAUX_SCOLAIRES[t.niveauMax]}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-muted-foreground">
                {r?.modeGroupement === "AGE_CALCULE"
                  ? "Le groupement se fait actuellement sur l'âge : la colonne des niveaux scolaires ne servirait qu'en mode « Par niveau scolaire »."
                  : "Le groupement se fait actuellement sur le niveau scolaire : ce sont les niveaux, et non les âges, qui décident du groupe d'un élève."}
              </p>

              <p className="text-muted-foreground">
                Les horaires, les tranches et les réglages se modifient dans les
                paramètres ; les tranches encadrées par chaque personne se
                déclarent sur sa fiche, dans{" "}
                <Link href="/educateurs" className="underline">
                  Éducateurs
                </Link>
                .
              </p>
            </>
          )}
        </SectionAide>

        <SectionAide
          titre="Importer et exporter"
          sousTitre="Fichiers Excel, modèles vierges, PDF"
        >
          <p>
            Les élèves et les éducateurs s&apos;importent depuis un fichier
            Excel. À côté de chaque bouton d&apos;import, un modèle vierge se
            télécharge avec les bonnes colonnes et une ligne d&apos;exemple :
            c&apos;est le format attendu.
          </p>
          <p>
            L&apos;import se fait en deux temps. Un aperçu ligne par ligne
            montre d&apos;abord ce qui sera créé, ce qui existe déjà et ce qui
            pose problème ; rien n&apos;est enregistré tant que vous n&apos;avez
            pas confirmé. Un fichier exporté depuis l&apos;application peut être
            corrigé puis réimporté tel quel.
          </p>
          <p>
            Côté sortie : le planning en PDF pour l&apos;affichage, la feuille
            de présence vierge à imprimer, et le planning en Excel pour le
            retraitement. Les fichiers sont produits par l&apos;application
            elle-même : aucune information sur les élèves n&apos;est envoyée
            ailleurs.
          </p>
        </SectionAide>

        <SectionAide
          titre="Ce qui ne se règle pas"
          sousTitre="Les quelques limites qui ne sont pas des paramètres"
        >
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Le ratio d&apos;un éducateur pour vingt élèves</strong>{" "}
              est un plafond réglementaire. Vous pouvez le resserrer, jamais
              l&apos;élargir.
            </li>
            <li>
              <strong>
                Une modification de configuration ne réécrit jamais le passé.
              </strong>{" "}
              Chaque journée générée garde les horaires sous lesquels elle a été
              produite.
            </li>
            <li>
              <strong>Les compteurs ne se saisissent pas à la main.</strong> Ils
              découlent des affectations et des présences ; pour les corriger,
              on corrige une présence.
            </li>
            <li>
              <strong>
                Deux tranches d&apos;âge ne peuvent pas se chevaucher
              </strong>{" "}
              et une tranche déjà utilisée par des groupes ne peut plus être
              supprimée.
            </li>
            <li>
              <strong>Les données restent hébergées au Canada</strong> et
              l&apos;accès à l&apos;application demande une connexion
              nominative.
            </li>
          </ul>
        </SectionAide>
      </div>
    </div>
  );
}
