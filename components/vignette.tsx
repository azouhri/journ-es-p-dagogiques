import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Vignette d'indicateur : libellé, valeur, précision.
 *
 * La valeur utilise les chiffres proportionnels de la police, pas
 * `tabular-nums` : aligner verticalement n'a de sens qu'en colonne, et à cette
 * taille les chiffres à chasse fixe paraissent lâches.
 */
export function Vignette({
  libelle,
  valeur,
  precision,
  href,
  ton = "neutre",
}: {
  libelle: string;
  valeur: string | number;
  precision?: string;
  href?: string;
  ton?: "neutre" | "attention" | "alerte";
}) {
  const contenu = (
    <Card
      className={cn(
        "h-full",
        href && "transition-colors hover:border-primary/40",
        ton === "attention" && "border-amber-500/40",
        ton === "alerte" && "border-destructive/50",
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{libelle}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold",
            ton === "alerte" && "text-destructive",
          )}
        >
          {valeur}
        </p>
        {precision && (
          <p className="mt-0.5 text-xs text-muted-foreground">{precision}</p>
        )}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {contenu}
    </Link>
  ) : (
    contenu
  );
}
