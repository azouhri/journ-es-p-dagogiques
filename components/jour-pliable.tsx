"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Un jour de saisie des présences, repliable.
 *
 * Un bloc de plusieurs jours affiche autant de sections que de jours, chacune
 * avec tous ses groupes : tout déplier d'emblée rend la page inutilisable. Les
 * jours DÉJÀ CONFIRMÉS sont donc repliés par défaut — c'est ce qui reste à
 * faire qu'on veut voir en arrivant.
 */
export function JourPliable({
  titre,
  confirme,
  resume,
  alerte,
  children,
}: {
  titre: string;
  confirme: boolean;
  resume: string;
  alerte?: string | null;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(!confirme);

  return (
    <Collapsible open={ouvert} onOpenChange={setOuvert}>
      <div className="rounded-md border">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50"
            />
          }
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !ouvert && "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{titre}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {resume}
            </span>
          </span>
          {alerte && (
            <Badge variant="destructive" className="shrink-0">
              {alerte}
            </Badge>
          )}
          <Badge variant={confirme ? "default" : "secondary"} className="shrink-0">
            {confirme ? "Confirmée" : "À confirmer"}
          </Badge>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t p-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
