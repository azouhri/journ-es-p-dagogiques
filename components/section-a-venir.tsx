import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Écran d'attente pour les sections encore à construire. */
export function SectionAVenir({
  titre,
  reference,
  contenu,
}: {
  titre: string;
  reference: string;
  contenu: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{titre}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Section à construire — {reference} de la spécification.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {contenu.map((ligne) => (
              <li key={ligne}>{ligne}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
