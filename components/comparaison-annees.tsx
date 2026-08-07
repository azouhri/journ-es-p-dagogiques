import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import type { ResumeAnnee } from "@/lib/data/tableau-bord";
import { cn } from "@/lib/utils";

interface Mesure {
  libelle: string;
  courante: number | null;
  precedente: number | null;
  unite?: string;
  /** Une hausse est-elle une bonne nouvelle ? null = neutre. */
  hausseEstBonne: boolean | null;
}

function Ligne({ mesure }: { mesure: Mesure }) {
  const { courante, precedente } = mesure;
  const comparable =
    courante !== null && precedente !== null && precedente !== 0;
  const ecart = comparable ? courante - precedente : null;
  const pourcent = comparable
    ? Math.round(((courante - precedente) / precedente) * 1000) / 10
    : null;

  // Une variation d'un demi-point n'est pas un mouvement : la signaler comme
  // une hausse ou une baisse ferait lire du bruit comme une tendance.
  const stable = pourcent !== null && Math.abs(pourcent) < 1;
  const Fleche = stable ? ArrowRight : (ecart ?? 0) > 0 ? ArrowUp : ArrowDown;

  const bon =
    mesure.hausseEstBonne === null || stable
      ? null
      : (ecart ?? 0) > 0 === mesure.hausseEstBonne;

  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        {mesure.libelle}
      </span>
      <span className="flex shrink-0 items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {courante === null ? "—" : `${courante}${mesure.unite ?? ""}`}
        </span>
        {pourcent === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs tabular-nums",
              bon === null
                ? "text-muted-foreground"
                : bon
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-amber-600 dark:text-amber-500",
            )}
          >
            <Fleche className="size-3" />
            {stable ? "stable" : `${Math.abs(pourcent)} %`}
          </span>
        )}
      </span>
    </div>
  );
}

/** Comparaison chiffrée avec l'année précédente. */
export function ComparaisonAnnees({
  courante,
  precedente,
}: {
  courante: ResumeAnnee;
  precedente: ResumeAnnee;
}) {
  const mesures: Mesure[] = [
    {
      libelle: "Journées pédagogiques",
      courante: courante.journees,
      precedente: precedente.journees,
      hausseEstBonne: null,
    },
    {
      libelle: "Jours planifiés",
      courante: courante.jours,
      precedente: precedente.jours,
      hausseEstBonne: null,
    },
    {
      libelle: "Élèves par journée",
      courante: courante.moyenneParticipants,
      precedente: precedente.moyenneParticipants,
      hausseEstBonne: null,
    },
    {
      libelle: "Présence des élèves",
      courante: courante.tauxPresenceEleves,
      precedente: precedente.tauxPresenceEleves,
      unite: " %",
      hausseEstBonne: true,
    },
    {
      libelle: "Heures par éducateur",
      courante: courante.moyenneHeures,
      precedente: precedente.moyenneHeures,
      unite: " h",
      hausseEstBonne: null,
    },
  ];

  return (
    <div className="divide-y">
      {mesures.map((m) => (
        <Ligne key={m.libelle} mesure={m} />
      ))}
      <p className="pt-2 text-xs text-muted-foreground">
        Écart par rapport à {precedente.libelle}.
      </p>
    </div>
  );
}
