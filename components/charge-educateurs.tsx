import type { ChargeEducateur } from "@/lib/data/tableau-bord";
import { dureeEnTexte } from "@/lib/domain/temps";
import { cn } from "@/lib/utils";

/**
 * Charge de travail des éducateurs, du plus au moins sollicité.
 *
 * Les heures seules induisent en erreur : quelqu'un embauché en cours
 * d'année affiche peu d'heures sans avoir été lésé pour autant. Le nombre de
 * JOURS travaillés est donc affiché à côté, et la barre compare chacun au
 * plus chargé — c'est ce rapport, pas le total brut, qui dit s'il y a un
 * déséquilibre.
 */
export function ChargeEducateurs({ charges }: { charges: ChargeEducateur[] }) {
  const presents = charges.filter((c) => c.journees > 0);

  if (presents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune affectation cette année.
      </p>
    );
  }

  const maximum = Math.max(...presents.map((c) => c.minutes), 1);
  const maxJours = Math.max(...presents.map((c) => c.journees), 1);
  const jamais = charges.filter((c) => c.journees === 0);

  return (
    <div className="space-y-2">
      {presents.map((c) => {
        // Un éducateur présent sur nettement moins de jours que les autres
        // n'est pas « moins sollicité » : il est arrivé plus tard, ou il a
        // été indisponible. On le signale plutôt que de le laisser passer
        // pour un oubli de rotation.
        const partiel = c.journees < maxJours * 0.7;

        return (
          <div key={c.nom} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{c.nom}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-xs text-muted-foreground">
                  {c.journees} j{partiel ? " · partiel" : ""}
                </span>
                <span className="font-medium">{dureeEnTexte(c.minutes)}</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  partiel ? "bg-muted-foreground/40" : "bg-primary",
                )}
                style={{ width: `${(c.minutes / maximum) * 100}%` }}
              />
            </div>
          </div>
        );
      })}

      {jamais.length > 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          {jamais.length} éducateur(s) sans aucune affectation cette année.
        </p>
      )}
    </div>
  );
}
