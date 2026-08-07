"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Active ou désactive une personne.
 *
 * §5.2 — désactiver n'efface jamais l'historique : ni les affectations
 * passées, ni les compteurs d'équité. C'est un simple booléen.
 */
export function BoutonBasculeActif({
  id,
  actif,
  action,
}: {
  id: string;
  actif: boolean;
  action: (id: string) => Promise<void>;
}) {
  const [enCours, demarrer] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          try {
            await action(id);
            toast.success(actif ? "Désactivé" : "Réactivé", {
              description: "L'historique est conservé.",
            });
          } catch (erreur) {
            toast.error("Modification impossible", {
              description:
                erreur instanceof Error ? erreur.message : String(erreur),
            });
          }
        })
      }
    >
      {actif ? "Désactiver" : "Réactiver"}
    </Button>
  );
}
