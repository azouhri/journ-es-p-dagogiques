"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { supprimerTrancheAge } from "@/app/actions/configuration";
import { Button } from "@/components/ui/button";

export function BoutonSupprimerTranche({
  id,
  libelle,
}: {
  id: string;
  libelle: string;
}) {
  const routeur = useRouter();
  const [enCours, demarrer] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={enCours}
      onClick={() => {
        if (
          !window.confirm(
            `Supprimer la tranche « ${libelle} » ? Les élèves de cet âge ne seront plus regroupés tant qu'une autre tranche ne les couvre pas.`,
          )
        ) {
          return;
        }
        demarrer(async () => {
          const r = await supprimerTrancheAge(id);
          if (r.ok) {
            toast.success(r.message);
            routeur.refresh();
          } else {
            toast.error(r.message);
          }
        });
      }}
    >
      Supprimer
    </Button>
  );
}
