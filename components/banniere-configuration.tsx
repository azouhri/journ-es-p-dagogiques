import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { EtatConnexion } from "@/lib/data/connexion";

/**
 * Bandeau affiché quand les données ne sont pas joignables.
 *
 * Volontairement un bandeau et non un écran plein : le reste de la page —
 * notamment la prévisualisation d'un import, qui ne touche pas à la base —
 * doit rester utilisable.
 */
export function BanniereConfiguration({
  etat,
}: {
  etat: Extract<EtatConnexion, { ok: false }>;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{etat.titre}</AlertTitle>
      <AlertDescription>{etat.message}</AlertDescription>
    </Alert>
  );
}
