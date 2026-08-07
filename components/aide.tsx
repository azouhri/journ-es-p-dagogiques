"use client";

import { HelpCircle } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Explication repliée derrière une icône.
 *
 * Les règles de ce domaine demandent souvent un paragraphe pour être
 * justifiées — ratio réglementaire, gel des horaires, report d'équité. Les
 * laisser en clair sur l'écran noie l'information de travail sous de la
 * documentation. Elles restent accessibles d'un clic, sans occuper la page.
 */
export function Aide({
  titre,
  children,
  className,
}: {
  titre?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={titre ? `Aide : ${titre}` : "Aide"}
            className={cn(
              "inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              className,
            )}
          />
        }
      >
        <HelpCircle className="size-4" />
      </PopoverTrigger>

      <PopoverContent className="max-w-sm text-sm">
        {titre && <PopoverTitle className="mb-1 font-medium">{titre}</PopoverTitle>}
        <div className="space-y-2 text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
