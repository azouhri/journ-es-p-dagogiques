"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import type { ApercuGeneration } from "@/app/actions/planification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Aperçu des groupes et contrôle d'effectif (§7.4).
 *
 * Recalculé à la demande : les participants et les disponibilités changent
 * pendant le parcours, et le résultat doit pouvoir être revérifié sans
 * recharger la page ni lancer une génération.
 */
export function ApercuGroupes({
  recharger,
  auto = true,
}: {
  recharger: () => Promise<ApercuGeneration>;
  auto?: boolean;
}) {
  const [apercu, setApercu] = useState<ApercuGeneration | null>(null);
  const [enCours, demarrer] = useTransition();

  function verifier() {
    demarrer(async () => setApercu(await recharger()));
  }

  useEffect(() => {
    if (auto) verifier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={enCours} onClick={verifier}>
          {enCours ? "Vérification…" : "Revérifier les groupes"}
        </Button>
        {apercu && (
          <Badge variant={apercu.faisable ? "default" : "destructive"}>
            {apercu.faisable ? "Effectif suffisant" : "Effectif insuffisant"}
          </Badge>
        )}
      </div>

      {apercu === null ? (
        <p className="text-sm text-muted-foreground">
          {enCours ? "Calcul en cours…" : "Aucune vérification effectuée."}
        </p>
      ) : (
        <>
          <p
            className={`text-sm ${apercu.faisable ? "text-muted-foreground" : "font-medium text-destructive"}`}
          >
            {apercu.message}
          </p>

          {apercu.jours.map((jour) => (
            <div
              key={jour.jourPlanifieId}
              className={`rounded-md border p-3 text-sm ${
                jour.manquants > 0
                  ? "border-destructive bg-destructive/5"
                  : "bg-muted/40"
              }`}
            >
              <p className="font-medium">
                {dateFr.format(new Date(`${jour.date}T00:00:00Z`))}
              </p>

              <div className="mt-1 flex flex-wrap gap-1.5">
                {jour.groupes.map((g) => (
                  <Badge key={g.libelle} variant="outline">
                    {g.libelle} · {g.effectif}
                  </Badge>
                ))}
              </div>

              <p className="mt-2 text-muted-foreground">
                {jour.educateursRequis} éducateur(s) requis ·{" "}
                {jour.educateursDisponibles} disponible(s)
                {jour.manquants > 0 && (
                  <span className="font-medium text-destructive">
                    {" "}
                    — il en manque {jour.manquants}
                  </span>
                )}
              </p>

              {jour.nonClasses > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
                  {jour.nonClasses} élève(s) hors de toute tranche d&apos;âge :
                  ils ne seront dans aucun groupe.
                </p>
              )}
            </div>
          ))}

          {apercu.avertissements.map((a) => (
            <p key={a} className="text-xs text-muted-foreground">
              {a}
            </p>
          ))}

          {!apercu.faisable && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<Link href="/educateurs" />}>
                Ajouter un éducateur
              </Button>
              <Button variant="outline" size="sm" render={<Link href="/parametres" />}>
                Augmenter la capacité des groupes
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
