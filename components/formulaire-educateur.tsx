"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { enregistrerEducateur } from "@/app/actions/educateurs";
import { Aide } from "@/components/aide";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EducateurModifiable {
  id: string;
  nom: string;
  prenom: string;
  courriel: string | null;
  statutEmploi: string;
  dateEmbauche: Date | null;
  /** Identifiants des tranches d'âge déclarées. */
  tranchesIds: string[];
}

export interface TrancheOption {
  id: string;
  libelle: string;
}

const STATUTS = [
  { valeur: "TEMPS_PLEIN", libelle: "Temps plein" },
  { valeur: "TEMPS_PARTIEL", libelle: "Temps partiel" },
  { valeur: "OCCASIONNEL", libelle: "Occasionnel" },
  { valeur: "REMPLACANT", libelle: "Remplaçant" },
];

export function FormulaireEducateur({
  educateur,
  tranches = [],
  declencheur,
}: {
  educateur?: EducateurModifiable;
  tranches?: TrancheOption[];
  declencheur: React.ReactElement;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState(enregistrerEducateur, null);

  useEffect(() => {
    if (!etat) return;
    if (etat.ok) {
      toast.success(etat.message);
      setOuvert(false);
    } else {
      toast.error(etat.message);
    }
  }, [etat]);

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={declencheur} />
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>
              {educateur ? "Modifier l'éducateur" : "Ajouter un éducateur"}
            </DialogTitle>
            <DialogDescription>
              Le statut d&apos;emploi est informatif : l&apos;équité ne le
              pondère pas. Une indisponibilité se déclare journée par journée.
            </DialogDescription>
          </DialogHeader>

          {educateur && <input type="hidden" name="id" value={educateur.id} />}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" name="nom" defaultValue={educateur?.nom} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  name="prenom"
                  defaultValue={educateur?.prenom}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                name="courriel"
                type="email"
                defaultValue={educateur?.courriel ?? ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="statutEmploi">Statut d&apos;emploi</Label>
                <select
                  id="statutEmploi"
                  name="statutEmploi"
                  defaultValue={educateur?.statutEmploi ?? "TEMPS_PLEIN"}
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {STATUTS.map((s) => (
                    <option key={s.valeur} value={s.valeur}>
                      {s.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateEmbauche">Date d&apos;embauche</Label>
                <Input
                  id="dateEmbauche"
                  name="dateEmbauche"
                  type="date"
                  defaultValue={
                    educateur?.dateEmbauche?.toISOString().slice(0, 10) ?? ""
                  }
                />
              </div>
            </div>

            {tranches.length > 0 && (
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  Tranches d&apos;âge encadrées
                  <Aide titre="Tranches encadrées">
                    <p>
                      Aucune case cochée = toutes les tranches.
                    </p>
                    <p>
                      Ce choix ne contraint la génération que si la politique
                      correspondante est activée dans les réglages.
                    </p>
                  </Aide>
                </Label>
                <div className="grid gap-1 sm:grid-cols-2">
                  {tranches.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="tranches"
                        value={t.id}
                        defaultChecked={educateur?.tranchesIds.includes(t.id)}
                        className="size-4"
                      />
                      {t.libelle}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
