"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { enregistrerTrancheAge } from "@/app/actions/configuration";
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
import { NIVEAUX_SCOLAIRES } from "@/lib/tableur";

export interface TrancheModifiable {
  id: string;
  libelle: string;
  ageMin: number;
  ageMax: number;
  niveauMin: number | null;
  niveauMax: number | null;
}

const CHAMP_SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

export function FormulaireTranche({
  anneeScolaireId,
  tranche,
  declencheur,
}: {
  anneeScolaireId: string;
  tranche?: TrancheModifiable;
  declencheur: React.ReactElement;
}) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [ageMin, setAgeMin] = useState(String(tranche?.ageMin ?? ""));
  const [ageMax, setAgeMax] = useState(String(tranche?.ageMax ?? ""));
  const [libelle, setLibelle] = useState(tranche?.libelle ?? "");
  const [libelleTouche, setLibelleTouche] = useState(Boolean(tranche));

  const [etat, action, enCours] = useActionState(enregistrerTrancheAge, null);

  useEffect(() => {
    if (!etat) return;
    if (etat.ok) {
      toast.success(etat.message);
      setOuvert(false);
      routeur.refresh();
    } else {
      toast.error(etat.message);
    }
  }, [etat, routeur]);

  // Le nom se déduit des bornes tant que personne ne l'a saisi à la main.
  function suggerer(min: string, max: string) {
    if (libelleTouche || !min || !max) return;
    setLibelle(min === max ? `${min} ans` : `${min}-${max} ans`);
  }

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={declencheur} />
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>
              {tranche ? "Modifier la tranche" : "Nouvelle tranche d'âge"}
            </DialogTitle>
            <DialogDescription>
              Les bornes sont incluses. Les journées déjà planifiées gardent
              leurs groupes.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
          {tranche && <input type="hidden" name="id" value={tranche.id} />}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ageMin">Âge minimum</Label>
                <Input
                  id="ageMin"
                  name="ageMin"
                  type="number"
                  min={0}
                  max={21}
                  value={ageMin}
                  onChange={(e) => {
                    setAgeMin(e.target.value);
                    suggerer(e.target.value, ageMax);
                  }}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ageMax">Âge maximum</Label>
                <Input
                  id="ageMax"
                  name="ageMax"
                  type="number"
                  min={ageMin || 0}
                  max={21}
                  value={ageMax}
                  onChange={(e) => {
                    setAgeMax(e.target.value);
                    suggerer(ageMin, e.target.value);
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="libelle">Nom</Label>
              <Input
                id="libelle"
                name="libelle"
                value={libelle}
                placeholder="8-9 ans"
                onChange={(e) => {
                  setLibelle(e.target.value);
                  setLibelleTouche(true);
                }}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                Niveaux scolaires correspondants
                <Aide titre="Pourquoi deux découpages">
                  <p>
                    Les groupes se constituent d&apos;après l&apos;âge ou
                    d&apos;après le niveau scolaire, au choix dans les réglages.
                  </p>
                  <p>
                    Renseigner les deux permet de basculer de l&apos;un à
                    l&apos;autre sans rien ressaisir.
                  </p>
                </Aide>
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <select
                  name="niveauMin"
                  defaultValue={tranche?.niveauMin?.toString() ?? ""}
                  className={CHAMP_SELECT}
                >
                  <option value="">Du…</option>
                  {NIVEAUX_SCOLAIRES.map((n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ))}
                </select>
                <select
                  name="niveauMax"
                  defaultValue={tranche?.niveauMax?.toString() ?? ""}
                  className={CHAMP_SELECT}
                >
                  <option value="">Au…</option>
                  {NIVEAUX_SCOLAIRES.map((n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : tranche ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
