import { chargerJourneePourExport } from "@/lib/export/donnees";
import { feuillePresencePdf, planningPdf } from "@/lib/export/pdf";
import { planningXlsx } from "@/lib/export/xlsx";

/**
 * §12 — les exports sont fabriqués dans l'application. Aucune donnée d'élève
 * n'est transmise à un service tiers pour produire un PDF ou un Excel.
 */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string; fichier: string }> },
) {
  const { id, fichier } = await contexte.params;

  const journee = await chargerJourneePourExport(id);
  if (!journee) {
    return new Response("Journée introuvable.", { status: 404 });
  }

  // Nom de fichier lisible, sans accent ni espace.
  const base = journee.nom
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  switch (fichier) {
    case "planning.pdf": {
      const octets = await planningPdf(journee);
      return new Response(octets as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="planning-${base}.pdf"`,
        },
      });
    }

    case "presences.pdf": {
      const octets = await feuillePresencePdf(journee);
      return new Response(octets as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="presences-${base}.pdf"`,
        },
      });
    }

    case "planning.xlsx": {
      const tampon = await planningXlsx(journee);
      return new Response(tampon as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="planning-${base}.xlsx"`,
        },
      });
    }

    default:
      return new Response("Format inconnu.", { status: 404 });
  }
}
