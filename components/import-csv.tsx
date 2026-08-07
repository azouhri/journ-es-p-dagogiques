"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Aide } from "@/components/aide";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Forme minimale commune aux rapports d'import élèves et éducateurs. */
export interface RapportAffichable {
  lignes: Array<{
    numeroLigne: number;
    valeurs: string[];
    erreurs: string[];
    statut: "nouveau" | "doublon_fichier" | "doublon_base" | "erreur";
  }>;
  entetesManquantes: string[];
  nbNouveaux: number;
  nbDoublons: number;
  nbErreurs: number;
  separateur: string;
}

const ETIQUETTES: Record<
  RapportAffichable["lignes"][number]["statut"],
  { texte: string; variante: "default" | "secondary" | "destructive" | "outline" }
> = {
  nouveau: { texte: "Nouveau", variante: "default" },
  doublon_fichier: { texte: "Doublon (fichier)", variante: "secondary" },
  doublon_base: { texte: "Doublon (déjà en base)", variante: "secondary" },
  erreur: { texte: "Erreur", variante: "destructive" },
};

export function ImportCsv({
  titre,
  description,
  colonnesAttendues,
  exempleCsv,
  previsualiser,
  confirmer,
}: {
  titre: string;
  description: string;
  colonnesAttendues: string[];
  exempleCsv: string;
  previsualiser: (texte: string) => Promise<RapportAffichable>;
  confirmer: (texte: string) => Promise<{ importes: number; ignores: number }>;
}) {
  const [texte, setTexte] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [rapport, setRapport] = useState<RapportAffichable | null>(null);
  const [enCours, demarrer] = useTransition();
  const champFichier = useRef<HTMLInputElement>(null);

  async function choisirFichier(fichier: File) {
    // Lu en UTF-8 ; le BOM éventuel est retiré côté analyse.
    const contenu = await fichier.text();
    setTexte(contenu);
    setNomFichier(fichier.name);
    setRapport(null);

    demarrer(async () => {
      try {
        setRapport(await previsualiser(contenu));
      } catch (erreur) {
        toast.error("Lecture du fichier impossible", {
          description: erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
    });
  }

  function importer() {
    if (!texte) return;
    demarrer(async () => {
      try {
        const resultat = await confirmer(texte);
        toast.success(
          `${resultat.importes} ligne(s) importée(s)`,
          resultat.ignores > 0
            ? { description: `${resultat.ignores} ligne(s) ignorée(s).` }
            : undefined,
        );
        setTexte(null);
        setRapport(null);
        setNomFichier(null);
        if (champFichier.current) champFichier.current.value = "";
      } catch (erreur) {
        toast.error("Import impossible", {
          description: erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
    });
  }

  const bloquant =
    rapport !== null &&
    (rapport.entetesManquantes.length > 0 || rapport.nbNouveaux === 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{titre}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={champFichier}
            type="file"
            accept=".csv,text/csv"
            disabled={enCours}
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) void choisirFichier(fichier);
            }}
          />

          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {colonnesAttendues.length} colonnes reconnues
            <Aide titre="Format attendu">
              <p className="font-medium text-foreground">Colonnes</p>
              <p>{colonnesAttendues.join(" · ")}</p>
              <p className="font-medium text-foreground">Exemple</p>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {exempleCsv}
              </pre>
              <p>
                Séparateur point-virgule ou virgule, accents et majuscules
                indifférents dans les en-têtes. Dates acceptées : 2017-04-12 ou
                12/04/2017.
              </p>
            </Aide>
          </p>
        </CardContent>
      </Card>

      {rapport && (
        <Card>
          <CardHeader>
            <CardTitle>Prévisualisation — {nomFichier}</CardTitle>
            <CardDescription>
              Rien n&apos;est encore enregistré. Vérifier le rapport avant
              d&apos;importer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rapport.entetesManquantes.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Colonnes obligatoires absentes</AlertTitle>
                <AlertDescription>
                  {rapport.entetesManquantes.join(", ")}. Aucune ligne ne peut
                  être importée tant que le fichier ne les contient pas.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge>{rapport.nbNouveaux} à importer</Badge>
              <Badge variant="secondary">{rapport.nbDoublons} doublon(s)</Badge>
              <Badge variant={rapport.nbErreurs > 0 ? "destructive" : "outline"}>
                {rapport.nbErreurs} erreur(s)
              </Badge>
              <Badge variant="outline">
                séparateur «&nbsp;{rapport.separateur === "\t" ? "tab" : rapport.separateur}&nbsp;»
              </Badge>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ligne</TableHead>
                    <TableHead className="w-48">Statut</TableHead>
                    <TableHead>Contenu</TableHead>
                    <TableHead>Anomalies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rapport.lignes.map((ligne) => {
                    const etiquette = ETIQUETTES[ligne.statut];
                    return (
                      <TableRow key={ligne.numeroLigne}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {ligne.numeroLigne}
                        </TableCell>
                        <TableCell>
                          <Badge variant={etiquette.variante}>
                            {etiquette.texte}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate text-sm">
                          {ligne.valeurs.join(" · ")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ligne.erreurs.join(" ")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={importer} disabled={enCours || bloquant}>
                {enCours
                  ? "Import en cours…"
                  : `Importer ${rapport.nbNouveaux} ligne(s)`}
              </Button>
              <span className="text-sm text-muted-foreground">
                Les doublons et les lignes en erreur sont ignorés.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
