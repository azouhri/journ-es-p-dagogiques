"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Déclenche un export CSV.
 *
 * Le fichier est fabriqué côté serveur puis téléchargé depuis le navigateur :
 * aucune donnée d'élève ne transite par un service tiers (§12).
 */
export function BoutonExport({
  action,
  nomFichier,
  libelle = "Exporter en CSV",
}: {
  action: () => Promise<string>;
  nomFichier: string;
  libelle?: string;
}) {
  const [enCours, demarrer] = useTransition();

  function exporter() {
    demarrer(async () => {
      try {
        const csv = await action();
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(
          new Blob([csv], { type: "text/csv;charset=utf-8" }),
        );
        lien.download = nomFichier;
        lien.click();
        URL.revokeObjectURL(lien.href);
      } catch (erreur) {
        toast.error("Export impossible", {
          description: erreur instanceof Error ? erreur.message : String(erreur),
        });
      }
    });
  }

  return (
    <Button variant="outline" onClick={exporter} disabled={enCours}>
      {enCours ? "Export en cours…" : libelle}
    </Button>
  );
}
