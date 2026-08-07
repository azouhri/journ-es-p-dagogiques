"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { creerJournee } from "@/app/actions/journees";
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

/** Nombre de jours entre deux dates ISO, bornes incluses. */
function compterJours(debut: string, fin: string): number {
  const d = Date.parse(`${debut}T00:00:00Z`);
  const f = Date.parse(`${fin}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(f) || f < d) return 0;
  return Math.round((f - d) / 86_400_000) + 1;
}

/** §6 étape 1 — créer la journée : nom, date unique ou plage consécutive. */
export function FormulaireJournee() {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [etat, action, enCours] = useActionState(creerJournee, null);

  useEffect(() => {
    if (!etat) return;
    if (etat.ok) {
      toast.success(etat.message);
      setOuvert(false);
      setDateDebut("");
      setDateFin("");
      // On enchaîne directement sur le parcours de planification : sans cela,
      // la journée est créée mais rien n'indique où poursuivre.
      if (etat.id) routeur.push(`/journees/${etat.id}`);
    } else {
      toast.error(etat.message);
    }
  }, [etat, routeur]);

  // La date de fin ne peut pas précéder la date de début : le calendrier
  // l'interdit, et une date de fin devenue antérieure est effacée plutôt que
  // laissée dans un état invalide.
  function changerDebut(valeur: string) {
    setDateDebut(valeur);
    if (dateFin && valeur && dateFin < valeur) setDateFin("");
  }

  const nbJours = compterJours(dateDebut, dateFin || dateDebut);

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={<Button>Nouvelle journée pédagogique</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Créer une journée pédagogique</DialogTitle>
            <DialogDescription>
              Laisser la date de fin vide pour une journée unique. Renseignée,
              elle crée un bloc de jours consécutifs, chacun planifié séparément.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                name="nom"
                placeholder="Journée pédagogique de novembre"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateDebut">Date</Label>
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
                <Label htmlFor="dateFin">Date de fin (facultatif)</Label>
                <Input
                  id="dateFin"
                  name="dateFin"
                  type="date"
                  value={dateFin}
                  // Le sélecteur natif grise tout ce qui précède la date de début.
                  min={dateDebut || undefined}
                  disabled={!dateDebut}
                  onChange={(e) => setDateFin(e.target.value)}
                />
              </div>
            </div>

            {dateDebut && (
              <p className="text-sm text-muted-foreground">
                {nbJours <= 1
                  ? "Journée unique."
                  : `Bloc de ${nbJours} jours consécutifs — ${nbJours} plannings seront générés.`}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={enCours || !dateDebut}>
              {enCours ? "Création…" : "Créer et planifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
