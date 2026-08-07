import { describe, expect, it } from "vitest";

import { calculerBesoins, genererBloc, genererJour } from "./generation";
import { copierCompteurs, ecartSurQuart } from "./equite";
import type {
  AffectationGeneree,
  CompteursEducateur,
  EducateurRef,
  ReglagesConfig,
} from "./types";
import { compteursVides } from "./types";
import {
  educateurs,
  groupes,
  quartsParDefaut,
  reglagesParDefaut,
} from "@/tests/fixtures";

// ---------------------------------------------------------------------------
// Simulation d'une année scolaire
// ---------------------------------------------------------------------------

interface OptionsSimulation {
  nbEducateurs: number;
  nbGroupes: number;
  nbJournees: number;
  reglages?: ReglagesConfig;
  /** Renvoie les éducateurs indisponibles pour la journée d'indice `jour`. */
  absents?: (jour: number, equipe: EducateurRef[]) => Set<string>;
}

interface Simulation {
  compteurs: Map<string, CompteursEducateur>;
  journees: AffectationGeneree[][];
  equipe: EducateurRef[];
}

function simulerAnnee(options: OptionsSimulation): Simulation {
  const equipe = educateurs(options.nbEducateurs);
  const lesGroupes = groupes(options.nbGroupes);
  const quarts = quartsParDefaut();
  const reglages = options.reglages ?? reglagesParDefaut();

  let compteurs = new Map<string, CompteursEducateur>(
    equipe.map((e) => [e.id, compteursVides(e.id)]),
  );
  let quartsJourneePrecedente = new Map<string, Set<string>>();
  const journees: AffectationGeneree[][] = [];

  for (let jour = 0; jour < options.nbJournees; jour++) {
    const absents = options.absents?.(jour, equipe) ?? new Set<string>();
    const disponibles = equipe.filter((e) => !absents.has(e.id));

    const resultat = genererJour({
      quarts,
      groupes: lesGroupes,
      educateursDisponibles: disponibles,
      compteurs,
      quartsJourneePrecedente,
      reglages,
    });

    expect(resultat.faisable).toBe(true);

    compteurs = resultat.compteursApres;
    journees.push(resultat.affectations);

    quartsJourneePrecedente = new Map();
    for (const a of resultat.affectations) {
      const set = quartsJourneePrecedente.get(a.educateurId) ?? new Set();
      set.add(a.quartCode);
      quartsJourneePrecedente.set(a.educateurId, set);
    }
  }

  return { compteurs, journees, equipe };
}

// ---------------------------------------------------------------------------

describe("calculerBesoins — §4.3", () => {
  it("déduit les places absorbées par l'enchaînement : 2k, pas 2k + 2", () => {
    const k = 4;
    const quarts = quartsParDefaut().filter((q) => q.actif);
    const { besoins } = calculerBesoins(quarts, k, reglagesParDefaut());

    const parCode = Object.fromEntries(besoins.map((b) => [b.quartCode, b]));

    expect(parCode.OUVERTURE.effectif).toBe(2);
    expect(parCode.MATINEE.effectif).toBe(k);
    // Les 2 personnes de l'ouverture occupent déjà 2 places de la matinée.
    expect(parCode.MATINEE.placesAbsorbees).toBe(2);
    expect(parCode.APRES_MIDI.effectif).toBe(k);

    const total = besoins.reduce((s, b) => s + b.placesAPourvoir, 0);
    expect(total).toBe(2 * k);
  });

  it("rabote l'ouverture au nombre de groupes quand il y a moins de groupes que d'ouvreurs", () => {
    // 1 seul groupe : la matinée ne peut accueillir qu'une personne, donc
    // l'ouverture est réduite de 2 à 1 (§10, politique par défaut).
    const quarts = quartsParDefaut().filter((q) => q.actif);
    const { besoins } = calculerBesoins(quarts, 1, reglagesParDefaut());
    const parCode = Object.fromEntries(besoins.map((b) => [b.quartCode, b]));

    expect(parCode.OUVERTURE.effectif).toBe(1);
    expect(besoins.reduce((s, b) => s + b.placesAPourvoir, 0)).toBe(2);
  });

  it("garde le surnuméraire en renfort quand le réglage le demande", () => {
    const quarts = quartsParDefaut().filter((q) => q.actif);
    const { besoins } = calculerBesoins(
      quarts,
      1,
      reglagesParDefaut({ surEffectifOuverture: "RENFORT_SUR_UN_GROUPE" }),
    );
    const parCode = Object.fromEntries(besoins.map((b) => [b.quartCode, b]));

    expect(parCode.OUVERTURE.effectif).toBe(2);
    // La matinée accueille les 2 ouvreurs plutôt que son effectif nominal de 1.
    expect(parCode.MATINEE.effectif).toBe(2);
  });

  it("ignore les quarts inactifs et les réintègre sans changement de code (§4.6)", () => {
    const tous = quartsParDefaut();
    const avecSoiree = tous.map((q) =>
      q.code === "SOIREE" ? { ...q, actif: true } : q,
    );

    const avant = calculerBesoins(
      tous.filter((q) => q.actif),
      3,
      reglagesParDefaut(),
    );
    const apres = calculerBesoins(
      avecSoiree.filter((q) => q.actif),
      3,
      reglagesParDefaut(),
    );

    expect(avant.besoins.map((b) => b.quartCode)).toEqual([
      "OUVERTURE",
      "MATINEE",
      "APRES_MIDI",
    ]);
    expect(apres.besoins.map((b) => b.quartCode)).toEqual([
      "OUVERTURE",
      "MATINEE",
      "APRES_MIDI",
      "SOIREE",
    ]);
  });
});

