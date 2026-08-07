"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export interface Resultat {
  ok: boolean;
  message: string;
}

/** Bouton qui déclenche une action serveur et rapporte son résultat. */
export function BoutonAction({
  action,
  libelle,
  libelleEnCours,
  variant = "default",
  disabled,
  confirmation,
}: {
  action: () => Promise<Resultat>;
  libelle: string;
  libelleEnCours?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  disabled?: boolean;
  confirmation?: string;
}) {
  const [enCours, demarrer] = useTransition();

  return (
    <Button
      variant={variant}
      disabled={enCours || disabled}
      onClick={() => {
        if (confirmation && !window.confirm(confirmation)) return;
        demarrer(async () => {
          try {
            const resultat = await action();
            if (resultat.ok) toast.success(resultat.message);
            else toast.error(resultat.message);
          } catch (erreur) {
            toast.error("Action impossible", {
              description:
                erreur instanceof Error ? erreur.message : String(erreur),
            });
          }
        });
      }}
    >
      {enCours ? (libelleEnCours ?? "En cours…") : libelle}
    </Button>
  );
}
