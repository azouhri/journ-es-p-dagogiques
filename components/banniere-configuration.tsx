import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EtatConnexion } from "@/lib/data/connexion";

/**
 * Bandeau affiché quand la base est injoignable.
 *
 * Volontairement un bandeau et non un écran plein : le reste de la page —
 * notamment la prévisualisation d'import, qui ne touche pas à la base — doit
 * rester accessible et utilisable.
 */
export function BanniereConfiguration({
  etat,
}: {
  etat: Extract<EtatConnexion, { ok: false }>;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{etat.titre}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="font-mono text-xs break-all">{etat.message}</p>
        <p>{etat.detail}</p>
        <p className="text-xs">
          Les listes restent vides et l&apos;enregistrement est désactivé, mais
          la prévisualisation d&apos;un fichier CSV fonctionne : elle ne touche
          pas à la base.
        </p>
      </AlertDescription>
    </Alert>
  );
}
