"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { ResultatAction } from "./journees";

/** §9.1 — présent, absent ou parti tôt. */
export async function saisirPresenceEleve(
  presenceId: string,
  statut: "PRESENT" | "ABSENT" | "PARTI_TOT",
): Promise<ResultatAction> {
  const presence = await prisma.presenceEleve.update({
    where: { id: presenceId },
    data: {
      statut,
      // Un élève absent n'a ni heure d'arrivée ni heure de départ.
      ...(statut === "ABSENT"
        ? { heureArriveeMinutes: null, heureDepartMinutes: null }
        : {}),
    },
    include: { jourPlanifie: { select: { journeePedagogiqueId: true } } },
  });

  revalidatePath(
    `/journees/${presence.jourPlanifie.journeePedagogiqueId}/presences`,
  );
  return { ok: true, message: "Présence enregistrée." };
}

/**
 * §9.2 / §9.4 — présent, absent ou remplacé.
 * Un remplacement sans remplaçant désigné ne crédite personne : la place est
 * restée vide dans le réalisé.
 */
export async function saisirPresenceEducateur(
  presenceId: string,
  statut: "PRESENT" | "ABSENT" | "REMPLACE",
  remplacantId: string | null,
): Promise<ResultatAction> {
  if (statut === "REMPLACE" && !remplacantId) {
    return {
      ok: false,
      message:
        "Désigner le remplaçant : c'est lui qui sera crédité du quart, pas le titulaire.",
    };
  }

  const presence = await prisma.presenceEducateur.update({
    where: { id: presenceId },
    data: {
      statut,
      remplacantId: statut === "REMPLACE" ? remplacantId : null,
    },
    include: {
      affectation: {
        select: {
          jourPlanifie: { select: { journeePedagogiqueId: true } },
        },
      },
    },
  });

  revalidatePath(
    `/journees/${presence.affectation.jourPlanifie.journeePedagogiqueId}/presences`,
  );
  return { ok: true, message: "Présence enregistrée." };
}

/** §9.1 — saisie en masse, puis correction des exceptions. */
export async function marquerToutPresent(
  jourPlanifieId: string,
): Promise<ResultatAction> {
  const [eleves, educateurs] = await prisma.$transaction([
    prisma.presenceEleve.updateMany({
      where: { jourPlanifieId },
      data: { statut: "PRESENT" },
    }),
    prisma.presenceEducateur.updateMany({
      where: { affectation: { jourPlanifieId } },
      data: { statut: "PRESENT", remplacantId: null },
    }),
  ]);

  const jour = await prisma.jourPlanifie.findUnique({
    where: { id: jourPlanifieId },
    select: { journeePedagogiqueId: true },
  });
  if (jour) revalidatePath(`/journees/${jour.journeePedagogiqueId}/presences`);

  return {
    ok: true,
    message: `${eleves.count} élève(s) et ${educateurs.count} éducateur(s) marqués présents.`,
  };
}

/**
 * §9.6 — confirmer la journée.
 *
 * Une journée non confirmée n'est pas fausse, elle est seulement non vérifiée :
 * la confirmation atteste que la responsable a bien regardé les exceptions.
 */
export async function confirmerJour(
  jourPlanifieId: string,
): Promise<ResultatAction> {
  const jour = await prisma.jourPlanifie.update({
    where: { id: jourPlanifieId },
    data: {
      statutConfirmation: "CONFIRME",
      confirmeLe: new Date(),
    },
  });

  revalidatePath(`/journees/${jour.journeePedagogiqueId}/presences`);
  revalidatePath("/journees");
  revalidatePath("/equite");
  revalidatePath("/");
  return { ok: true, message: "Journée confirmée." };
}

export async function annulerConfirmation(
  jourPlanifieId: string,
): Promise<ResultatAction> {
  // Corriger une présence après coup doit rester possible : les compteurs
  // étant recalculés, la correction se répercute instantanément (§9.5).
  const jour = await prisma.jourPlanifie.update({
    where: { id: jourPlanifieId },
    data: { statutConfirmation: "A_CONFIRMER", confirmeLe: null },
  });

  revalidatePath(`/journees/${jour.journeePedagogiqueId}/presences`);
  revalidatePath("/journees");
  return { ok: true, message: "Confirmation annulée." };
}
