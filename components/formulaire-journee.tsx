"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
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

export interface AnneeSelectionnable {
  id: string;
  libelle: string;
  /** Bornes au format ISO, telles qu'attendues par un champ date. */
  dateDebut: string;
  dateFin: string;
  statut: string;
}

const CHAMP_SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

function compterJours(debut: string, fin: string): number {
  const d = Date.parse(`${debut}T00:00:00Z`);
  const f = Date.parse(`${fin}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(f) || f < d) return 0;
  return Math.round((f - d) / 86_400_000) + 1;
}

const enFrancais = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * §6 étape 1 — créer la journée.
 *
 * L'année scolaire se choisit EN PREMIER, et les champs de date sont bornés à
 * sa période. Auparavant, l'année était devinée côté serveur : on pouvait
 * remplir tout le formulaire, cliquer, et n'apprendre qu'ensuite qu'aucune
 * année ne couvrait ces dates. Le calendrier interdit désormais le cas.
 */
export function FormulaireJournee({
  annees,
}: {
  annees: AnneeSelectionnable[];
}) {
  const routeur = useRouter();
  const [ouvert, setOuvert] = useState(false);

  const defaut = useMemo(
    () => annees.find((a) => a.statut === "ACTIVE") ?? annees[0],
    [annees],
  );

  const [anneeId, setAnneeId] = useState(defaut?.id ?? "");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [etat, action, enCours] = useActionState(creerJournee, null);

  const annee = annees.find((a) => a.id === anneeId) ?? defaut;

  useEffect(() => {
    if (!etat) return;
    if (etat.ok) {
      toast.success(etat.message);
      setOuvert(false);
      setDateDebut("");
      setDateFin("");
      if (etat.id) routeur.push(`/journees/${etat.id}`);
    } else {
      toast.error(etat.message);
    }
  }, [etat, routeur]);

  // Changer d'année invalide des dates choisies pour la précédente.
  function changerAnnee(id: string) {
    setAnneeId(id);
    const suivante = annees.find((a) => a.id === id);
    if (!suivante) return;
    if (dateDebut && (dateDebut < suivante.dateDebut || dateDebut > suivante.dateFin)) {
      setDateDebut("");
      setDateFin("");
    }
  }

  function changerDebut(valeur: string) {
    setDateDebut(valeur);
    if (dateFin && valeur && dateFin < valeur) setDateFin("");
  }

  const nbJours = compterJours(dateDebut, dateFin || dateDebut);

  if (annees.length === 0) {
    return (
      <Button disabled title="Créer d'abord une année scolaire">
        Nouvelle journée pédagogique
      </Button>
    );
  }

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DialogTrigger render={<Button>Nouvelle journée pédagogique</Button>} />
      <DialogContent className="sm:max-w-lg">
        <form action={action}>
          <DialogHeader>
            <DialogTitle>Créer une journée pédagogique</DialogTitle>
            <DialogDescription>
              Laisser la date de fin vide pour une journée unique. Renseignée,
              elle crée un bloc de jours consécutifs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="anneeScolaireId">Année scolaire</Label>
              <select
                id="anneeScolaireId"
                name="anneeScolaireId"
                value={anneeId}
                onChange={(e) => changerAnnee(e.target.value)}
                className={CHAMP_SELECT}
              >
                {annees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.libelle}
                    {a.statut === "ACTIVE" ? " (en cours)" : ""}
                  </option>
                ))}
              </select>
              {annee && (
                <p className="text-xs text-muted-foreground">
                  Du {enFrancais(annee.dateDebut)} au {enFrancais(annee.dateFin)}.
                </p>
              )}
            </div>

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
                  // Le calendrier grise tout ce qui sort de l'année choisie.
                  min={annee?.dateDebut}
                  max={annee?.dateFin}
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
                  min={dateDebut || annee?.dateDebut}
                  max={annee?.dateFin}
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
            <Button type="submit" disabled={enCours || !dateDebut || !anneeId}>
              {enCours ? "Création…" : "Créer et planifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
