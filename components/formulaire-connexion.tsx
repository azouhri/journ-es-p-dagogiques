"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientSupabaseNavigateur } from "@/lib/supabase/navigateur";

/**
 * §12 — « Une poignée de comptes seulement. Authentification Supabase, sans
 * fournisseur d'identité externe. »
 *
 * Il n'y a volontairement PAS de création de compte ici : les comptes sont
 * créés par la responsable dans le tableau de bord Supabase. Une application
 * qui manipule des données de mineurs n'a pas à offrir d'inscription libre.
 */
export function FormulaireConnexion({ suite }: { suite?: string }) {
  const routeur = useRouter();
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur(null);

    demarrer(async () => {
      const supabase = clientSupabaseNavigateur();
      const { error } = await supabase.auth.signInWithPassword({
        email: courriel.trim(),
        password: motDePasse,
      });

      if (error) {
        // Message volontairement identique pour un courriel inconnu et un mot
        // de passe erroné : distinguer les deux permettrait d'énumérer les
        // comptes existants.
        setErreur("Courriel ou mot de passe incorrect.");
        return;
      }

      routeur.push(suite && suite.startsWith("/") ? suite : "/");
      routeur.refresh();
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Journées pédagogiques</CardTitle>
        <CardDescription>Service de garde en milieu scolaire</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={soumettre} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="courriel">Courriel</Label>
            <Input
              id="courriel"
              name="courriel"
              type="email"
              autoComplete="username"
              required
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="motDePasse">Mot de passe</Label>
            <Input
              id="motDePasse"
              name="motDePasse"
              type="password"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>

          {erreur && (
            <Alert variant="destructive">
              <AlertDescription>{erreur}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={enCours}>
            {enCours ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
