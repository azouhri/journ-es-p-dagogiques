"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { definirDisponibilites } from "@/app/actions/planification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface EducateurSelectionnable {
  id: string;
  nom: string;
  prenom: string;
}

/**
 * §6 étape 3 — tous cochés par défaut ; la responsable décoche les absents.
 * C'est aussi ainsi qu'on déclare un temps partiel : il n'y a pas de champ
 * dédié, l'indisponibilité se dit journée par journée (§13 q6).
 */
export function EtapeDisponibilites({
  jourPlanifieId,
  educateurs,
  indisponiblesInitiaux,
  verrouille,
}: {
  jourPlanifieId: string;
  educateurs: EducateurSelectionnable[];
  indisponiblesInitiaux: string[];
  verrouille: boolean;
}) {
  const [indisponibles, setIndisponibles] = useState<Set<string>>(
    new Set(indisponiblesInitiaux),
  );
  const [enCours, demarrer] = useTransition();

  function basculer(id: string) {
    setIndisponibles((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  const disponibles = educateurs.length - indisponibles.size;

  return (
    <div className="space-y-3">
      <Badge variant="secondary">{disponibles} disponible(s)</Badge>

      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {educateurs.map((e) => {
          const dispo = !indisponibles.has(e.id);
          return (
            <label
              key={e.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <input
                type="checkbox"
                className="size-4"
                checked={dispo}
                disabled={verrouille}
                onChange={() => basculer(e.id)}
              />
              <span className={dispo ? "" : "text-muted-foreground line-through"}>
                {e.nom} {e.prenom}
              </span>
            </label>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={verrouille || enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await definirDisponibilites(jourPlanifieId, [
              ...indisponibles,
            ]);
            if (r.ok) toast.success(r.message);
            else toast.error(r.message);
          })
        }
      >
        {enCours ? "Enregistrement…" : "Enregistrer les disponibilités"}
      </Button>
    </div>
  );
}