describe("genererJour — structure du planning", () => {
  it("mobilise 2k éducateurs pour k groupes (§4.3)", () => {
    const k = 4;
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(k),
      educateursDisponibles: educateurs(15),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    const mobilises = new Set(resultat.affectations.map((a) => a.educateurId));
    expect(mobilises.size).toBe(2 * k);
  });

  it("fait enchaîner les ouvreurs sur la matinée (§4.3)", () => {
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(4),
      educateursDisponibles: educateurs(15),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    const ouvreurs = resultat.affectations
      .filter((a) => a.quartCode === "OUVERTURE")
      .map((a) => a.educateurId);
    const matinee = resultat.affectations.filter(
      (a) => a.quartCode === "MATINEE",
    );

    expect(ouvreurs).toHaveLength(2);
    for (const ouvreur of ouvreurs) {
      const sienne = matinee.find((a) => a.educateurId === ouvreur);
      expect(sienne).toBeDefined();
      expect(sienne!.issueEnchainement).toBe(true);
      // L'ouvreur encadre bien un groupe le matin, ce n'est pas un quart à part.
      expect(sienne!.groupeId).not.toBeNull();
    }
  });

  it("ne cible aucun groupe pour un quart TOUS_GROUPES", () => {
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(4),
      educateursDisponibles: educateurs(15),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    for (const a of resultat.affectations.filter(
      (x) => x.quartCode === "OUVERTURE",
    )) {
      expect(a.groupeId).toBeNull();
    }
  });

  it("couvre chaque groupe exactement une fois le matin et une fois l'après-midi", () => {
    const k = 4;
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(k),
      educateursDisponibles: educateurs(15),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    for (const code of ["MATINEE", "APRES_MIDI"]) {
      const cibles = resultat.affectations
        .filter((a) => a.quartCode === code)
        .map((a) => a.groupeId);
      expect(cibles).toHaveLength(k);
      expect(new Set(cibles).size).toBe(k);
    }
  });

  it("n'affecte jamais un éducateur à deux quarts qui se chevauchent", () => {
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(4),
      educateursDisponibles: educateurs(15),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    const parEducateur = new Map<string, AffectationGeneree[]>();
    for (const a of resultat.affectations) {
      parEducateur.set(a.educateurId, [
        ...(parEducateur.get(a.educateurId) ?? []),
        a,
      ]);
    }

    for (const liste of parEducateur.values()) {
      const tries = [...liste].sort(
        (a, b) => a.quartDebutMinutes - b.quartDebutMinutes,
      );
      for (let i = 1; i < tries.length; i++) {
        expect(tries[i].quartDebutMinutes).toBeGreaterThanOrEqual(
          tries[i - 1].quartFinMinutes,
        );
      }
    }
  });

  it("recopie le libellé et les horaires du quart dans l'affectation (§4.6)", () => {
    const quarts = quartsParDefaut();
    const resultat = genererJour({
      quarts,
      groupes: groupes(3),
      educateursDisponibles: educateurs(12),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    const ouverture = quarts.find((q) => q.code === "OUVERTURE")!;
    const affectation = resultat.affectations.find(
      (a) => a.quartCode === "OUVERTURE",
    )!;

    expect(affectation.quartLibelle).toBe(ouverture.libelle);
    expect(affectation.quartDebutMinutes).toBe(ouverture.debutMinutes);
    expect(affectation.quartFinMinutes).toBe(ouverture.finMinutes);
  });

  it("justifie chaque affectation (§8.4)", () => {
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(3),
      educateursDisponibles: educateurs(12),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    for (const a of resultat.affectations) {
      expect(a.justification.length).toBeGreaterThan(0);
    }
  });

  it("annonce l'effectif manquant au lieu de générer un planning bancal (§7.4)", () => {
    const resultat = genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(5), // demande 10 éducateurs
      educateursDisponibles: educateurs(6),
      compteurs: new Map(),
      reglages: reglagesParDefaut(),
    });

    expect(resultat.faisable).toBe(false);
    expect(resultat.affectations).toHaveLength(0);
    expect(resultat.diagnostic.manquants).toBe(4);
    expect(
      resultat.avertissements.some((a) => a.code === "EFFECTIF_INSUFFISANT"),
    ).toBe(true);
  });

  it("ne mute pas les compteurs qu'on lui passe", () => {
    const compteurs = new Map([["e-01", compteursVides("e-01")]]);
    const copie = copierCompteurs(compteurs);

    genererJour({
      quarts: quartsParDefaut(),
      groupes: groupes(3),
      educateursDisponibles: educateurs(12),
      compteurs,
      reglages: reglagesParDefaut(),
    });

    expect(compteurs).toEqual(copie);
  });

  it("est déterministe : deux générations identiques donnent le même résultat (§8.1)", () => {
    const entree = () => ({
      quarts: quartsParDefaut(),
      groupes: groupes(4),
      educateursDisponibles: educateurs(15),
      compteurs: new Map<string, CompteursEducateur>(),
      reglages: reglagesParDefaut(),
    });

    expect(genererJour(entree()).affectations).toEqual(
      genererJour(entree()).affectations,
    );
  });

  it("donne le même résultat quel que soit l'ordre de la liste d'éducateurs", () => {
    const equipe = educateurs(15);
    const commun = {
      quarts: quartsParDefaut(),
      groupes: groupes(4),
      compteurs: new Map<string, CompteursEducateur>(),
      reglages: reglagesParDefaut(),
    };

    const a = genererJour({ ...commun, educateursDisponibles: equipe });
    const b = genererJour({
      ...commun,
      educateursDisponibles: [...equipe].reverse(),
    });

    expect(a.affectations).toEqual(b.affectations);
  });
});

