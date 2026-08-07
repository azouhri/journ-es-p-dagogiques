/**
 * Doublure du paquet `server-only` pour les tests.
 *
 * Le vrai module lève une exception hors d'un composant serveur, ce qui rend
 * `lib/xlsx.ts` intestable. Or c'est précisément le module où un désaccord
 * entre l'écriture et la lecture casse l'aller-retour export / import — le
 * genre de régression qu'on veut attraper par un test, pas en production.
 */
export {};
