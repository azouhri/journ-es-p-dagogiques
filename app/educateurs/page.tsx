import { Suspense } from "react";

import {
  basculerActifEducateur,
  confirmerImportEducateurs,
  previsualiserImportEducateurs,
} from "@/app/actions/educateurs";
import { Aide } from "@/components/aide";
import { BarreRecherche } from "@/components/barre-recherche";
import { BoutonBasculeActif } from "@/components/bouton-bascule-actif";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { FormulaireEducateur } from "@/components/formulaire-educateur";
import { ImportClasseur } from "@/components/import-classeur";
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
import { chargerConfiguration } from "@/lib/data/configuration";
import { verifierConnexion } from "@/lib/data/connexion";
import { listerEducateurs } from "@/lib/data/educateurs";
import { essayer } from "@/lib/data/securise";

const STATUTS: Record<string, string> = {
  TEMPS_PLEIN: "Temps plein",
  TEMPS_PARTIEL: "Temps partiel",
  OCCASIONNEL: "Occasionnel",
  REMPLACANT: "Remplaçant",
};

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export default async function PageEducateurs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const etat = await verifierConnexion();
  const { q, statut = "actifs" } = await searchParams;

  const educateurs = await essayer(
    () =>
      listerEducateurs({
        recherche: q,
        actif: statut === "tous" ? undefined : statut === "actifs",
      }),
    [],
  );

  // Tranches de l'année active : ce sont elles qu'un éducateur déclare encadrer.
  const config = await essayer(() => chargerConfiguration(), null);
  const tranches = config?.tranches.map((t) => ({
    id: t.id,
    libelle: t.libelle,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
          Éducateurs
          <Aide titre="Désactivation et tranches">
            <p>
              Désactiver un éducateur ne supprime ni ses affectations passées ni
              ses compteurs : l&apos;historique d&apos;équité reste intact.
            </p>
            <p>
              Les tranches encadrées ne contraignent la génération que si la
              politique correspondante est activée dans les réglages. Sans
              tranche déclarée, l&apos;éducateur peut encadrer tous les âges.
            </p>
          </Aide>
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<a href="/classeurs/educateurs.xlsx" />}>
            Exporter en Excel
          </Button>
          <FormulaireEducateur
            tranches={tranches}
            declencheur={<Button>Ajouter un éducateur</Button>}
          />
        </div>
      </div>

      <Tabs defaultValue={etat.ok ? "liste" : "import"}>
        <TabsList>
          <TabsTrigger value="liste">Liste ({educateurs.length})</TabsTrigger>
          <TabsTrigger value="import">Importer</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
          <Suspense fallback={null}>
            <BarreRecherche base="/educateurs" />
          </Suspense>

          {educateurs.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Aucun éducateur. Utiliser l&apos;onglet «&nbsp;Importer&nbsp;»
              pour charger la liste depuis un fichier Excel.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Courriel</TableHead>
                    <TableHead>Statut d&apos;emploi</TableHead>
                    <TableHead>Tranches encadrées</TableHead>
                    <TableHead>Embauche</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {educateurs.map((educateur) => (
                    <TableRow key={educateur.id}>
                      <TableCell className="font-medium">
                        {educateur.nom}
                      </TableCell>
                      <TableCell>{educateur.prenom}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {educateur.courriel ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {STATUTS[educateur.statutEmploi] ??
                          educateur.statutEmploi}
                      </TableCell>
                      <TableCell>
                        {educateur.tranches.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            toutes
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {educateur.tranches.map((t) => (
                              <Badge
                                key={t.trancheAge.id}
                                variant="outline"
                                className="text-xs"
                              >
                                {t.trancheAge.libelle}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {educateur.dateEmbauche
                          ? dateFr.format(educateur.dateEmbauche)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={educateur.actif ? "default" : "secondary"}
                        >
                          {educateur.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <FormulaireEducateur
                          educateur={{
                            ...educateur,
                            tranchesIds: educateur.tranches.map(
                              (t) => t.trancheAge.id,
                            ),
                          }}
                          tranches={tranches}
                          declencheur={
                            <Button variant="ghost" size="sm">
                              Modifier
                            </Button>
                          }
                        />
                        <BoutonBasculeActif
                          id={educateur.id}
                          actif={educateur.actif}
                          action={basculerActifEducateur}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="import">
          <ImportClasseur
            titre="Importer des éducateurs"
            description="Vérification avant enregistrement : les doublons sont repérés sur le courriel."
            colonnes={[
              "Nom (obligatoire)",
              "Prénom (obligatoire)",
              "Courriel (facultatif)",
              "Statut (facultatif)",
              "Date d'embauche (facultatif)",
            ]}
            urlModele="/classeurs/modele-educateurs.xlsx"
            previsualiser={previsualiserImportEducateurs}
            confirmer={confirmerImportEducateurs}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
