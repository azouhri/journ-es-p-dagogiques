"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  creerAnneeScolaire,
  modifierAnneeScolaire,
} from "@/app/actions/annees";
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

export interface AnneeModifiable {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
}

const CHAMP_SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

/** Libellé conventionnel déduit de la date de début : « 2026-2027 ». */
function libelleSuggere(dateDebut: string): string {
  if (!dateDebut) return "";
  const d = new Date(`${dateDebut}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const a = d.getUTCFullYear();
  return d.getUTCMonth() >= 6 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}

export function FormulaireAnnee({
  annee,
  declencheur,
}: {
  annee?: AnneeModifiable;
  declencheur: React.ReactElement;
}) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [dateDebut, setDateDebut] = useState(annee?.dateDebut ?? "");
  const [dateFin, setDateFin] = useState(annee?.dateFin ?? "");
  const [libelle, setLibelle] = useState(annee?.libelle ?? "");
  const [libelleTouche, setLibelleTouche] = useState(Boolean(annee));

  const [etat, action, enCours] = useActionState(
    annee ? modifierAnneeScolaire : creerAnneeScolaire,
    null,
  );

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

  // Le nom se déduit des dates tant que personne ne l'a saisi à la main.
  function changerDebut(valeur: string) {
    setDateDebut(valeur);
    if (!libelleTouche) setLibelle(libelleSuggere(valeur));
    if (dateFin && valeur && dateFin <= valeur) setDateFin("");
  }

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={declencheur} />
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>
              {annee ? "Modifier l'année scolaire" : "Nouvelle année scolaire"}
            </DialogTitle>
            <DialogDescription>
              {annee
                ? "Les journées déjà planifiées doivent rester dans la période."
                : "Les types de quart, tranches d'âge et réglages sont repris de l'année la plus récente."}
            </DialogDescription>
          </DialogHeader>

          {annee && <input type="hidden" name="id" value={annee.id} />}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateDebut">Premier jour</Label>
                <Input
                  id="dateDebut"
                  name="dateDebut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => changerDebut(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dateFin">Dernier jour</Label>
                <Input
                  id="dateFin"
                  name="dateFin"
                  type="date"
                  value={dateFin}
                  min={dateDebut || undefined}
                  disabled={!dateDebut}
                  onChange={(e) => setDateFin(e.target.value)}
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
                placeholder="2026-2027"
                onChange={(e) => {
                  setLibelle(e.target.value);
                  setLibelleTouche(true);
                }}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="statut">État</Label>
              <select
                id="statut"
                name="statut"
                defaultValue={annee?.statut ?? "PREPARATION"}
                className={CHAMP_SELECT}
              >
                <option value="PREPARATION">En préparation</option>
                <option value="ACTIVE">En cours</option>
                <option value="ARCHIVEE">Terminée</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Une seule année peut être en cours : la désigner ainsi termine
                automatiquement la précédente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={enCours || !dateDebut || !dateFin}>
              {enCours ? "Enregistrement…" : annee ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
