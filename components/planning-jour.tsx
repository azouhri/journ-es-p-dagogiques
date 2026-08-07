"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { permuterAffectations } from "@/app/actions/planification";
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

export interface AffectationAffichee {
  id: string;
  quartCode: string;
  quartLibelle: string;
  horaire: string;
  educateur: string;
  groupe: string | null;
  justification: string | null;
  issueEnchainement: boolean;
  ajusteeManuellement: boolean;
}

/**
 * §6 étape 6 — ajuster : permutation manuelle de deux éducateurs.
 * Le système signale que l'ajustement peut dégrader l'équité, sans l'interdire.
 */
export function PlanningJour({
  affectations,
  verrouille,
}: {
  affectations: AffectationAffichee[];
  verrouille: boolean;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [enCours, demarrer] = useTransition();

  function basculer(id: string) {
    setSelection((precedent) =>
      precedent.includes(id)
        ? precedent.filter((x) => x !== id)
        : [...precedent, id].slice(-2),
    );
  }

  const parQuart = new Map<string, AffectationAffichee[]>();
  for (const a of affectations) {
    parQuart.set(a.quartLibelle, [...(parQuart.get(a.quartLibelle) ?? []), a]);
  }

  return (
    <div className="space-y-4">
      {selection.length === 2 && !verrouille && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <span>
            Permuter les deux éducateurs sélectionnés ? Cela peut dégrader
            l&apos;équité : l&apos;affectation d&apos;origine découlait des
            compteurs.
          </span>
          <Button
            size="sm"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await permuterAffectations(selection[0], selection[1]);
                if (r.ok) {
                  toast.success(r.message);
                  setSelection([]);
                } else toast.error(r.message);
              })
            }
          >
            {enCours ? "Permutation…" : "Permuter"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection([])}>
            Annuler
          </Button>
        </div>
      )}

      {[...parQuart.entries()].map(([quart, lignes]) => (
        <div key={quart} className="rounded-md border">
          <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
            {quart}
            <span className="ml-2 font-normal text-muted-foreground">
              {lignes[0]?.horaire}
            </span>
          </div>
          <Table className="min-w-[44rem]">
            <TableHeader>
              <TableRow>
                {!verrouille && <TableHead className="w-10" />}
                <TableHead>Éducateur</TableHead>
                <TableHead>Groupe</TableHead>
                <TableHead>Justification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((a) => (
                <TableRow key={a.id}>
                  {!verrouille && (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={selection.includes(a.id)}
                        onChange={() => basculer(a.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.educateur}
                      {a.issueEnchainement && (
                        <Badge variant="outline" className="text-xs">
                          enchaînement
                        </Badge>
                      )}
                      {a.ajusteeManuellement && (
                        <Badge variant="secondary" className="text-xs">
                          ajusté
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.groupe ?? "tous groupes"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.justification ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