describe("équité sur l'année scolaire — §4.5, §8.3", () => {
  it("répartit les ouvertures quand tout le monde est présent", () => {
    const { compteurs } = simulerAnnee({
      nbEducateurs: 15,
      nbGroupes: 4,
      nbJournees: 10,
    });

    // 10 journées × 2 ouvertures = 20 ouvertures pour 15 éducateurs.
    expect(ecartSurQuart(compteurs.values(), "OUVERTURE")).toBeLessThanOrEqual(1);
  });

  it("répartit aussi la matinée et l'après-midi", () => {
    const { compteurs } = simulerAnnee({
      nbEducateurs: 15,
      nbGroupes: 4,
      nbJournees: 10,
    });

    expect(ecartSurQuart(compteurs.values(), "MATINEE")).toBeLessThanOrEqual(1);
    expect(ecartSurQuart(compteurs.values(), "APRES_MIDI")).toBeLessThanOrEqual(1);
  });

  it("ne cantonne personne à un rôle sur une année complète (§4.5)", () => {
    const { compteurs } = simulerAnnee({
      nbEducateurs: 15,
      nbGroupes: 4,
      nbJournees: 10,
    });

    // Personne ne doit être systématiquement à l'ouverture, ni jamais.
    for (const c of compteurs.values()) {
      expect(c.parQuart.MATINEE ?? 0).toBeGreaterThan(0);
      expect(c.parQuart.APRES_MIDI ?? 0).toBeGreaterThan(0);
    }
  });

  it("rattrape les écarts créés par les absences (§8.3)", () => {
    // Un éducateur manque les trois premières journées : la rotation fixe
    // serait définitivement faussée, les compteurs doivent rattraper.
    const { compteurs } = simulerAnnee({
      nbEducateurs: 15,
      nbGroupes: 4,
      nbJournees: 12,
      absents: (jour) => (jour < 3 ? new Set(["e-01"]) : new Set()),
    });

    expect(ecartSurQuart(compteurs.values(), "OUVERTURE")).toBeLessThanOrEqual(1);
    expect(ecartSurQuart(compteurs.values(), "MATINEE")).toBeLessThanOrEqual(2);
    expect(ecartSurQuart(compteurs.values(), "APRES_MIDI")).toBeLessThanOrEqual(2);
  });

  it("tient avec des absences dispersées tout au long de l'année", () => {
    const { compteurs } = simulerAnnee({
      nbEducateurs: 15,
      nbGroupes: 4,
      nbJournees: 12,
      absents: (jour, equipe) =>
        new Set([equipe[jour % equipe.length].id, equipe[(jour * 7) % equipe.length].id]),
    });

    expect(ecartSurQuart(compteurs.values(), "OUVERTURE")).toBeLessThanOrEqual(2);
    expect(ecartSurQuart(compteurs.values(), "MATINEE")).toBeLessThanOrEqual(2);
    expect(ecartSurQuart(compteurs.values(), "APRES_MIDI")).toBeLessThanOrEqual(2);
  });

  it("évite de reconduire le même quart d'une journée à la suivante", () => {
    const { journees } = simulerAnnee({
      nbEducateurs: 15,
      nbGroupes: 4,
      nbJournees: 6,
    });

    let reconductions = 0;
    for (let j = 1; j < journees.length; j++) {
      const veille = new Set(
        journees[j - 1]
          .filter((a) => a.quartCode === "OUVERTURE")
          .map((a) => a.educateurId),
      );
      for (const a of journees[j].filter((x) => x.quartCode === "OUVERTURE")) {
        if (veille.has(a.educateurId)) reconductions++;
      }
    }

    expect(reconductions).toBe(0);
  });
});

