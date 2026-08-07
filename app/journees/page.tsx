import Link from "next/link";

import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { FormulaireJournee } from "@/components/formulaire-journee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { verifierConnexion } from "@/lib/data/connexion";
import { essayer } from "@/lib/data/securise";
import { prisma } from "@/lib/prisma";

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const ETIQUETTES: Record<
  string,
  { texte: string; variante: "default" | "secondary" | "outline" }
> = {
  BROUILLON: { texte: "Brouillon", variante: "outline" },
  GENERE: { texte: "Généré", variante: "secondary" },
  VALIDE: { texte: "Validé", variante: "default" },
};

export default async function PageJournees() {
  const etat = await verifierConnexion();

  const journees = await essayer(
    () =>
      prisma.journeePedagogique.findMany({
        include: {
          anneeScolaire: true,
          jours: {
            orderBy: { date: "asc" },
            include: { _count: { select: { affectations: true, groupes: true } } },
          },
          _count: { select: { participations: true } },
        },
        orderBy: { creeeLe: "desc" },
      }),
    [],
  );

  const aConfirmer = journees.flatMap((j) =>
    j.jours.filter((d) => d.statutConfirmation === "A_CONFIRMER"),
  ).length;

  // Le formulaire borne son calendrier aux dates de l'année choisie : il faut
  // donc connaître les périodes avant d'ouvrir la boîte de dialogue.
  const annees = await essayer(
    () =>
      prisma.anneeScolaire.findMany({
        orderBy: { dateDebut: "desc" },
        select: {
          id: true,
          libelle: true,
          dateDebut: true,
          dateFin: true,
          statut: true,
        },
      }),
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
          Journées pédagogiques
          <Aide titre="Journées et blocs">
            <p>
              Une journée peut couvrir plusieurs jours consécutifs. Chaque jour
              est planifié séparément et la rotation se poursuit d&apos;un jour
              au suivant.
            </p>
          </Aide>
        </h1>
        <FormulaireJournee
          annees={annees.map((a) => ({
            id: a.id,
            libelle: a.libelle,
            dateDebut: a.dateDebut.toISOString().slice(0, 10),
            dateFin: a.dateFin.toISOString().slice(0, 10),
            statut: a.statut,
          }))}
        />
      </div>

      {aConfirmer > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          {aConfirmer} jour(s) en attente de confirmation des présences.
        </div>
      )}

      {journees.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucune journée pédagogique. Utiliser le bouton «&nbsp;Nouvelle journée
          pédagogique&nbsp;» pour en créer une.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table className="min-w-[44rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Année</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead className="text-right">Élèves</TableHead>
                <TableHead className="text-right">Groupes</TableHead>
                <TableHead className="text-right">Affectations</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journees.map((journee) => {
                const etiquette =
                  ETIQUETTES[journee.statut] ?? ETIQUETTES.BROUILLON;
                const groupes = journee.jours.reduce(
                  (s, j) => s + j._count.groupes,
                  0,
                );
                const affectations = journee.jours.reduce(
                  (s, j) => s + j._count.affectations,
                  0,
                );

                return (
                  <TableRow key={journee.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/journees/${journee.id}`}
                        className="hover:underline"
                      >
                        {journee.nom}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {journee.anneeScolaire.libelle}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {journee.jours.map((j) => (
                        <div key={j.id} className="flex items-center gap-2">
                          <span>{dateFr.format(j.date)}</span>
                          {j.statutConfirmation === "A_CONFIRMER" && (
                            <Badge variant="outline" className="text-xs">
                              à confirmer
                            </Badge>
                          )}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {journee._count.participations}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {groupes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {affectations}
                    </TableCell>
                    <TableCell>
                      <Badge variant={etiquette.variante}>
                        {etiquette.texte}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        size="sm"
                        variant={
                          journee.statut === "VALIDE" ? "outline" : "default"
                        }
                        render={<Link href={`/journees/${journee.id}`} />}
                      >
                        {journee.statut === "BROUILLON"
                          ? "Planifier"
                          : journee.statut === "GENERE"
                            ? "Poursuivre"
                            : "Ouvrir"}
                      </Button>
                      {journee.statut === "VALIDE" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          render={
                            <Link href={`/journees/${journee.id}/presences`} />
                          }
                        >
                          Présences
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
