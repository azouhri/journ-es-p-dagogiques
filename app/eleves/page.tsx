import { Suspense } from "react";

import {
  basculerActifEleve,
  confirmerImportEleves,
  exporterElevesCsv,
  previsualiserImportEleves,
} from "@/app/actions/eleves";
import { Aide } from "@/components/aide";
import { BarreRecherche } from "@/components/barre-recherche";
import { BoutonBasculeActif } from "@/components/bouton-bascule-actif";
import { BoutonExport } from "@/components/bouton-export";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { FormulaireEleve } from "@/components/formulaire-eleve";
import { ImportCsv } from "@/components/import-csv";
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
import { verifierConnexion } from "@/lib/data/connexion";
import { listerEleves } from "@/lib/data/eleves";
import { essayer } from "@/lib/data/securise";

const NIVEAUX = [
  "Maternelle",
  "1re année",
  "2e année",
  "3e année",
  "4e année",
  "5e année",
  "6e année",
];

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export default async function PageEleves({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const etat = await verifierConnexion();
  const { q, statut = "actifs" } = await searchParams;

  const eleves = await essayer(
    () =>
      listerEleves({
        recherche: q,
        actif: statut === "tous" ? undefined : statut === "actifs",
      }),
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
          Élèves
          <Aide titre="Âge ou niveau scolaire">
            <p>
              La date de naissance est obligatoire, le niveau scolaire est
              facultatif.
            </p>
            <p>
              Les groupes se constituent d&apos;après l&apos;un ou l&apos;autre,
              au choix dans les paramètres.
            </p>
          </Aide>
        </h1>
        <div className="flex gap-2">
          <BoutonExport action={exporterElevesCsv} nomFichier="eleves.csv" />
          <FormulaireEleve declencheur={<Button>Ajouter un élève</Button>} />
        </div>
      </div>

      <Tabs defaultValue={etat.ok ? "liste" : "import"}>
        <TabsList>
          <TabsTrigger value="liste">Liste ({eleves.length})</TabsTrigger>
          <TabsTrigger value="import">Import CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
          <Suspense fallback={null}>
            <BarreRecherche base="/eleves" />
          </Suspense>

          {eleves.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Aucun élève. Utiliser l&apos;onglet «&nbsp;Import CSV&nbsp;» pour
              charger la liste.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Date de naissance</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eleves.map((eleve) => (
                    <TableRow key={eleve.id}>
                      <TableCell className="font-medium">{eleve.nom}</TableCell>
                      <TableCell>{eleve.prenom}</TableCell>
                      <TableCell className="tabular-nums">
                        {dateFr.format(eleve.dateNaissance)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {eleve.niveauScolaire === null
                          ? "—"
                          : (NIVEAUX[eleve.niveauScolaire] ??
                            String(eleve.niveauScolaire))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eleve.actif ? "default" : "secondary"}>
                          {eleve.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <FormulaireEleve
                          eleve={eleve}
                          declencheur={
                            <Button variant="ghost" size="sm">
                              Modifier
                            </Button>
                          }
                        />
                        <BoutonBasculeActif
                          id={eleve.id}
                          actif={eleve.actif}
                          action={basculerActifEleve}
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
          <ImportCsv
            titre="Importer des élèves"
            description="Prévisualisation obligatoire avant enregistrement. Les doublons sont détectés sur nom + prénom + date de naissance."
            colonnesAttendues={[
              "nom (obligatoire)",
              "prénom (obligatoire)",
              "date de naissance (obligatoire)",
              "niveau scolaire (0 à 6, facultatif)",
              "notes (facultatif)",
            ]}
            exempleCsv={
              "nom;prenom;date de naissance;niveau scolaire;notes\n" +
              "Côté;Alice;2017-04-12;3;\n" +
              "Tremblay;Hugo;12/09/2016;4;allergie aux arachides"
            }
            previsualiser={previsualiserImportEleves}
            confirmer={confirmerImportEleves}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
