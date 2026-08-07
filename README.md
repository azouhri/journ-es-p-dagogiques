# Générateur de planning des journées pédagogiques

Constitution des groupes et affectation **équitable** des éducateurs pour les
journées pédagogiques d'un service de garde en milieu scolaire au Québec.

La spécification fonctionnelle complète est dans
[`spec-journees-pedagogiques.md`](spec-journees-pedagogiques.md) ; les
références `§4.3`, `§9.5`… dans le code renvoient à ses sections.

## Stack

| Couche | Choix |
|---|---|
| Interface et API | Next.js 16 (App Router), React 19, TypeScript |
| Composants | shadcn/ui (Base UI) + Tailwind CSS 4 |
| ORM | Prisma 6 |
| Base de données | Supabase (PostgreSQL), **région `ca-central-1`** |
| Authentification | Supabase Auth |
| Exports | pdf-lib et ExcelJS, générés dans l'application |
| Tests | Vitest |

## Mise en route

```bash
npm install
cp .env.example .env      # puis renseigner les chaînes de connexion
npx prisma migrate deploy
npm run db:seed           # jeu d'essai déterministe, facultatif
npm run dev
```

Les comptes sont créés dans le tableau de bord Supabase
(**Authentication → Users**). Il n'y a pas d'inscription libre.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Pooler de transaction, port 6543 |
| `DIRECT_URL` | Connexion directe, port 5432, requise par `prisma migrate` |
| `NEXT_PUBLIC_SUPABASE_URL` | Projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publiable, pour l'authentification uniquement |

`.env` n'est jamais versionné. Sur Vercel, ces variables se déclarent dans
**Project Settings → Environment Variables**.

## Commandes

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm test           # 139 tests
npm run typecheck  # vérification TypeScript
npm run db:studio  # explorateur Prisma
```

## Organisation

```
app/          pages, routes et actions serveur
components/   composants d'interface
lib/domain/   algorithme et règles métier — sans dépendance à Prisma
lib/data/     accès aux données
prisma/       schéma, migrations et jeu d'essai
tests/        jeux de données partagés
```

`lib/domain/` ne dépend d'aucune base de données : la constitution des
groupes, les compteurs d'équité et l'algorithme d'affectation s'y testent
en isolation.

## Points structurants

- **Les types de quart sont de la configuration, pas du code** (§4.1).
  Activer la soirée et la fermeture est une case à cocher.
- **Aucune table de compteurs d'équité** (§9.5). Ils sont recalculés depuis
  les affectations croisées avec les présences, et ne peuvent donc jamais se
  désynchroniser du réalisé.
- **Une modification de configuration ne réécrit jamais le passé** (§4.6).
  Chaque affectation porte une copie figée des horaires du quart.
- **Le ratio de 1 pour 20 est la seule contrainte non contournable** (§3) ;
  tout le reste relève d'un réglage.

## Loi 25

L'application manipule des données de mineurs.

- Base hébergée dans la **région canadienne** — non modifiable après création.
- **RLS activé sur toutes les tables**, sans aucune politique : la clé
  publiable exposée au navigateur ne peut ni lire ni écrire. Les accès passent
  par Prisma, côté serveur.
- Toutes les routes sont protégées par authentification, exports compris.
- Les imports et changements de statut sont journalisés.
- Aucune donnée d'élève n'est transmise à un service tiers, y compris pour
  produire les PDF et les Excel.
