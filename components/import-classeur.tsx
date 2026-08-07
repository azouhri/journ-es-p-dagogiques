"use client";

import { Download, FileSpreadsheet } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Forme minimale commune aux rapports d'import. */
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
}

const ETIQUETTES: Record<
  RapportAffichable["lignes"][number]["statut"],
  { texte: string; variante: "default" | "secondary" | "destructive" | "outline" }
> = {
  nouveau: { texte: "Nouveau", variante: "default" },
  doublon_fichier: { texte: "En double", variante: "secondary" },
  doublon_base: { texte: "Déjà enregistré", variante: "secondary" },
  erreur: { texte: "Erreur", variante: "destructive" },
};

export function ImportClasseur({
  titre,
  description,
  colonnes,
  urlModele,
  previsualiser,
  confirmer,
}: {
  titre: string;
  description: string;
  colonnes: string[];
  urlModele: string;
  previsualiser: (donnees: FormData) => Promise<RapportAffichable>;
  confirmer: (donnees: FormData) => Promise<{ importes: number; ignores: number }>;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [rapport, setRapport] = useState<RapportAffichable | null>(null);
  const [enCours, demarrer] = useTransition();
  const champFichier = useRef<HTMLInputElement>(null);

  function reinitialiser() {
    setFichier(null);
    setRapport(null);
    if (champFichier.current) champFichier.current.value = "";
  }

  function choisir(choisi: File) {
    setFichier(choisi);
    setRapport(null);

    const donnees = new FormData();
    donnees.set("fichier", choisi);

    demarrer(async () => {
      try {
        setRapport(await previsualiser(donnees));
      } catch (erreur) {
        toast.error("Lecture du fichier impossible", {
          description:
            erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
    });
  }

  function importer() {
    if (!fichier) return;
    const donnees = new FormData();
    donnees.set("fichier", fichier);

    demarrer(async () => {
      try {
        const resultat = await confirmer(donnees);
        toast.success(
          `${resultat.importes} ligne(s) importée(s)`,
          resultat.ignores > 0
            ? { description: `${resultat.ignores} ligne(s) ignorée(s).` }
            : undefined,
        );
        reinitialiser();
      } catch (erreur) {
        toast.error("Import impossible", {
          description:
            erreur instanceof Error ? erreur.message : String(erreur),
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
          {/* Le modèle vierge d'abord : c'est le point de départ pour qui n'a
              pas encore de fichier. */}
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-4">
            <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Pas encore de fichier ?</p>
              <p className="text-xs text-muted-foreground">
                Télécharger le modèle Excel, le remplir, puis le déposer ici.
              </p>
            </div>
            <Button variant="outline" size="sm" render={<a href={urlModele} />}>
              <Download />
              Modèle Excel
            </Button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="classeur"
              className="flex items-center gap-1.5 text-sm font-medium"
            >
              Fichier Excel à importer
              <Aide titre="Colonnes attendues">
                <p>{colonnes.join(" · ")}</p>
                <p>
                  L&apos;ordre des colonnes n&apos;a pas d&apos;importance, et
                  les accents ou majuscules des en-têtes sont indifférents.
                </p>
              </Aide>
            </label>
            <input
              ref={champFichier}
              id="classeur"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={enCours}
              onChange={(e) => {
                const choisi = e.target.files?.[0];
                if (choisi) choisir(choisi);
              }}
              className="block w-full cursor-pointer rounded-md border border-input text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium"
            />
          </div>
        </CardContent>
      </Card>

      {rapport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Vérification — {fichier?.name}
            </CardTitle>
            <CardDescription>
              Rien n&apos;est encore enregistré.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rapport.entetesManquantes.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Colonnes manquantes</AlertTitle>
                <AlertDescription>
                  {rapport.entetesManquantes.join(", ")}. Utiliser le modèle
                  Excel pour repartir sur les bonnes colonnes.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge>{rapport.nbNouveaux} à importer</Badge>
              <Badge variant="secondary">{rapport.nbDoublons} en double</Badge>
              <Badge variant={rapport.nbErreurs > 0 ? "destructive" : "outline"}>
                {rapport.nbErreurs} erreur(s)
              </Badge>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ligne</TableHead>
                    <TableHead className="w-44">Statut</TableHead>
                    <TableHead>Contenu</TableHead>
                    <TableHead>À corriger</TableHead>
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
                          {ligne.valeurs.filter(Boolean).join(" · ")}
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

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={importer} disabled={enCours || bloquant}>
                {enCours
                  ? "Import en cours…"
                  : `Importer ${rapport.nbNouveaux} ligne(s)`}
              </Button>
              <Button variant="ghost" onClick={reinitialiser} disabled={enCours}>
                Annuler
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
