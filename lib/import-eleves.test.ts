import { describe, expect, it } from "vitest";

import {
  analyserImportEducateurs,
  analyserImportEleves,
  cleEleve,
} from "./import-eleves";

describe("analyserImportEleves — §5.1", () => {
  const enTete = "nom;prenom;date de naissance;niveau scolaire;notes";

  it("lit un fichier correct", () => {
    const rapport = analyserImportEleves(
      `${enTete}\nCôté;Alice;2017-04-12;3;\nRoy;Hugo;12/09/2016;4;allergie`,
    );

    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.nbNouveaux).toBe(2);
    expect(rapport.lignes[0].donnees).toEqual({
      nom: "Côté",
      prenom: "Alice",
      dateNaissance: new Date("2017-04-12T00:00:00.000Z"),
      niveauScolaire: 3,
      notes: null,
    });
    expect(rapport.lignes[1].donnees?.notes).toBe("allergie");
  });

  it("accepte des en-têtes accentuées, en majuscules ou soulignées", () => {
    const rapport = analyserImportEleves(
      "NOM;Prénom;DATE_DE_NAISSANCE\nRoy;Alice;2017-04-12",
    );
    expect(rapport.entetesManquantes).toEqual([]);
    expect(rapport.nbNouveaux).toBe(1);
  });

  it("signale les colonnes obligatoires absentes", () => {
    const rapport = analyserImportEleves("nom;prenom\nRoy;Alice");
    expect(rapport.entetesManquantes).toEqual(["date de naissance"]);
    expect(rapport.nbErreurs).toBe(1);
  });

  it("n'exige pas le niveau scolaire (§5.1)", () => {
    const rapport = analyserImportEleves(
      "nom;prenom;date de naissance\nRoy;Alice;2017-04-12",
    );
    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.lignes[0].donnees?.niveauScolaire).toBeNull();
  });

  it("rapporte les erreurs ligne par ligne, avec le numéro affiché par Excel", () => {
    const rapport = analyserImportEleves(
      `${enTete}\nCôté;Alice;2017-04-12;3;\n;Hugo;2016-09-12;4;\nRoy;Léa;pas une date;2;`,
    );

    expect(rapport.nbErreurs).toBe(2);
    const [, ligneSansNom, ligneMauvaiseDate] = rapport.lignes;

    expect(ligneSansNom.numeroLigne).toBe(3);
    expect(ligneSansNom.erreurs).toContain("Nom manquant.");

    expect(ligneMauvaiseDate.numeroLigne).toBe(4);
    expect(ligneMauvaiseDate.erreurs[0]).toMatch(/Date de naissance illisible/);
  });

  it("refuse un niveau scolaire hors de 0 à 6", () => {
    const rapport = analyserImportEleves(
      `${enTete}\nRoy;Alice;2017-04-12;12;`,
    );
    expect(rapport.lignes[0].erreurs[0]).toMatch(/Niveau scolaire invalide/);
  });

  it("refuse une date de naissance dans le futur", () => {
    const rapport = analyserImportEleves(
      `${enTete}\nRoy;Alice;2099-01-01;3;`,
    );
    expect(rapport.lignes[0].erreurs).toContain(
      "Date de naissance dans le futur.",
    );
  });

  it("détecte un doublon interne au fichier sur nom + prénom + date", () => {
    const rapport = analyserImportEleves(
      `${enTete}\nRoy;Alice;2017-04-12;3;\nroy;ALICE;12/04/2017;3;`,
    );

    expect(rapport.lignes[1].statut).toBe("doublon_fichier");
    expect(rapport.nbDoublons).toBe(1);
    expect(rapport.nbNouveaux).toBe(1);
  });

  it("distingue un doublon avec la base d'un doublon interne", () => {
    const existant = new Set([
      cleEleve({
        nom: "Roy",
        prenom: "Alice",
        dateNaissance: new Date("2017-04-12T00:00:00.000Z"),
      }),
    ]);
    const rapport = analyserImportEleves(
      `${enTete}\nRoy;Alice;2017-04-12;3;`,
      existant,
    );

    expect(rapport.lignes[0].statut).toBe("doublon_base");
    expect(rapport.lignes[0].erreurs[0]).toMatch(/existe déjà/);
  });

  it("ne considère pas comme doublons deux homonymes nés des jours différents", () => {
    const rapport = analyserImportEleves(
      `${enTete}\nRoy;Alice;2017-04-12;3;\nRoy;Alice;2018-04-12;2;`,
    );
    expect(rapport.nbDoublons).toBe(0);
    expect(rapport.nbNouveaux).toBe(2);
  });

  it("n'écrit rien : il ne produit qu'un rapport", () => {
    // Garde-fou de conception — §5.1 impose une prévisualisation AVANT
    // validation. La fonction est pure, sans accès à la base.
    const rapport = analyserImportEleves(`${enTete}\nRoy;Alice;2017-04-12;3;`);
    expect(rapport.lignes).toHaveLength(1);
  });
});

describe("analyserImportEducateurs — §5.2", () => {
  it("lit un fichier correct et normalise le statut d'emploi", () => {
    const rapport = analyserImportEducateurs(
      "nom;prenom;courriel;statut;date d'embauche\n" +
        "Tremblay;Marie;marie@ecole.qc.ca;temps plein;2021-08-15\n" +
        "Roy;Luc;luc@ecole.qc.ca;Temps partiel;01/09/2022",
    );

    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.lignes[0].donnees?.statutEmploi).toBe("TEMPS_PLEIN");
    expect(rapport.lignes[1].donnees?.statutEmploi).toBe("TEMPS_PARTIEL");
    expect(rapport.lignes[1].donnees?.dateEmbauche?.toISOString()).toBe(
      "2022-09-01T00:00:00.000Z",
    );
  });

  it("accepte un éducateur sans courriel ni date d'embauche", () => {
    const rapport = analyserImportEducateurs("nom;prenom\nRoy;Luc");
    expect(rapport.nbErreurs).toBe(0);
    expect(rapport.lignes[0].donnees?.courriel).toBeNull();
  });

  it("refuse un courriel mal formé", () => {
    const rapport = analyserImportEducateurs(
      "nom;prenom;courriel\nRoy;Luc;pas-un-courriel",
    );
    expect(rapport.lignes[0].erreurs[0]).toMatch(/Courriel invalide/);
  });

  it("refuse un statut d'emploi inconnu", () => {
    const rapport = analyserImportEducateurs(
      "nom;prenom;statut\nRoy;Luc;stagiaire",
    );
    expect(rapport.lignes[0].erreurs[0]).toMatch(/Statut d'emploi inconnu/);
  });

  it("détecte un doublon de courriel", () => {
    const rapport = analyserImportEducateurs(
      "nom;prenom;courriel\nRoy;Luc;luc@ecole.qc.ca\nRoyer;Lucie;LUC@ecole.qc.ca",
    );
    expect(rapport.lignes[1].statut).toBe("doublon_fichier");
  });
});
