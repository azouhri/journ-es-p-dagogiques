import { FormulaireConnexion } from "@/components/formulaire-connexion";

export const metadata = { title: "Connexion" };

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const { suite } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <FormulaireConnexion suite={suite} />
    </div>
  );
}