describe("tranches d'âge déclarées par éducateur", () => {
  /** Seule la matinée est active : un éducateur par groupe, sans enchaînement. */
  const matineeSeule = () =>
    quartsParDefaut().map((q) => ({ ...q, actif: q.code === "MATINEE" }));

  /** groupes(k) donne au groupe d'indice i la tranche « t-i ». */
  const deuxGroupes = () => groupes(2);

  function generer(
    tranchesParEducateur: Map<string, Set<string>>,
    politique: "LIBRE" | "PREFERER" | "IMPOSER",
    equipe = educateurs(2),
  ) {
    return genererJour({
      quarts: matineeSeule(),
      groupes: deuxGroupes(),
      educateursDisponibles: equipe,
      compteurs: new Map(),
      tranchesParEducateur,
      reglages: reglagesParDefaut({ politiqueTrancheEducateur: politique }),
    });
  }

  const groupeDe = (r: ReturnType<typeof genererJour>, educateurId: string) =>
    r.affectations.find((a) => a.educateurId === educateurId)?.groupeId;

  it("ignore les tranches déclarées quand la politique est LIBRE", () => {
    const tranches = new Map([["e-01", new Set(["t-0"])]]);
    const resultat = generer(tranches, "LIBRE");

    expect(resultat.faisable).toBe(true);
    expect(resultat.affectations).toHaveLength(2);
  });

  it("n'affecte un éducateur qu'à ses tranches déclarées sous IMPOSER", () => {
    const tranches = new Map([
      ["e-01", new Set(["t-0"])],
      ["e-02", new Set(["t-1"])],
    ]);
    const resultat = generer(tranches, "IMPOSER");

    expect(resultat.faisable).toBe(true);
    expect(groupeDe(resultat, "e-01")).toBe("g-0");
    expect(groupeDe(resultat, "e-02")).toBe("g-1");
  });

  it("trouve une répartition valide là où un placement glouton échouerait", () => {
    // e-01 passe en premier au tri d'équité et peut tout encadrer ; e-02 ne
    // peut que t-0. Prendre e-01 pour le premier groupe — le réflexe glouton —
    // laisse le second groupe sans personne, alors qu'une solution existe.
    const tranches = new Map([
      ["e-01", new Set(["t-0", "t-1"])],
      ["e-02", new Set(["t-0"])],
    ]);
    const resultat = generer(tranches, "IMPOSER");

    expect(resultat.faisable).toBe(true);
    expect(groupeDe(resultat, "e-02")).toBe("g-0");
    expect(groupeDe(resultat, "e-01")).toBe("g-1");
  });

  it("refuse plutôt que de laisser un groupe sans éducateur habilité", () => {
    const tranches = new Map([
      ["e-01", new Set(["t-0"])],
      ["e-02", new Set(["t-0"])],
    ]);
    const resultat = generer(tranches, "IMPOSER");

    expect(resultat.faisable).toBe(false);
    const blocage = resultat.avertissements.find(
      (a) => a.code === "TRANCHE_SANS_EDUCATEUR",
    );
    expect(blocage).toBeDefined();
    expect(blocage!.message).toContain("Groupe 1");
  });

  it("s'écarte des tranches déclarées plutôt que de bloquer sous PREFERER", () => {
    const tranches = new Map([
      ["e-01", new Set(["t-0"])],
      ["e-02", new Set(["t-0"])],
    ]);
    const resultat = generer(tranches, "PREFERER");

    expect(resultat.faisable).toBe(true);
    // Les deux groupes sont couverts, quitte à sortir de la tranche déclarée.
    const cibles = resultat.affectations.map((a) => a.groupeId).sort();
    expect(cibles).toEqual(["g-0", "g-1"]);
  });

  it("traite une déclaration vide comme « toutes les tranches »", () => {
    // Sans ce défaut, activer la politique figerait toute génération tant
    // qu'aucune tranche n'a été saisie.
    const resultat = generer(new Map(), "IMPOSER");

    expect(resultat.faisable).toBe(true);
    expect(resultat.affectations).toHaveLength(2);
  });

  it("écarte d'un quart par groupe un éducateur habilité pour aucune tranche", () => {
    const tranches = new Map([
      ["e-01", new Set(["t-inexistante"])],
      ["e-02", new Set(["t-0"])],
      ["e-03", new Set(["t-1"])],
    ]);
    const resultat = generer(tranches, "IMPOSER", educateurs(3));

    expect(resultat.faisable).toBe(true);
    expect(
      resultat.affectations.some((a) => a.educateurId === "e-01"),
    ).toBe(false);
  });
});

