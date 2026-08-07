"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { enregistrerReglages } from "@/app/actions/configuration";
import { Aide } from "@/components/aide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReglagesConfig } from "@/lib/domain/types";

const CHAMP_SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

/** §10 — chaque réglage est lu par l'algorithme à chaque génération (§8.2). */
export function FormulaireReglages({
  anneeScolaireId,
  reglages,
}: {
  anneeScolaireId: string;
  reglages: ReglagesConfig;
}) {
  const [etat, action, enCours] = useActionState(enregistrerReglages, null);

  useEffect(() => {
    if (!etat) return;
    if (etat.ok) toast.success(etat.message);
    else toast.error(etat.message);
  }, [etat]);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />

      <section className="space-y-4 rounded-md border p-4">
        <h3 className="text-sm font-medium">Groupes</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="capaciteMaxGroupe" className="flex items-center gap-1.5">
              Capacité maximale d&apos;un groupe
              <Aide titre="Capacité d'un groupe">
                <p>
                  20 est le maximum légal : 1 éducateur pour 20 élèves présents.
                  Seule une valeur plus stricte est acceptée.
                </p>
              </Aide>
            </Label>
            <Input
              id="capaciteMaxGroupe"
              name="capaciteMaxGroupe"
              type="number"
              min={1}
              max={20}
              defaultValue={reglages.capaciteMaxGroupe}
            />

          </div>
          <div className="grid gap-2">
            <Label htmlFor="modeGroupement">Mode de groupement</Label>
            <select
              id="modeGroupement"
              name="modeGroupement"
              defaultValue={reglages.modeGroupement}
              className={CHAMP_SELECT}
            >
              <option value="AGE_CALCULE">Par âge calculé</option>
              <option value="NIVEAU_SCOLAIRE">Par niveau scolaire</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label
              htmlFor="dateReferenceAgeJour"
              className="flex items-center gap-1.5"
            >
              Date de référence pour l&apos;âge — jour
              <Aide titre="Date de référence">
                <p>
                  L&apos;âge est figé à cette date pour toute l&apos;année :
                  sans cela, un élève changerait de groupe le jour de son
                  anniversaire.
                </p>
              </Aide>
            </Label>
            <Input
              id="dateReferenceAgeJour"
              name="dateReferenceAgeJour"
              type="number"
              min={1}
              max={31}
              defaultValue={reglages.dateReferenceAgeJour}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dateReferenceAgeMois">Mois</Label>
            <Input
              id="dateReferenceAgeMois"
              name="dateReferenceAgeMois"
              type="number"
              min={1}
              max={12}
              defaultValue={reglages.dateReferenceAgeMois}
            />

          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-md border p-4">
        <h3 className="text-sm font-medium">Algorithme</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="critereDepartage" className="flex items-center gap-1.5">
              Critère de départage prioritaire
              <Aide titre="Départage">
                <p>Appliqué après le compteur du quart lui-même.</p>
              </Aide>
            </Label>
            <select
              id="critereDepartage"
              name="critereDepartage"
              defaultValue={reglages.critereDepartage}
              className={CHAMP_SELECT}
            >
              <option value="HEURES_CUMULEES">Heures cumulées</option>
              <option value="NB_JOURNEES">Nombre de journées travaillées</option>
            </select>

          </div>

          <div className="grid gap-2">
            <Label htmlFor="doublePoste">Double poste le même jour</Label>
            <select
              id="doublePoste"
              name="doublePoste"
              defaultValue={reglages.doublePoste}
              className={CHAMP_SELECT}
            >
              <option value="JAMAIS">Jamais</option>
              <option value="SI_EFFECTIF_INSUFFISANT">
                Uniquement en cas d&apos;effectif insuffisant
              </option>
              <option value="TOUJOURS">Toujours autorisé</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="surEffectifOuverture">
              Si l&apos;ouverture dépasse le nombre de groupes
            </Label>
            <select
              id="surEffectifOuverture"
              name="surEffectifOuverture"
              defaultValue={reglages.surEffectifOuverture}
              className={CHAMP_SELECT}
            >
              <option value="REDUIRE_AU_NOMBRE_DE_GROUPES">
                Réduire l&apos;ouverture au nombre de groupes
              </option>
              <option value="RENFORT_SUR_UN_GROUPE">
                Le surnuméraire reste en renfort
              </option>
              <option value="AVANCE_PUIS_RETOUR">
                Venir en avance puis revenir plus tard
              </option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="politiqueTrancheEducateur"
              className="flex items-center gap-1.5"
            >
              Tranches d&apos;âge des éducateurs
              <Aide titre="Tranches des éducateurs">
                <p>
                  Les tranches se déclarent sur la fiche de chaque éducateur.
                  Sans déclaration, il encadre tous les âges.
                </p>
                <p>
                  En mode «&nbsp;Imposer&nbsp;», une répartition impossible est
                  refusée et expliquée avant génération.
                </p>
              </Aide>
            </Label>
            <select
              id="politiqueTrancheEducateur"
              name="politiqueTrancheEducateur"
              defaultValue={reglages.politiqueTrancheEducateur}
              className={CHAMP_SELECT}
            >
              <option value="LIBRE">
                Libre — chacun peut encadrer n&apos;importe quel âge
              </option>
              <option value="PREFERER">
                Privilégier les tranches déclarées
              </option>
              <option value="IMPOSER">
                Imposer — un éducateur n&apos;encadre que ses tranches
              </option>
            </select>

          </div>

          <div className="grid gap-2">
            <Label htmlFor="politiqueBloc">Bloc de plusieurs jours</Label>
            <select
              id="politiqueBloc"
              name="politiqueBloc"
              defaultValue={reglages.politiqueBloc}
              className={CHAMP_SELECT}
            >
              <option value="CHAQUE_JOUR_SEPAREMENT">
                Chaque jour planifié séparément
              </option>
              <option value="MEME_EQUIPE_SUR_LE_BLOC">
                Même équipe sur tout le bloc
              </option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="eviterMemeQuartConsecutif"
              defaultChecked={reglages.eviterMemeQuartConsecutif}
              className="size-4"
            />
            Éviter le même quart deux journées pédagogiques de suite
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="continuiteTrancheAge"
              defaultChecked={reglages.continuiteTrancheAge}
              className="size-4"
            />
            Continuité éducateur / tranche d&apos;âge
          </label>
        </div>
      </section>

      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer les réglages"}
      </Button>
    </form>
  );
}
