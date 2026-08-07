"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { enregistrerTypeQuart } from "@/app/actions/configuration";
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
import { versTexte } from "@/lib/domain/temps";

export interface QuartModifiable {
  id: string;
  code: string;
  libelle: string;
  debutMinutes: number;
  finMinutes: number;
  portee: string;
  effectifRequis: number;
  actif: boolean;
}

export function FormulaireQuart({ quart }: { quart: QuartModifiable }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState(enregistrerTypeQuart, null);

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
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Modifier
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>{quart.libelle}</DialogTitle>
            <DialogDescription>
              Modifier ce quart crée une nouvelle version de configuration. Les
              journées déjà générées conservent les horaires sous lesquels elles
              ont été produites.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={quart.id} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`libelle-${quart.id}`}>Libellé</Label>
              <Input
                id={`libelle-${quart.id}`}
                name="libelle"
                defaultValue={quart.libelle}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`debut-${quart.id}`}>Début</Label>
                <Input
                  id={`debut-${quart.id}`}
                  name="debut"
                  type="time"
                  defaultValue={versTexte(quart.debutMinutes)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`fin-${quart.id}`}>Fin</Label>
                <Input
                  id={`fin-${quart.id}`}
                  name="fin"
                  type="time"
                  defaultValue={versTexte(quart.finMinutes)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`effectif-${quart.id}`}>
                  {quart.portee === "TOUS_GROUPES" ? "Effectif" : "Par groupe"}
                </Label>
                <Input
                  id={`effectif-${quart.id}`}
                  name="effectifRequis"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={quart.effectifRequis}
                  required
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="actif"
                defaultChecked={quart.actif}
                className="size-4"
              />
              Quart actif — utilisé par la génération
              <Aide titre="Désactiver un quart">
                <p>
                  Désactiver un quart n&apos;efface pas son historique : les
                  quarts déjà travaillés restent visibles au tableau
                  d&apos;équité, dans une colonne marquée inactive.
                </p>
              </Aide>
            </label>
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
