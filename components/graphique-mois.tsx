import type { MoisJournees } from "@/lib/data/tableau-bord";

/**
 * Répartition des journées pédagogiques sur l'année scolaire.
 *
 * Série unique : une seule teinte, aucune légende — le titre dit déjà ce qui
 * est représenté. Les valeurs ne sont pas inscrites sur chaque colonne ; seule
 * la plus haute est étiquetée, l'axe porte le reste, et le survol donne le
 * détail. Un mois sans journée reste visible : un creux est une information.
 */
export function GraphiqueMois({ mois }: { mois: MoisJournees[] }) {
  const maximum = Math.max(...mois.map((m) => m.journees), 1);
  // Graduations entières : le nombre de journées ne prend jamais de décimale.
  const graduations = Array.from({ length: maximum + 1 }, (_, i) => maximum - i);

  return (
    <figure className="m-0">
      <div className="flex gap-3">
        {/* Axe des ordonnées, volontairement discret. */}
        <div
          className="flex flex-col justify-between py-[2px] text-[10px] tabular-nums text-muted-foreground"
          aria-hidden
        >
          {graduations.map((g) => (
            <span key={g} className="leading-none">
              {g}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Lignes de repère : traits pleins d'un pas au-dessus du fond. */}
          <div
            className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            aria-hidden
          >
            {graduations.map((g) => (
              <div key={g} className="h-px w-full bg-border" />
            ))}
          </div>

          {/* Les colonnes. L'écart de 2px entre voisines est ce qui les sépare. */}
          <div className="relative flex h-32 items-end gap-[2px]">
            {mois.map((m) => (
              <div
                key={m.cle}
                className="group flex min-w-0 flex-1 justify-center"
                title={
                  m.journees === 0
                    ? `${m.libelle} : aucune journée`
                    : `${m.libelle} : ${m.journees} journée(s), ${m.jours} jour(s) planifié(s)`
                }
              >
                <div
                  className="relative w-full max-w-6 rounded-t bg-primary transition-opacity group-hover:opacity-80"
                  style={{
                    height:
                      m.journees === 0
                        ? "2px"
                        : `${(m.journees / maximum) * 100}%`,
                    // Un mois vide garde un trait au ras de la ligne de base :
                    // sans lui, la colonne disparaît et le mois semble absent.
                    opacity: m.journees === 0 ? 0.25 : 1,
                  }}
                >
                  {m.journees === maximum && m.journees > 0 && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium tabular-nums text-foreground">
                      {m.journees}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Ligne de base */}
          <div className="h-px w-full bg-border" />

          <div className="mt-1 flex gap-[2px]">
            {mois.map((m) => (
              <span
                key={m.cle}
                className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground"
              >
                {m.libelle}
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        Nombre de journées pédagogiques par mois :{" "}
        {mois.map((m) => `${m.libelle} ${m.journees}`).join(", ")}.
      </figcaption>
    </figure>
  );
}
