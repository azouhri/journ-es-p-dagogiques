import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { verifierConnexion } from "@/lib/data/connexion";
import { chargerEquite } from "@/lib/data/equite";
import { essayer } from "@/lib/data/securise";
import { compteurDuQuart } from "@/lib/domain/equite";
import { dureeEnTexte } from "@/lib/domain/temps";

export default async function PageEquite() {
  const etat = await verifierConnexion();
  const tableau = await essayer(() => chargerEquite(), null);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
        Équité
        <Aide titre="Ce que comptent ces chiffres">
          <p>
            Le nombre de fois où chacun a tenu chaque quart, sur
            l&apos;année scolaire.
          </p>
          <p>
            Seul ce qui a réellement été travaillé compte : une absence ne
            crédite personne, un remplacement crédite le remplaçant. Corriger
            une présence, même des semaines plus tard, met ces chiffres à jour
            aussitôt.
          </p>
        </Aide>
      </h1>

      {!tableau ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucune année scolaire active.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Année {tableau.anneeLibelle}</Badge>
            <Badge variant="outline">{tableau.totalJours} jour(s) planifié(s)</Badge>
            {tableau.joursNonConfirmes > 0 && (
              <Badge variant="secondary">
                {tableau.joursNonConfirmes} jour(s) non confirmé(s)
              </Badge>
            )}
          </div>

          {tableau.joursNonConfirmes > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              {tableau.joursNonConfirmes} journée(s) non confirmée(s)
              <Aide titre="Effet sur les compteurs">
                <p>
                  Leurs présences n&apos;ont pas encore été vérifiées : les
                  chiffres ci-dessous les comptent comme travaillées.
                </p>
              </Aide>
            </div>
          )}

          <div className="rounded-md border">
            <Table className="min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Éducateur</TableHead>
                  {tableau.colonnes.map((c) => (
                    <TableHead key={c.code} className="text-right">
                      <div className="flex flex-col items-end">
                        <span>{c.libelle}</span>
                        {!c.actif && (
                          <span className="text-[10px] font-normal text-muted-foreground">
                            inactif
                          </span>
                        )}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Journées</TableHead>
                  <TableHead className="text-right">Heures cumulées</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableau.lignes.map((ligne) => (
                  <TableRow key={ligne.educateurId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>
                          {ligne.nom} {ligne.prenom}
                        </span>
                        {!ligne.actif && (
                          <Badge variant="secondary" className="text-xs">
                            inactif
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {tableau.colonnes.map((c) => (
                      <TableCell
                        key={c.code}
                        className="text-right tabular-nums"
                      >
                        {compteurDuQuart(ligne.compteurs, c.code)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right tabular-nums">
                      {ligne.compteurs.nbJourneesTravaillees}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dureeEnTexte(ligne.compteurs.minutesCumulees)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-md border bg-muted/40 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              Écart entre collègues, par type de quart
              <Aide titre="Lire l'écart">
                <p>
                  Mesuré entre éducateurs actifs uniquement. Un écart de 0 ou 1
                  signifie que la rotation tient : personne n&apos;est cantonné
                  à un rôle.
                </p>
                <p>
                  Un écart qui se creuse signale un retard accumulé, le plus
                  souvent après plusieurs indisponibilités — ou simplement une
                  embauche en cours d&apos;année, auquel cas il se résorbe de
                  lui-même au fil des journées suivantes.
                </p>
              </Aide>
            </p>
            <div className="flex flex-wrap gap-2">
              {tableau.colonnes.map((c) => (
                <Badge
                  key={c.code}
                  variant={c.ecart <= 1 ? "default" : "destructive"}
                >
                  {c.libelle} : {c.ecart}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
