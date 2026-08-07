"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  saisirPresenceEducateur,
  saisirPresenceEleve,
} from "@/app/actions/presences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUTS_ELEVE = [
  { valeur: "PRESENT", libelle: "Présent" },
  { valeur: "ABSENT", libelle: "Absent" },
  { valeur: "PARTI_TOT", libelle: "Parti tôt" },
] as const;

const STATUTS_EDUCATEUR = [
  { valeur: "PRESENT", libelle: "Présent" },
  { valeur: "ABSENT", libelle: "Absent" },
  { valeur: "REMPLACE", libelle: "Remplacé" },
] as const;

export interface PresenceEleveAffichee {
  id: string;
  nom: string;
  statut: "PRESENT" | "ABSENT" | "PARTI_TOT";
}

export interface PresenceEducateurAffichee {
  id: string;
  nom: string;
  quart: string;
  groupe: string | null;
  statut: "PRESENT" | "ABSENT" | "REMPLACE";
  remplacantId: string | null;
}

function Choix<T extends string>({
  options,
  valeur,
  surChoix,
  desactive,
}: {
  options: readonly { valeur: T; libelle: string }[];
  valeur: T;
  surChoix: (v: T) => void;
  desactive: boolean;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <Button
          key={o.valeur}
          size="sm"
          variant={valeur === o.valeur ? "default" : "outline"}
          disabled={desactive}
          onClick={() => surChoix(o.valeur)}
        >
          {o.libelle}
        </Button>
      ))}
    </div>
  );
}

export function LignePresenceEleve({
  presence,
  verrouille,
}: {
  presence: PresenceEleveAffichee;
  verrouille: boolean;
}) {
  const [enCours, demarrer] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-0">
      <span className="text-sm">{presence.nom}</span>
      <Choix
        options={STATUTS_ELEVE}
        valeur={presence.statut}
        desactive={verrouille || enCours}
        surChoix={(v) =>
          demarrer(async () => {
            const r = await saisirPresenceEleve(presence.id, v);
            if (!r.ok) toast.error(r.message);
          })
        }
      />
    </div>
  );
}

export function LignePresenceEducateur({
  presence,
  remplacants,
  verrouille,
}: {
  presence: PresenceEducateurAffichee;
  remplacants: { id: string; nom: string }[];
  verrouille: boolean;
}) {
  const [enCours, demarrer] = useTransition();

  function enregistrer(
    statut: "PRESENT" | "ABSENT" | "REMPLACE",
    remplacantId: string | null,
  ) {
    demarrer(async () => {
      const r = await saisirPresenceEducateur(presence.id, statut, remplacantId);
      if (!r.ok) toast.error(r.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2 last:border-0">
      <div className="text-sm">
        <span className="font-medium">{presence.nom}</span>
        <span className="ml-2 text-muted-foreground">
          {presence.quart}
          {presence.groupe ? ` · ${presence.groupe}` : " · tous groupes"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {presence.statut === "REMPLACE" && (
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            defaultValue={presence.remplacantId ?? ""}
            disabled={verrouille || enCours}
            onChange={(e) => enregistrer("REMPLACE", e.target.value || null)}
          >
            <option value="">Choisir un remplaçant…</option>
            {remplacants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </select>
        )}
        {presence.statut === "REMPLACE" && !presence.remplacantId && (
          <Badge variant="destructive" className="text-xs">
            remplaçant à désigner
          </Badge>
        )}
        <Choix
          options={STATUTS_EDUCATEUR}
          valeur={presence.statut}
          desactive={verrouille || enCours}
          surChoix={(v) =>
            enregistrer(v, v === "REMPLACE" ? presence.remplacantId : null)
          }
        />
      </div>
    </div>
  );
}
