import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { FormulaireAnnee } from "@/components/formulaire-annee";
import { BoutonSupprimerTranche } from "@/components/bouton-supprimer-tranche";
import { FormulaireQuart } from "@/components/formulaire-quart";
import { FormulaireReglages } from "@/components/formulaire-reglages";
import { FormulaireTranche } from "@/components/formulaire-tranche";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chargerConfiguration, listerVersions } from "@/lib/data/configuration";
import { verifierConnexion } from "@/lib/data/connexion";
import { essayer } from "@/lib/data/securise";
import { versTexteFr } from "@/lib/domain/temps";
import { prisma } from "@/lib/prisma";
import { NIVEAUX_SCOLAIRES } from "@/lib/tableur";

const dateJour = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const dateHeure = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

const ETAT_ANNEE: Record<
  string,
  { texte: string; variante: "default" | "secondary" | "outline" }
> = {
  ACTIVE: { texte: "En cours", variante: "default" },
  PREPARATION: { texte: "En préparation", variante: "outline" },
  ARCHIVEE: { texte: "Terminée", variante: "secondary" },
};

export default async function PageParametres() {
  const etat = await verifierConnexion();
  const config = await essayer(() => chargerConfiguration(), null);
  const versions = config
    ? await essayer(() => listerVersions(config.anneeScolaireId), [])
    : [];

  const annees = await essayer(
    () =>
      prisma.anneeScolaire.findMany({
        orderBy: { dateDebut: "desc" },
        include: { _count: { select: { journees: true } } },
      }),
    [],
  );

  // Une tranche déjà utilisée par un groupe ne peut plus être supprimée :
  // l'effacer effacerait la composition d'une journée passée.
  const usages = config
    ? await essayer(
        () =>
          prisma.groupe.groupBy({
            by: ["trancheAgeId"],
            where: { trancheAge: { anneeScolaireId: config.anneeScolaireId } },
            _count: { _all: true },
          }),
        [],
      )
    : [];
  const groupesParTranche = new Map(
    usages.map((u) => [u.trancheAgeId, u._count._all]),
  );

  // Âges laissés de côté entre deux tranches, ou avant la première : un élève
  // qui y tombe ne sera dans aucun groupe.
  const trous: string[] = [];
  if (config && config.tranches.length > 0) {
    const triees = [...config.tranches].sort((a, b) => a.ageMin - b.ageMin);
    for (let i = 1; i < triees.length; i++) {
      const finPrecedente = triees[i - 1].ageMax;
      const debutSuivante = triees[i].ageMin;
      if (debutSuivante > finPrecedente + 1) {
        const de = finPrecedente + 1;
        const a = debutSuivante - 1;
        trous.push(de === a ? `${de} ans` : `${de} à ${a} ans`);
      }
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
        Paramètres
        <Aide titre="Portée des paramètres">
          <p>Ces réglages s&apos;appliquent aux prochaines journées créées.</p>
          <p>
            Les journées déjà planifiées gardent les horaires et les règles en
            vigueur au moment où elles ont été faites : changer un horaire
            aujourd&apos;hui ne modifie rien à ce qui a déjà été travaillé.
          </p>
        </Aide>
      </h1>

      <Tabs defaultValue={config ? "quarts" : "annees"}>
        <TabsList>
          <TabsTrigger value="annees">Années scolaires</TabsTrigger>
          <TabsTrigger value="quarts">Types de quart</TabsTrigger>
          <TabsTrigger value="tranches">Tranches d&apos;âge</TabsTrigger>
          <TabsTrigger value="reglages">Réglages</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        {/* --- Années scolaires ------------------------------------------- */}
        <TabsContent value="annees" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Une seule année est en cours à la fois.
            </p>
            <FormulaireAnnee
              declencheur={<Button>Nouvelle année scolaire</Button>}
            />
          </div>

          {annees.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Aucune année scolaire. En créer une pour commencer à planifier.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Année</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Journées</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annees.map((a) => {
                    const etiquette =
                      ETAT_ANNEE[a.statut] ?? ETAT_ANNEE.PREPARATION;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.libelle}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {dateJour.format(a.dateDebut)} →{" "}
                          {dateJour.format(a.dateFin)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a._count.journees}
                        </TableCell>
                        <TableCell>
                          <Badge variant={etiquette.variante}>
                            {etiquette.texte}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <FormulaireAnnee
                            annee={{
                              id: a.id,
                              libelle: a.libelle,
                              dateDebut: a.dateDebut.toISOString().slice(0, 10),
                              dateFin: a.dateFin.toISOString().slice(0, 10),
                              statut: a.statut,
                            }}
                            declencheur={
                              <Button variant="ghost" size="sm">
                                Modifier
                              </Button>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* --- Types de quart --------------------------------------------- */}
        <TabsContent value="quarts" className="space-y-4">
          {!config ? (
            <AucuneAnnee />
          ) : (
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Quart</TableHead>
                    <TableHead>Horaire</TableHead>
                    <TableHead>Portée</TableHead>
                    <TableHead className="text-right">Effectif</TableHead>
                    <TableHead>Enchaîne sur</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.quarts.map((q) => {
                    const suivant = config.quarts.find(
                      (x) => x.id === q.enchaineSurId,
                    );
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">
                          {q.libelle}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {versTexteFr(q.debutMinutes)} –{" "}
                          {versTexteFr(q.finMinutes)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {q.portee === "TOUS_GROUPES"
                            ? "Tous groupes"
                            : "Par groupe"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {q.effectifRequis}
                          {q.portee === "PAR_GROUPE" && (
                            <span className="text-muted-foreground">
                              {" "}
                              /groupe
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {suivant?.libelle ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={q.actif ? "default" : "secondary"}>
                            {q.actif ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <FormulaireQuart quart={q} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* --- Tranches d'âge --------------------------------------------- */}
        <TabsContent value="tranches" className="space-y-4">
          {!config ? (
            <AucuneAnnee />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Bornes incluses. Les tranches ne peuvent pas se chevaucher.
                </p>
                <FormulaireTranche
                  anneeScolaireId={config.anneeScolaireId}
                  declencheur={<Button>Ajouter une tranche</Button>}
                />
              </div>

              {trous.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  Aucune tranche ne couvre {trous.join(", ")}
                  <Aide titre="Âges non couverts">
                    <p>
                      Un élève dont l&apos;âge ne tombe dans aucune tranche
                      n&apos;est placé dans aucun groupe : il est signalé au
                      moment de préparer la journée, mais il ne sera pas encadré.
                    </p>
                  </Aide>
                </div>
              )}

              {config.tranches.length === 0 ? (
                <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Aucune tranche d&apos;âge. Sans tranche, aucun groupe ne peut
                  être constitué.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table className="min-w-[44rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tranche</TableHead>
                        <TableHead className="text-right">Âge</TableHead>
                        <TableHead>Niveaux scolaires</TableHead>
                        <TableHead className="text-right">Groupes</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {config.tranches.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            {t.libelle}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {t.ageMin === t.ageMax
                              ? `${t.ageMin} ans`
                              : `${t.ageMin} – ${t.ageMax} ans`}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.niveauMin === null || t.niveauMax === null
                              ? "—"
                              : t.niveauMin === t.niveauMax
                                ? NIVEAUX_SCOLAIRES[t.niveauMin]
                                : `${NIVEAUX_SCOLAIRES[t.niveauMin]} → ${NIVEAUX_SCOLAIRES[t.niveauMax]}`}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {groupesParTranche.get(t.id) ?? 0}
                          </TableCell>
                          <TableCell className="space-x-1 text-right">
                            <FormulaireTranche
                              anneeScolaireId={config.anneeScolaireId}
                              tranche={t}
                              declencheur={
                                <Button variant="ghost" size="sm">
                                  Modifier
                                </Button>
                              }
                            />
                            {(groupesParTranche.get(t.id) ?? 0) === 0 && (
                              <BoutonSupprimerTranche
                                id={t.id}
                                libelle={t.libelle}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* --- Réglages ---------------------------------------------------- */}
        <TabsContent value="reglages">
          {!config ? (
            <AucuneAnnee />
          ) : (
            <FormulaireReglages
              anneeScolaireId={config.anneeScolaireId}
              reglages={config.reglages}
            />
          )}
        </TabsContent>

        {/* --- Historique --------------------------------------------------- */}
        <TabsContent value="historique" className="space-y-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Modifications apportées aux paramètres de {config?.anneeLibelle}
            <Aide titre="À quoi sert cet historique">
              <p>
                Chaque modification des horaires, des tranches d&apos;âge ou des
                règles est conservée ici, avec la date et le nombre de journées
                qui s&apos;y rattachent.
              </p>
              <p>
                C&apos;est ce qui garantit qu&apos;un changement d&apos;horaire
                fait en janvier ne modifie pas les heures déjà travaillées en
                septembre : chaque journée reste rattachée aux règles en vigueur
                le jour où elle a été planifiée.
              </p>
              <p>
                L&apos;historique se consulte seulement — on ne réécrit pas le
                passé.
              </p>
            </Aide>
          </p>

          {versions.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Aucune modification enregistrée pour cette année.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Modification</TableHead>
                    <TableHead className="text-right">
                      Journées concernées
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v, i) => (
                    <TableRow key={v.id}>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {dateHeure.format(v.creeeLe)}
                      </TableCell>
                      <TableCell>
                        {v.commentaire ?? "Modification des paramètres"}
                        {i === 0 && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            en vigueur
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v._count.journees}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AucuneAnnee() {
  return (
    <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
      Aucune année scolaire en cours. En désigner une dans l&apos;onglet
      «&nbsp;Années scolaires&nbsp;».
    </div>
  );
}
