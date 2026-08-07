import { isValidElement } from "react";

/**
 * Le composant rendu est-il un <button> natif ?
 *
 * Base UI suppose un <button> et avertit dès qu'on lui fait rendre autre
 * chose — typiquement un <Link> pour une action de navigation. Plutôt que de
 * répéter `nativeButton={false}` sur chaque appel (et de l'oublier au
 * suivant), on le déduit de l'élément passé à `render`.
 *
 * Une fonction de rendu est traitée comme un bouton natif : son résultat
 * n'est pas inspectable ici, et l'appelant garde la possibilité de passer
 * explicitement `nativeButton`.
 */
export function estBoutonNatif(render: unknown): boolean {
  if (!render) return true;
  if (!isValidElement(render)) return true;
  return render.type === "button";
}
