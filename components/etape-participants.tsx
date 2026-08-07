"use client";

import Link from "next/link";
import { memo, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  classeurParticipants,
  importerParticipants,
} from "@/app/actions/participants";
import { definirParticipants } from "@/app/actions/planification";
import { Aide } from "@/components/aide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EleveSelectionnable {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  age: number | null;
  tranche: string;
}

const HORS_TRANCHE = "hors tranche";

/**
 * Ligne mémoïsée : sans cela, cocher une case re-rendait les 287 lignes et la
 * sélection devenait poussive. Seule la ligne dont `coche` change se redessine.
 */
const Ligne = memo(function Ligne({
  eleve,
  coche,
  surBascule,
  desactive,
}: {
  eleve: EleveSelectionnable;
  coche: boolean;
  surBascule: (id: string) => void;
  desactive: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-accent">
      <input
        type="checkbox"
        className="size-4"
        checked={coche}
        disabled={desactive}
        onChange={() => surBascule(eleve.id)}
      />
      <span className="font-medium">
        {eleve.nom} {eleve.prenom}
      </span>
      <span className="ml-auto flex items-center gap-3 text-muted-foreground">
        <span className="tabular-nums">{eleve.age ?? "—"} ans</span>
        <span className="w-24 text-right text-xs">{eleve.tranche}</span>
      </span>
    </label>
  );
});

export function EtapeParticipants({
  journeeId,
  eleves,
  dejaInscrits,
  verrouille,
}: {
  journeeId: string;
  eleves: EleveSelectionnable[];
  dejaInscrits: string[];
  verrouille: boolean;
}) {
  const [selection, setSelection] = useState<Set<string>>(new Set(dejaInscrits));
  const [recherche, setRecherche] = useState("");
  const [trancheActive, setTrancheActive] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const champFichier = useRef<HTMLInputElement>(null);

  const tranches = useMemo(() => {
    const compte = new Map<string, number>();
    for (const e of eleves) {
      compte.set(e.tranche, (compte.get(e.tranche) ?? 0) + 1);
    }
    return [...compte.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [eleves]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return eleves.filter(
      (e) =>
        (trancheActive === null || e.tranche === trancheActive) &&
        (!terme || `${e.nom} ${e.prenom}`.toLowerCase().includes(terme)),
    );
  }, [eleves, recherche, trancheActive]);

  function basculer(id: string) {
    setSelection((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  function appliquerAuxFiltres(inscrire: boolean) {
    setSelection((precedent) => {
      const suivant = new Set(precedent);
      for (const e of filtres) {
        if (inscrire) suivant.add(e.id);
        else suivant.delete(e.id);
      }
      return suivant;
    });
  }

  function enregistrer() {
    demarrer(async () => {
      const r = await definirParticipants(journeeId, [...selection]);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  }

  function exporter() {
    demarrer(async () => {
      const tampon = await classeurParticipants(journeeId);
      if (!tampon) {
        toast.error("Export impossible");
        return;
      }
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(
        new Blob([tampon], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      lien.download = "participants.xlsx";
      lien.click();
      URL.revokeObjectURL(lien.href);
    });
  }

  function importer(fichier: File) {
    const donnees = new FormData();
    donnees.set("fichier", fichier);

    demarrer(async () => {
      const r = await importerParticipants(journeeId, donnees);
      if (r.ok) {
        toast.success(r.message);
        // La sélection affichée doit refléter ce qui vient d'être enregistré.
        window.location.reload();
      } else {
        toast.error(r.message);
      }
      if (champFichier.current) champFichier.current.value = "";
    });
  }

  const cochesDansFiltre = filtres.filter((e) => selection.has(e.id)).length;

  return (
    <div className="space-y-4">
      {/* Sélection en masse par tranche : le chemin rapide sur 287 élèves. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={trancheActive === null ? "default" : "outline"}
          onClick={() => setTrancheActive(null)}
        >
          Toutes ({eleves.length})
        </Button>
        {tranches.map(([tranche, compte]) => (
          <Button
            key={tranche}
            size="sm"
            variant={trancheActive === tranche ? "default" : "outline"}
            onClick={() => setTrancheActive(tranche)}
          >
            {tranche} ({compte})
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="max-w-xs"
          disabled={verrouille}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={verrouille}
          onClick={() => appliquerAuxFiltres(true)}
        >
          Inscrire les {filtres.length} affichés
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={verrouille}
          onClick={() => appliquerAuxFiltres(false)}
        >
          Retirer les affichés
        </Button>
        <Badge variant="secondary">{selection.size} inscrit(s) au total</Badge>
      </div>

      <div className="max-h-80 overflow-auto rounded-md border">
        {filtres.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Aucun élève ne correspond.
          </p>
        ) : (
          <div className="divide-y">
            {filtres.map((eleve) => (
              <Ligne
                key={eleve.id}
                eleve={eleve}
                coche={selection.has(eleve.id)}
                surBascule={basculer}
                desactive={verrouille}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {cochesDansFiltre} / {filtres.length} coché(s) dans la vue courante.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={verrouille || enCours} onClick={enregistrer}>
          {enCours ? "Enregistrement…" : "Enregistrer les participants"}
        </Button>

        <Button variant="outline" disabled={enCours} onClick={exporter}>
          Exporter la liste (Excel)
        </Button>

        <Button
          variant="outline"
          disabled={verrouille || enCours}
          onClick={() => champFichier.current?.click()}
        >
          Importer une liste
        </Button>
        <input
          ref={champFichier}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importer(f);
          }}
        />

        <Button variant="ghost" render={<Link href="/eleves" />}>
          Ajouter un élève manquant
        </Button>

        <Aide titre="Sélection par fichier">
          <p>
            Le fichier exporté contient tous les élèves actifs avec une colonne
            «&nbsp;Participe&nbsp;».
          </p>
          <p>
            Supprimer les lignes non voulues — ou mettre «&nbsp;non&nbsp;» —
            puis réimporter le fichier. Sur plusieurs centaines d&apos;élèves,
            c&apos;est plus rapide que de cocher.
          </p>
        </Aide>
      </div>
    </div>
  );
}
