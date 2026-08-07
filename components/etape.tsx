import { Aide } from "@/components/aide";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EtatEtape = "fait" | "encours" | "attente";

const ETIQUETTE: Record<EtatEtape, { texte: string; variante: "default" | "secondary" | "outline" }> =
  {
    fait: { texte: "Fait", variante: "default" },
    encours: { texte: "À faire", variante: "secondary" },
    attente: { texte: "En attente", variante: "outline" },
  };

/**
 * Une étape du parcours de planification (§6).
 *
 * Les huit étapes sont TOUJOURS affichées, même celles qui ne sont pas encore
 * accessibles : masquer les étapes suivantes donnait l'impression que la
 * création était incomplète. Une étape en attente est grisée et explique ce
 * qui la débloque.
 */
export function Etape({
  numero,
  titre,
  description,
  aide,
  etat,
  raisonAttente,
  children,
}: {
  numero: number;
  titre: string;
  /** Une ligne, pas un paragraphe. Le détail va dans `aide`. */
  description?: string;
  aide?: React.ReactNode;
  etat: EtatEtape;
  raisonAttente?: string;
  children?: React.ReactNode;
}) {
  const etiquette = ETIQUETTE[etat];

  return (
    <Card className={cn(etat === "attente" && "opacity-60")}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-3 text-base">
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
            {titre}
            {aide && <Aide titre={titre}>{aide}</Aide>}
          </CardTitle>
          <Badge variant={etiquette.variante}>{etiquette.texte}</Badge>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        {etat === "attente" ? (
          <p className="text-sm text-muted-foreground">{raisonAttente}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
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
