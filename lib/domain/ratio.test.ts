import { describe, expect, it } from "vitest";

import {
  calculerRatio,
  educateursPresents,
  elevesPresentsPendant,
  type PresenceEleveFenetre,
} from "./ratio";
import { versMinutes } from "./temps";

const OUVERTURE = [versMinutes("06:45"), versMinutes("09:00")] as const;
const MATINEE = [versMinutes("09:00"), versMinutes("12:00")] as const;
const APRES_MIDI = [versMinutes("12:00"), versMinutes("17:30")] as const;

function eleve(
  arrivee: string | null,
  depart: string | null,
  statut: PresenceEleveFenetre["statut"] = "PRESENT",
): PresenceEleveFenetre {
  return {
    statut,
    arriveeMinutes: arrivee ? versMinutes(arrivee) : null,
    departMinutes: depart ? versMinutes(depart) : null,
  };
}

describe("elevesPresentsPendant — §3, §9.3", () => {
  it("ne compte pas un élève arrivé après la fin du quart", () => {
    // C'est le cas de l'ouverture : la plupart des élèves arrivent vers 8 h,
    // ils ne sont pas là à 6 h 45.
    const presences = [eleve("08:30", "17:00")];
    expect(elevesPresentsPendant(presences, 405, versMinutes("07:00")).nombre).toBe(0);
  });

  it("compte un élève déjà arrivé pendant le quart", () => {
    const presences = [eleve("07:00", "17:00")];
    expect(elevesPresentsPendant(presences, ...OUVERTURE).nombre).toBe(1);
  });

  it("ne compte pas un élève parti avant le début du quart", () => {
    const presences = [eleve("07:00", "12:00")];
    expect(elevesPresentsPendant(presences, ...APRES_MIDI).nombre).toBe(0);
  });

  it("traite les bornes en intervalles semi-ouverts", () => {
    // Parti à 12 h 00 : présent le matin, absent l'après-midi.
    const presences = [eleve("07:00", "12:00")];
    expect(elevesPresentsPendant(presences, ...MATINEE).nombre).toBe(1);
    expect(elevesPresentsPendant(presences, ...APRES_MIDI).nombre).toBe(0);
  });

  it("ne compte jamais un élève absent", () => {
    const presences = [eleve(null, null, "ABSENT")];
    expect(elevesPresentsPendant(presences, ...MATINEE).nombre).toBe(0);
  });

  it("compte sur tout le quart un élève dont l'heure n'a pas été relevée", () => {
    // Sans information, on surestime la charge plutôt que de masquer un
    // dépassement.
    const presences = [eleve(null, null)];
    expect(elevesPresentsPendant(presences, ...OUVERTURE).nombre).toBe(1);
    expect(elevesPresentsPendant(presences, ...APRES_MIDI).nombre).toBe(1);
  });

  it("répartit correctement une cohorte réaliste sur la journée", () => {
    const presences = [
      eleve("06:50", "17:00"), // arrivé dès l'ouverture
      eleve("07:30", "17:00"),
      eleve("08:45", "17:00"),
      eleve("09:10", "17:00"), // arrivé après l'ouverture
      eleve("09:20", "12:00"), // parti tôt
      eleve(null, null, "ABSENT"),
    ];

    expect(elevesPresentsPendant(presences, ...OUVERTURE).nombre).toBe(3);
    expect(elevesPresentsPendant(presences, ...MATINEE).nombre).toBe(5);
    expect(elevesPresentsPendant(presences, ...APRES_MIDI).nombre).toBe(4);
  });
});

describe("educateursPresents — §3, §9.4", () => {
  it("compte un présent", () => {
    expect(educateursPresents([{ statut: "PRESENT", remplacantId: null }])).toBe(1);
  });

  it("ne compte pas un absent", () => {
    expect(educateursPresents([{ statut: "ABSENT", remplacantId: null }])).toBe(0);
  });

  it("compte un remplacement seulement si le remplaçant est désigné", () => {
    expect(educateursPresents([{ statut: "REMPLACE", remplacantId: "e9" }])).toBe(1);
    expect(educateursPresents([{ statut: "REMPLACE", remplacantId: null }])).toBe(0);
  });

  it("compte une affectation sans présence saisie", () => {
    // Pré-remplies à « présent » dès la validation (§9.4).
    expect(educateursPresents([null])).toBe(1);
  });
});

describe("calculerRatio — §3", () => {
  it("signale un dépassement au-delà du plafond", () => {
    expect(calculerRatio({ nombre: 42, estime: false }, 2, 20).depasse).toBe(true);
  });

  it("ne signale rien à exactement 20 élèves par éducateur", () => {
    // 20 est le maximum LÉGAL : l'atteindre est conforme.
    const r = calculerRatio({ nombre: 40, estime: false }, 2, 20);
    expect(r.ratio).toBe(20);
    expect(r.depasse).toBe(false);
  });

  it("ne signale pas l'ouverture quand peu d'élèves sont arrivés", () => {
    // 2 éducateurs à l'ouverture, 3 élèves présents à 7 h : conforme.
    expect(calculerRatio({ nombre: 3, estime: false }, 2, 20).depasse).toBe(false);
  });

  it("signale l'absence totale d'éducateur devant des élèves", () => {
    const r = calculerRatio({ nombre: 12, estime: false }, 0, 20);
    expect(r.ratio).toBeNull();
    expect(r.depasse).toBe(true);
  });

  it("ne signale rien quand il n'y a ni élève ni éducateur", () => {
    expect(calculerRatio({ nombre: 0, estime: false }, 0, 20).depasse).toBe(false);
  });
});

describe("quart d'accueil — §4.3", () => {
  it("ne déclare pas non conforme un accueil dont l'effectif est estimé", () => {
    // Le cas réel : 117 élèves inscrits, 2 personnes à l'ouverture, aucune
    // heure d'arrivée relevée. On ne sait pas combien d'élèves étaient là à
    // 6 h 45 ; l'effectif de l'accueil est d'ailleurs fixé par la
    // configuration (deux postes), pas déduit d'un ratio.
    const r = calculerRatio({ nombre: 117, estime: true }, 2, 20, {
      quartDAccueil: true,
    });

    expect(r.depasse).toBe(false);
    expect(r.indetermine).toBe(true);
    expect(r.ratio).toBeCloseTo(58.5);
  });

  it("signale bel et bien un accueil dépassé quand les heures sont relevées", () => {
    // Plus d'estimation : 60 élèves réellement présents pour 2 personnes est
    // un dépassement, accueil ou pas.
    const r = calculerRatio({ nombre: 60, estime: false }, 2, 20, {
      quartDAccueil: true,
    });

    expect(r.depasse).toBe(true);
    expect(r.indetermine).toBe(false);
  });

  it("garde le contrôle strict sur les quarts d'encadrement par groupe", () => {
    // Même effectif estimé, mais ce n'est pas un accueil : la matinée encadre
    // les élèves par groupe, le plafond s'applique pleinement.
    const r = calculerRatio({ nombre: 117, estime: true }, 2, 20);

    expect(r.depasse).toBe(true);
    expect(r.indetermine).toBe(false);
  });

  it("signale toujours un accueil sans aucun éducateur", () => {
    // L'indétermination ne doit jamais masquer une absence totale de
    // surveillance.
    const r = calculerRatio({ nombre: 117, estime: true }, 0, 20, {
      quartDAccueil: true,
    });

    expect(r.depasse).toBe(true);
    expect(r.indetermine).toBe(false);
  });
});
