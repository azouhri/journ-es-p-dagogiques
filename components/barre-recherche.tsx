"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Recherche et filtre par statut (§5.1, §5.2). */
export function BarreRecherche({ base }: { base: string }) {
  const router = useRouter();
  const parametres = useSearchParams();
  const [terme, setTerme] = useState(parametres.get("q") ?? "");
  const statut = parametres.get("statut") ?? "actifs";

  // Recherche différée : on ne relance pas une requête à chaque frappe.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const suivants = new URLSearchParams(parametres.toString());
      if (terme) suivants.set("q", terme);
      else suivants.delete("q");
      router.replace(`${base}?${suivants.toString()}`);
    }, 300);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terme]);

  function changerStatut(valeur: string) {
    const suivants = new URLSearchParams(parametres.toString());
    suivants.set("statut", valeur);
    router.replace(`${base}?${suivants.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Rechercher par nom ou prénom…"
        value={terme}
        onChange={(e) => setTerme(e.target.value)}
        className="max-w-xs"
      />
      {[
        { valeur: "actifs", libelle: "Actifs" },
        { valeur: "inactifs", libelle: "Inactifs" },
        { valeur: "tous", libelle: "Tous" },
      ].map((option) => (
        <Button
          key={option.valeur}
          size="sm"
          variant={statut === option.valeur ? "default" : "outline"}
          onClick={() => changerStatut(option.valeur)}
        >
          {option.libelle}
        </Button>
      ))}
    </div>
  );
}
