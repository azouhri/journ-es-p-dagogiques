import type { MoisJournees } from "@/lib/data/tableau-bord";
import { cn } from "@/lib/utils";

/**
 * Répartition des journées pédagogiques sur l'année scolaire.
 *
 * Série unique : une seule teinte, aucune légende — le titre dit déjà ce qui
 * est représenté. Seule la colonne la plus haute est étiquetée ; l'axe porte
 * le reste et le survol donne le détail. Un mois sans journée garde un trait
 * au ras de la ligne de base : un creux est une information, pas un trou.
 *
 * Attention à la structure : la hauteur d'une colonne est un POURCENTAGE, il
 * lui faut donc un parent de hauteur connue. Chaque colonne prend toute la
 * hauteur (`h-full`) et pousse sa barre vers le bas (`justify-end`) ; aligner
 * la rangée avec `items-end` ferait au contraire retomber les parents sur la
 * hauteur de leur contenu, et toutes les barres s'écraseraient.
 */
export function GraphiqueMois({ mois }: { mois: MoisJournees[] }) {
  const maximum = Math.max(...mois.map((m) => m.journees), 1);
  const graduations = Array.from({ length: maximum + 1 }, (_, i) => maximum - i);

  // L'année civile n'est rappelée qu'au changement, pour ne pas répéter
  // « 2025 » onze fois.
  let anneePrecedente: number | null = null;

  return (
    <figure className="m-0">
      <div className="flex gap-3">
        <div
          className="flex h-32 flex-col justify-between text-[10px] tabular-nums text-muted-foreground"
          aria-hidden
        >
          {graduations.map((g) => (
            <span key={g} className="-translate-y-1/2 leading-none">
              {g}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative">
            <div
              className="pointer-events-none absolute inset-0 flex flex-col justify-between"
              aria-hidden
            >
              {graduations.map((g) => (
                <div key={g} className="h-px w-full bg-border" />
              ))}
            </div>

            <div className="relative flex h-32 gap-[2px]">
              {mois.map((m) => (
                <div
                  key={m.cle}
                  className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={
                    m.journees === 0
                      ? `${m.libelle} ${m.annee} : aucune journée`
                      : `${m.libelle} ${m.annee} : ${m.journees} journée(s), ${m.jours} jour(s) planifié(s)`
                  }
                >
                  <div className="relative flex justify-center">
                    {m.journees === maximum && (
                      <span className="absolute -top-4 text-[10px] font-medium tabular-nums text-foreground">
                        {m.journees}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mx-auto w-full max-w-6 rounded-t transition-opacity group-hover:opacity-70",
                      m.journees === 0
                        ? "bg-muted-foreground/25"
                        : m.horsAnnee
                          ? "bg-amber-500"
                          : "bg-primary",
                    )}
                    style={{
                      height:
                        m.journees === 0
                          ? "2px"
                          : `${Math.max((m.journees / maximum) * 100, 4)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-border" />

          <div className="mt-1 flex gap-[2px]">
            {mois.map((m) => {
              const nouvelleAnnee = m.annee !== anneePrecedente;
              anneePrecedente = m.annee;
              return (
                <span
                  key={m.cle}
                  className="min-w-0 flex-1 text-center text-[10px] leading-tight text-muted-foreground"
                >
                  <span className="block truncate">{m.libelle}</span>
                  {nouvelleAnnee && (
                    <span className="block truncate opacity-60">{m.annee}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        Nombre de journées pédagogiques par mois :{" "}
        {mois.map((m) => `${m.libelle} ${m.annee} : ${m.journees}`).join(", ")}.
      </figcaption>
    </figure>
  );
}
