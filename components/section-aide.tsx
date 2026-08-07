"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Une section du guide, repliable.
 *
 * Le guide couvre tout l'outil : déplié d'un bloc, il serait illisible. Seule
 * la première section s'ouvre d'elle-même, le reste se parcourt par ses
 * titres.
 */
export function SectionAide({
  titre,
  sousTitre,
  ouvertParDefaut = false,
  children,
}: {
  titre: string;
  sousTitre?: string;
  ouvertParDefaut?: boolean;
  children: React.ReactNode;
}) {
  const [ouvert, definirOuvert] = useState(ouvertParDefaut);

  return (
    <Collapsible open={ouvert} onOpenChange={definirOuvert}>
      <div className="rounded-md border">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-t-md px-4 py-3 text-left hover:bg-accent/50"
            />
          }
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{titre}</span>
            {sousTitre && (
              <span className="block truncate text-sm text-muted-foreground">
                {sousTitre}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !ouvert && "-rotate-90",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t p-4 text-sm">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
