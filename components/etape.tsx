"use client";

import { ChevronDown } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

import { Aide } from "@/components/aide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type EtatEtape = "fait" | "encours" | "attente";

const ETIQUETTE: Record<
  EtatEtape,
  { texte: string; variante: "default" | "secondary" | "outline" }
> = {
  fait: { texte: "Fait", variante: "default" },
  encours: { texte: "À faire", variante: "secondary" },
  attente: { texte: "En attente", variante: "outline" },
};

/**
 * Ordre de dépliage venu du bouton « Tout déplier / Tout replier ».
 *
 * Le jeton s'incrémente à chaque clic : sans lui, replier tout puis rouvrir
 * une étape à la main empêcherait un second « Tout replier » d'agir, la valeur
 * du contexte n'ayant pas changé.
 */
const ContexteDepliage = createContext<{ jeton: number; ouvrir: boolean }>({
  jeton: 0,
  ouvrir: false,
});

/**
 * Une étape du parcours de planification (§6).
 *
 * Les huit étapes sont TOUJOURS présentes, même celles qui ne sont pas encore
 * accessibles : les masquer donnait l'impression que la création était
 * incomplète. Mais toutes dépliées, la page devenait un mur. Seule l'étape en
 * cours s'ouvre donc d'elle-même ; ce qui est fait ou en attente reste replié,
 * son titre et son état suffisant à s'y retrouver.
 */
export function Etape({
  numero,
  titre,
  description,
  aide,
  etat,
  raisonAttente,
  resume,
  children,
}: {
  numero: number;
  titre: string;
  /** Une ligne, pas un paragraphe. Le détail va dans `aide`. */
  description?: string;
  aide?: React.ReactNode;
  etat: EtatEtape;
  raisonAttente?: string;
  /** Ce que l'étape contient, visible sans la déplier. */
  resume?: string;
  children?: React.ReactNode;
}) {
  const etiquette = ETIQUETTE[etat];
  const [ouvert, definirOuvert] = useState(etat === "encours");
  const depliage = useContext(ContexteDepliage);

  useEffect(() => {
    if (depliage.jeton > 0) definirOuvert(depliage.ouvrir);
  }, [depliage.jeton, depliage.ouvrir]);

  return (
    <Collapsible open={ouvert} onOpenChange={definirOuvert}>
      <Card className={cn("gap-0 py-0", etat === "attente" && "opacity-60")}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-t-xl px-4 py-4 text-left hover:bg-accent/50 sm:px-6"
            />
          }
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
              etat === "fait"
                ? "bg-primary text-primary-foreground"
                : etat === "encours"
                  ? "bg-foreground text-background"
                  : "border border-muted-foreground/40 text-muted-foreground",
            )}
          >
            {etat === "fait" ? "✓" : numero}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{titre}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {resume ?? description}
            </span>
          </span>

          <Badge variant={etiquette.variante} className="shrink-0">
            {etiquette.texte}
          </Badge>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !ouvert && "-rotate-90",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 border-t px-4 py-4 sm:px-6">
            {/* L'en-tête montre déjà `resume ?? description` : on ne répète
                la description ici que si le résumé l'a évincée. */}
            {(aide || (resume && description)) && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {resume && description}
                {aide && <Aide titre={titre}>{aide}</Aide>}
              </p>
            )}
            {etat === "attente" ? (
              <p className="text-sm text-muted-foreground">{raisonAttente}</p>
            ) : (
              children
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/** Enveloppe les étapes et pilote leur dépliage d'ensemble. */
export function Parcours({ children }: { children: React.ReactNode }) {
  const [ordre, definirOrdre] = useState({ jeton: 0, ouvrir: false });

  return (
    <ContexteDepliage.Provider value={ordre}>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            definirOrdre((o) => ({ jeton: o.jeton + 1, ouvrir: !o.ouvrir }))
          }
        >
          {ordre.ouvrir ? "Tout replier" : "Tout déplier"}
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </ContexteDepliage.Provider>
  );
}

/** Fil d'Ariane des huit étapes, pour situer où l'on en est. */
export function FilEtapes({ etats }: { etats: EtatEtape[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {etats.map((etat, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs",
              etat === "fait"
                ? "bg-primary text-primary-foreground"
                : etat === "encours"
                  ? "bg-foreground text-background"
                  : "border border-muted-foreground/30 text-muted-foreground",
            )}
          >
            {etat === "fait" ? "✓" : i + 1}
          </span>
          {i < etats.length - 1 && (
            <span className="h-px w-4 bg-border" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}
