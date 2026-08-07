"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { enregistrerEleve } from "@/app/actions/eleves";
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
import { Textarea } from "@/components/ui/textarea";

export interface EleveModifiable {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: Date;
  niveauScolaire: number | null;
  notes: string | null;
}

const NIVEAUX = [
  { valeur: "", libelle: "Non renseigné" },
  { valeur: "0", libelle: "Maternelle" },
  { valeur: "1", libelle: "1re année" },
  { valeur: "2", libelle: "2e année" },
  { valeur: "3", libelle: "3e année" },
  { valeur: "4", libelle: "4e année" },
  { valeur: "5", libelle: "5e année" },
  { valeur: "6", libelle: "6e année" },
];

export function FormulaireEleve({
  eleve,
  declencheur,
}: {
  eleve?: EleveModifiable;
  declencheur: React.ReactElement;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionState(enregistrerEleve, null);

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
              {eleve ? "Modifier l'élève" : "Ajouter un élève"}
            </DialogTitle>
            <DialogDescription>
              La date de naissance est obligatoire : c&apos;est elle qui permet
              de constituer les groupes par âge.
            </DialogDescription>
          </DialogHeader>

          {eleve && <input type="hidden" name="id" value={eleve.id} />}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" name="nom" defaultValue={eleve?.nom} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  name="prenom"
                  defaultValue={eleve?.prenom}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateNaissance">Date de naissance</Label>
                <Input
                  id="dateNaissance"
                  name="dateNaissance"
                  type="date"
                  defaultValue={eleve?.dateNaissance.toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="niveauScolaire">Niveau scolaire</Label>
                <select
                  id="niveauScolaire"
                  name="niveauScolaire"
                  defaultValue={eleve?.niveauScolaire?.toString() ?? ""}
                  className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  {NIVEAUX.map((n) => (
                    <option key={n.valeur} value={n.valeur}>
                      {n.libelle}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={eleve?.notes ?? ""} />
            </div>
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
