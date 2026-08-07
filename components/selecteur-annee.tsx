"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { AnneeOption } from "@/lib/data/tableau-bord";

/** Choix de l'année scolaire affichée. */
export function SelecteurAnnee({
  annees,
  courante,
}: {
  annees: AnneeOption[];
  courante: string;
}) {
  const routeur = useRouter();
  const parametres = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Année</span>
      <select
        value={courante}
        onChange={(e) => {
          const suivants = new URLSearchParams(parametres.toString());
          suivants.set("annee", e.target.value);
          routeur.push(`/?${suivants.toString()}`);
        }}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
      >
        {annees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.libelle}
            {a.statut === "ACTIVE" ? " (en cours)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
