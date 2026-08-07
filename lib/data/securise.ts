import "server-only";

/**
 * Exécute une lecture en base en tolérant l'absence de connexion.
 *
 * L'application doit rester utilisable sans base pour tout ce qui n'en dépend
 * pas — au premier rang, la prévisualisation d'un import CSV, qui est une
 * fonction pure. Bloquer la page entière parce que la base est injoignable
 * cachait des écrans qui fonctionnent parfaitement.
 */
export async function essayer<T>(
  lecture: () => Promise<T>,
  secours: T,
): Promise<T> {
  try {
    return await lecture();
  } catch {
    return secours;
  }
}