describe("genererBloc — §4.4, §10", () => {
  const commun = () => ({
    quarts: quartsParDefaut(),
    compteurs: new Map<string, CompteursEducateur>(),
    reglages: reglagesParDefaut(),
  });

  const jours = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      jourPlanifieId: `j${i}`,
      groupes: groupes(4).map((g) => ({ ...g, id: `j${i}-${g.id}` })),
      educateursDisponibles: educateurs(15),
    }));

  it("poursuit la rotation d'un jour au suivant", () => {
    const resultats = genererBloc(jours(3), commun());

    expect(resultats).toHaveLength(3);

    const ouvreurs = resultats.map(
      (r) =>
        new Set(
          r.affectations
            .filter((a) => a.quartCode === "OUVERTURE")
            .map((a) => a.educateurId),
        ),
    );

    // Aucun ouvreur reconduit d'un jour du bloc au suivant.
    for (let i = 1; i < ouvreurs.length; i++) {
      for (const id of ouvreurs[i]) expect(ouvreurs[i - 1].has(id)).toBe(false);
    }
  });

  it("reconduit la même équipe quand le réglage le demande", () => {
    const resultats = genererBloc(jours(3), {
      ...commun(),
      reglages: reglagesParDefaut({
        politiqueBloc: "MEME_EQUIPE_SUR_LE_BLOC",
      }),
    });

    const signature = (r: (typeof resultats)[number]) =>
      r.affectations
        .map((a) => `${a.educateurId}:${a.quartCode}`)
        .sort()
        .join("|");

    expect(signature(resultats[1])).toBe(signature(resultats[0]));
    expect(signature(resultats[2])).toBe(signature(resultats[0]));
    // Les groupes, eux, sont bien ceux du jour concerné.
    expect(
      resultats[1].affectations
        .filter((a) => a.groupeId !== null)
        .every((a) => a.groupeId!.startsWith("j1-")),
    ).toBe(true);
  });
});
