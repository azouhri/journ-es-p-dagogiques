import { lignesEducateursPourExport } from "@/app/actions/educateurs";
import { lignesElevesPourExport } from "@/app/actions/eleves";
import {
  COLONNES_EDUCATEURS,
  COLONNES_ELEVES,
  EXEMPLE_EDUCATEUR,
  EXEMPLE_ELEVE,
} from "@/lib/colonnes";
import { ecrireClasseur, type ColonneClasseur } from "@/lib/xlsx";

const dateFr = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long" });

/**
 * Classeurs téléchargeables : listes complètes et modèles vierges.
 *
 * Les deux partagent la MÊME définition de colonnes que l'import. Un modèle
 * dont les en-têtes auraient dérivé serait pire que pas de modèle du tout :
 * il produirait des fichiers systématiquement refusés.
 */
type Definition = {
  nomFeuille: string;
  titre: string;
  colonnes: ColonneClasseur[];
  lignes: () => Promise<Array<Array<string | number>>>;
  exemple: Array<string | number>;
};

const DEFINITIONS: Record<string, Definition> = {
  eleves: {
    nomFeuille: "Élèves",
    titre: "Élèves",
    colonnes: COLONNES_ELEVES,
    lignes: lignesElevesPourExport,
    exemple: EXEMPLE_ELEVE,
  },
  educateurs: {
    nomFeuille: "Éducateurs",
    titre: "Éducateurs",
    colonnes: COLONNES_EDUCATEURS,
    lignes: lignesEducateursPourExport,
    exemple: EXEMPLE_EDUCATEUR,
  },
};

export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ fichier: string }> },
) {
  const { fichier } = await contexte.params;

  const modele = fichier.startsWith("modele-");
  const cle = (modele ? fichier.slice("modele-".length) : fichier).replace(
    /\.xlsx$/,
    "",
  );

  const definition = DEFINITIONS[cle];
  if (!definition) return new Response("Fichier inconnu.", { status: 404 });

  const tampon = await ecrireClasseur({
    nomFeuille: definition.nomFeuille,
    titre: modele ? `Modèle — ${definition.titre}` : definition.titre,
    sousTitre: modele
      ? "Remplacer la ligne d'exemple par vos données, puis importer ce fichier."
      : `Exporté le ${dateFr.format(new Date())}`,
    colonnes: definition.colonnes,
    // Le modèle porte une ligne d'exemple : montrer le format attendu vaut
    // mieux que le décrire.
    lignes: modele ? [definition.exemple] : await definition.lignes(),
  });

  const nom = modele ? `modele-${cle}.xlsx` : `${cle}.xlsx`;

  return new Response(tampon as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}
