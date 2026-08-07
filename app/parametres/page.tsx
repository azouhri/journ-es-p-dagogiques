import { Aide } from "@/components/aide";
import { BanniereConfiguration } from "@/components/banniere-configuration";
import { FormulaireQuart } from "@/components/formulaire-quart";
import { FormulaireReglages } from "@/components/formulaire-reglages";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chargerConfiguration, listerVersions } from "@/lib/data/configuration";
import { verifierConnexion } from "@/lib/data/connexion";
import { essayer } from "@/lib/data/securise";
import { versTexteFr } from "@/lib/domain/temps";

const dateFr = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function PageParametres() {
  const etat = await verifierConnexion();
  const config = await essayer(() => chargerConfiguration(), null);
  const versions = config
    ? await essayer(() => listerVersions(config.anneeScolaireId), [])
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {!etat.ok && <BanniereConfiguration etat={etat} />}

      <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
        Paramètres
        <Aide titre="Configuration et versions">
          <p>
            Aucun comportement de l&apos;algorithme n&apos;est codé en dur :
            tout ce qui suit est relu à chaque génération.
          </p>
          <p>
            Chaque modification crée une version ; les versions ne sont jamais
            écrasées, et une journée déjà générée garde la sienne.
          </p>
        </Aide>
      </h1>

      {!config ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Aucune année scolaire active.
        </div>
      ) : (
        <Tabs defaultValue="quarts">
          <TabsList>
            <TabsTrigger value="quarts">Types de quart</TabsTrigger>
            <TabsTrigger value="tranches">Tranches d&apos;âge</TabsTrigger>

            <TabsTrigger value="reglages">Réglages</TabsTrigger>
            <TabsTrigger value="versions">
              Versions ({versions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quarts" className="space-y-4">
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Quart</TableHead>
                    <TableHead>Horaire</TableHead>
                    <TableHead>Portée</TableHead>
                    <TableHead className="text-right">Effectif</TableHead>
                    <TableHead>Enchaîne sur</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.quarts.map((q) => {
                    const suivant = config.quarts.find(
                      (x) => x.id === q.enchaineSurId,
                    );
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.libelle}</TableCell>
                        <TableCell className="tabular-nums">
                          {versTexteFr(q.debutMinutes)} –{" "}
                          {versTexteFr(q.finMinutes)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {q.portee === "TOUS_GROUPES"
                            ? "Tous groupes"
                            : "Par groupe"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {q.effectifRequis}
                          {q.portee === "PAR_GROUPE" && (
                            <span className="text-muted-foreground"> /groupe</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {suivant?.libelle ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={q.actif ? "default" : "secondary"}>
                            {q.actif ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <FormulaireQuart quart={q} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="tranches" className="space-y-4">
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tranche</TableHead>
                    <TableHead className="text-right">Âge</TableHead>
                    <TableHead className="text-right">Niveau scolaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.tranches.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.libelle}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.ageMin} – {t.ageMax} ans
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {t.niveauMin === null || t.niveauMax === null
                          ? "—"
                          : `${t.niveauMin} – ${t.niveauMax}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="reglages">
            <FormulaireReglages
              anneeScolaireId={config.anneeScolaireId}
              reglages={config.reglages}
            />
          </TabsContent>

          <TabsContent value="versions" className="space-y-4">
            <div className="rounded-md border">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Version</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead className="text-right">Journées liées</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="tabular-nums font-medium">
                        v{v.numero}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dateFr.format(v.creeeLe)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.commentaire ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {v._count.journees}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
