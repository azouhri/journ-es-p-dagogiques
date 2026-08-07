"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { supprimerJournee } from "@/app/actions/journees";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NiveauConfirmation } from "@/lib/domain/cycle-journee";

export interface ApercuSuppressionAffiche {
  nom: string;
  niveau: NiveauConfirmation;
  jours: number;
  groupes: number;
  affectations: number;
  educateursImpactes: number;
  heuresRetirees: number;
  vecue: boolean;
}

/**
 * Suppression d'une journée, avec un effort de confirmation proportionné à ce
 * qui disparaît. Les conséquences sont chiffrées avant la décision, pas
 * annoncées après.
 */
export function SuppressionJournee({
  journeeId,
  apercu,
  retourVers,
}: {
  journeeId: string;
  apercu: ApercuSuppressionAffiche;
  /** Page où revenir une fois la journée supprimée. */
  retourVers?: string;
}) {
  const routeur = useRouter();
  const [ouvert, definirOuvert] = useState(false);
  const [saisie, definirSaisie] = useState("");
  const [enCours, demarrer] = useTransition();

  const nomExige = apercu.niveau === "saisie_du_nom";
  const detaille = apercu.niveau !== "simple";
  const nomCorrect =
    saisie.trim().toLocaleLowerCase("fr") ===
    apercu.nom.trim().toLocaleLowerCase("fr");

  function confirmer() {
    demarrer(async () => {
      const r = await supprimerJournee(journeeId, saisie);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      definirOuvert(false);
      if (retourVers) routeur.push(retourVers);
      else routeur.refresh();
    });
  }

  return (
    <AlertDialog open={ouvert} onOpenChange={definirOuvert}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-destructive">
            Supprimer
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer «&nbsp;{apercu.nom}&nbsp;» ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {apercu.vecue
              ? "Cette journée a déjà eu lieu et ses présences ont été relevées."
              : "Cette action est définitive."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {detaille && (
          <ul className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
            <li>
              {apercu.jours} jour(s) et {apercu.groupes} groupe(s) constitués
            </li>
            <li>{apercu.affectations} affectation(s) d&apos;éducateurs</li>
            {apercu.educateursImpactes > 0 && (
              <li className="font-medium">
                {apercu.heuresRetirees} h retirées aux compteurs de{" "}
                {apercu.educateursImpactes} éducateur(s) : les prochaines
                journées leur seront attribuées en priorité.
              </li>
            )}
          </ul>
        )}

        {nomExige && (
          <div className="space-y-2">
            <Label htmlFor="confirmation-suppression">
              Saisir «&nbsp;{apercu.nom}&nbsp;» pour confirmer
            </Label>
            <Input
              id="confirmation-suppression"
              value={saisie}
              autoComplete="off"
              onChange={(e) => definirSaisie(e.target.value)}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline">Annuler</Button>} />
          <Button
            variant="destructive"
            disabled={enCours || (nomExige && !nomCorrect)}
            onClick={confirmer}
          >
            {enCours ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
