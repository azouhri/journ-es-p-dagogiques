# Générateur de planning des journées pédagogiques
## Spécification produit

**Dernière mise à jour : 6 août 2026** · Document unique, mis à jour en place. Remplace tous les brouillons antérieurs.

---

## 1. Le problème

Un service de garde en milieu scolaire au Québec organise, plusieurs fois par année scolaire, des journées pédagogiques : des journées sans classe pendant lesquelles les élèves inscrits sont accueillis à l'école et encadrés par des éducateurs.

La responsable planifie aujourd'hui ces journées sous Excel. Deux difficultés :

1. **Le temps.** Constituer les groupes puis affecter les éducateurs prend un nombre d'heures considérable à chaque journée pédagogique.
2. **L'équité.** Sur l'année, aucun éducateur ne doit se retrouver systématiquement à l'ouverture, ni systématiquement en après-midi. Cet équilibrage se fait de tête et se dégrade au fil de l'année. Excel ne conserve pas d'historique exploitable.

---

## 2. Périmètre

### Ce que fait la Version 1

- Gérer la liste des élèves et la liste des éducateurs, avec import CSV
- Configurer les types de quart, leurs horaires et les tranches d'âge
- Créer une journée pédagogique (une date ou un bloc de dates consécutives)
- Sélectionner les élèves qui participent
- Créer automatiquement les groupes selon les tranches d'âge
- **Générer automatiquement le planning des éducateurs, équitable sur l'année scolaire**
- Permettre l'ajustement manuel puis la validation
- **Saisir les présences des élèves et des éducateurs**, avec contrôle du ratio et rappel automatique tant qu'une journée n'a pas été confirmée
- Afficher un tableau de bord d'équité par éducateur
- Exporter le planning et les feuilles de présence en PDF et en Excel

### Ce qu'elle ne fait pas en Version 1

- Aucun envoi aux parents. La collecte des réponses reste hors système ; la responsable saisit la liste des élèves confirmés.
- Aucune évaluation, ni des élèves ni des éducateurs
- Aucune facturation ni portail parents
- Aucun pointage automatique. Les présences sont saisies par la responsable, pas par les parents ni par un lecteur de badge.
- Une seule école

Ces fonctions sont prévues pour plus tard (§13). Le modèle de données de la Version 1 est conçu pour les accueillir sans réécriture.

---

## 3. Cadre québécois retenu

**Ratio maximal de 1 éducateur pour 20 élèves présents.** Fixé par le Règlement sur les services de garde en milieu scolaire ; seuls les membres du personnel effectivement présents auprès des élèves comptent dans le calcul. L'application l'applique de deux façons : comme plafond de taille de groupe à la constitution, et comme alerte à la saisie des présences.

**Loi 25 sur la protection des renseignements personnels.** L'application manipule des données de mineurs. Conséquences concrètes : base de données hébergée dans la région canadienne, accès protégé par mot de passe, aucune donnée d'élève transmise à un service tiers, journal des modifications.

Les règles de tarification, de financement ministériel et de communication aux parents ne concernent pas la Version 1.

---

## 4. Modèle métier

### 4.1 Les types de quart sont de la configuration, pas du code

C'est la décision structurante de la Version 1. Plutôt que de coder trois rôles en dur, l'application traite les quarts comme une **table de configuration**. En ajouter un plus tard ne demande aucune modification de l'algorithme.

Chaque type de quart possède les propriétés suivantes :

| Propriété | Description |
|---|---|
| **Code et libellé** | identifiant et nom affiché |
| **Heure de début et de fin** | librement configurables |
| **Portée** | `TOUS_GROUPES` (une équipe commune, ex. l'ouverture) ou `PAR_GROUPE` (un éducateur par groupe) |
| **Effectif requis** | un nombre fixe si la portée est `TOUS_GROUPES`, sinon un par groupe |
| **Enchaîne sur** | le quart que l'éducateur poursuit obligatoirement ensuite, s'il y a lieu |
| **Actif** | si le quart est utilisé dans la génération |
| **Ordre** | position chronologique dans la journée |

### 4.2 Configuration initiale

Cinq quarts sont définis dès le départ ; **trois seulement sont actifs en Version 1**. Les deux autres existent en base et seront activés par une case à cocher, sans développement.

| Quart | Horaire par défaut | Portée | Effectif | Enchaîne sur | Actif |
|---|---|---|---|---|---|
| **Ouverture** | 6 h 45 – 9 h 00 | Tous groupes | 2 | Matinée | Oui |
| **Matinée** | 9 h 00 – 12 h 00 | Par groupe | 1 par groupe | — | Oui |
| **Après-midi** | 12 h 00 – 17 h 30 | Par groupe | 1 par groupe | — | Oui |
| **Soirée** | 17 h 30 – 18 h 30 | Par groupe | 1 par groupe | — | Non |
| **Fermeture** | 18 h 30 – 19 h 00 | Tous groupes | 2 | — | Non |

Tous les horaires ci-dessus sont des valeurs par défaut modifiables dans les paramètres. Aucun n'est figé.

### 4.3 La règle d'enchaînement

L'éducateur affecté à l'**ouverture** arrive tôt, ouvre le service, réceptionne les élèves de tous les groupes, puis **enchaîne obligatoirement sur la matinée** avec son propre groupe. Ce n'est pas un quart distinct : c'est une matinée avec arrivée anticipée.

**Pourquoi deux personnes à l'ouverture.** L'effectif par défaut n'est pas arbitraire : il correspond à deux postes physiques distincts. Une personne se tient à la porte pour accueillir les élèves et vérifier les arrivées, l'autre encadre la grande salle où les élèves s'accumulent avant la répartition en groupes. C'est un besoin de surveillance, pas un besoin d'encadrement par groupe. L'effectif reste néanmoins configurable, chaque école ayant sa propre configuration de locaux.

Conséquence pour l'algorithme : affecter quelqu'un à un quart qui enchaîne consomme aussi une place du quart suivant. Pour k groupes avec 2 ouvertures, il faut donc k éducateurs le matin (dont 2 arrivés tôt) et k l'après-midi, soit **2k éducateurs mobilisés**, pas 2k + 2.

### 4.4 Journées multiples

Une journée pédagogique peut couvrir plusieurs jours consécutifs. Chaque jour est planifié séparément et la rotation se poursuit d'un jour au suivant.

### 4.5 Ce que « équitable » veut dire ici

Un éducateur est traité équitablement si, sur l'ensemble de l'année scolaire, il n'a pas été cantonné à un rôle. **Un compteur par éducateur et par type de quart** doit rester proche entre collègues. Le cumul d'heures sert de critère de départage secondaire, l'ouverture étant une journée plus longue.

Les compteurs étant dynamiques, activer la soirée et la fermeture plus tard ajoutera automatiquement deux compteurs sans toucher au code.

### 4.6 La configuration ne réécrit jamais le passé

Règle absolue : **une modification de configuration ne doit jamais altérer une journée déjà réalisée.** Sans cette garantie, changer un horaire en janvier fausserait rétroactivement les heures cumulées de septembre, et l'historique d'équité perdrait toute valeur de preuve.

Trois mécanismes l'assurent :

**Versions de configuration.** Toute modification des types de quart, des tranches d'âge ou des réglages crée une nouvelle version. Chaque journée pédagogique conserve la référence de la version en vigueur au moment de sa génération. Les versions ne sont jamais écrasées.

**Dénormalisation dans l'affectation.** Chaque affectation recopie le libellé du quart et ses heures de début et de fin au moment où elle est créée. Même si le type de quart est renommé, ré-horaire ou désactivé par la suite, l'affectation historique s'affiche telle qu'elle a été vécue.

**Compteurs conservés par code de quart.** Désactiver la soirée n'efface pas les soirées déjà travaillées. Elles restent visibles dans le tableau d'équité, dans une colonne marquée comme inactive.

Conséquences pratiques :

- Activer la soirée en cours d'année : tous les éducateurs démarrent à zéro sur ce compteur, ce qui est équitable puisque la comparaison se fait quart par quart.
- Désactiver un quart : l'algorithme cesse de l'affecter, l'historique reste intact.
- L'algorithme lit **toujours** les quarts actifs depuis la configuration. Passer de trois à cinq quarts, ou revenir à trois, ne demande aucune modification de code.

---

## 5. Écrans de gestion des données

### 5.1 Élèves

Liste avec recherche, filtre par tranche d'âge et par statut actif.

Fiche élève : nom, prénom, **date de naissance** (obligatoire), **niveau scolaire** (facultatif), notes libres, actif ou non, date d'inscription.

Les deux informations sont stockées. Un réglage `mode de groupement` détermine laquelle sert à constituer les groupes : par **âge calculé** ou par **niveau scolaire**. Basculer de l'un à l'autre ne demande aucune migration de données.

**Import CSV** avec prévisualisation, détection des doublons sur nom + date de naissance, et rapport d'erreurs ligne par ligne avant validation. Export CSV également disponible.

### 5.2 Éducateurs

Liste avec recherche et filtre par statut.

Fiche éducateur : nom, prénom, courriel, statut d'emploi, date d'embauche, actif ou non.

**Le temps partiel n'est pas modélisé.** Un éducateur qui n'est pas disponible un jour donné est simplement décoché à l'étape 3 du parcours de planification, exactement comme une absence. Cette règle évite un champ, un réglage et toute une classe de calculs pondérés, sans rien perdre : la disponibilité réelle est déjà l'information dont l'algorithme a besoin.

Import et export CSV selon le même principe.

**Règle importante** : désactiver un éducateur ne supprime ni ses affectations passées ni ses compteurs. L'historique d'équité doit rester intact.

### 5.3 Paramètres

Trois onglets : types de quart (tableau éditable du §4.2), tranches d'âge, et réglages généraux (§10).

---

## 6. Parcours de planification

**Étape 1 — Créer la journée.** Nom, date unique ou plage de dates consécutives.

**Étape 2 — Sélectionner les élèves participants.** Sélection multiple avec recherche et filtre par tranche d'âge.

**Étape 3 — Confirmer les éducateurs disponibles.** Tous cochés par défaut ; la responsable décoche les absents. Un éducateur décoché est ignoré par la génération et **son retard est reporté** sur la journée pédagogique suivante.

**Étape 4 — Vérifier les tranches d'âge**, reprises de la configuration et modifiables ponctuellement.

**Étape 5 — Générer.** Le système crée les groupes puis le planning, et affiche le résultat quart par quart.

**Étape 6 — Ajuster.** Permutation manuelle de deux éducateurs. Le système signale si un ajustement dégrade l'équité, sans l'interdire.

**Étape 7 — Valider.** Le planning passe en statut validé et les affectations prévues sont figées.

**Étape 8 — Exporter.** PDF pour affichage, Excel pour retraitement.

---

## 7. Constitution automatique des groupes

1. Chaque élève est classé dans sa tranche d'âge.
2. Une tranche sans élève ne produit aucun groupe.
3. Si une tranche dépasse la capacité maximale (défaut 20), elle est scindée en autant de sous-groupes que nécessaire, nommés « 8-9 ans — A », « 8-9 ans — B ». La répartition est équilibrée : 27 élèves donnent 14 et 13, pas 20 et 7.
4. Le nombre de groupes détermine l'effectif requis. Si les éducateurs disponibles sont insuffisants, le système l'annonce avant de générer en indiquant combien il en manque.

---

## 8. Algorithme de génération

### 8.1 Principe

Chaque éducateur porte, pour l'année scolaire en cours : un compteur par type de quart actif, plus `heures_cumulées` et `nb_journées_travaillées`.

Pour chaque jour à planifier :

**Passe 1 — Faisabilité.** Calculer les places requises en parcourant les quarts actifs : effectif fixe pour ceux de portée `TOUS_GROUPES`, un par groupe pour les autres, en retranchant les places absorbées par les enchaînements. Si l'effectif disponible est insuffisant, arrêt avec message explicite.

**Passe 2 à n — Un passage par type de quart, dans l'ordre chronologique.** Pour chaque quart actif :

- écarter les éducateurs déjà affectés à un quart qui chevauche celui-ci
- trier les candidats restants par **compteur de ce type de quart** croissant
- départager successivement par :
  1. `heures_cumulées` le plus bas
  2. `nb_journées_travaillées` le plus bas
  3. n'a pas tenu le même quart lors de la journée pédagogique précédente
  4. ordre alphabétique — garantit que deux générations identiques donnent le même résultat
- retenir le nombre de personnes requis
- si le quart enchaîne sur un autre, réserver immédiatement leurs places dans le quart suivant

**Attribution aux groupes.** Chaque éducateur reçoit un groupe. Si le réglage de continuité est actif, on privilégie la tranche d'âge où il a le plus d'historique ; sinon rotation simple.

### 8.2 Tout est lu depuis la configuration

L'algorithme ne contient aucune règle métier en dur. À chaque exécution il lit : les quarts actifs et leurs propriétés, le mode de groupement, le comportement en cas d'effectif d'ouverture supérieur au nombre de groupes, l'autorisation du double poste, le traitement des blocs de plusieurs jours, et le critère de départage.

Changer une politique se fait donc dans les réglages, jamais dans le code. C'est ce qui permettra d'activer la soirée et la fermeture, ou de passer au groupement par niveau, sans redéploiement.

### 8.3 Pourquoi ce mécanisme plutôt qu'une rotation fixe

Une rotation fixe — « tout le monde décale de deux rangs à chaque journée » — donne le bon résultat tant que l'effectif est complet. Dès qu'un éducateur est absent une journée, il sort de la rotation et le décalage devient faux pour tout le reste de l'année.

Les compteurs produisent **la même rotation quand tout le monde est présent**, et rattrapent automatiquement les écarts créés par les absences.

### 8.4 Justification des affectations

Le système conserve, pour chaque affectation, la raison retenue — par exemple « ouverture : 3 ouvertures au compteur, le plus bas de l'équipe ». Cela permet de répondre factuellement à un éducateur qui conteste son horaire.

---

## 9. Présences

### 9.1 Élèves

Un écran par jour, une section par groupe. Pour chaque élève : **présent, absent ou parti tôt**, avec heure d'arrivée et heure de départ facultatives. Saisie en masse possible (« tout marquer présent », puis correction des exceptions).

### 9.2 Éducateurs

Pour chaque affectation du jour : **présent, absent ou remplacé**. Si l'éducateur est remplacé, on désigne le remplaçant parmi les éducateurs actifs.

### 9.3 Contrôle du ratio

L'écran affiche en continu, par quart, le nombre d'élèves présents divisé par le nombre d'éducateurs présents, avec une alerte visuelle au-delà de 20. Le seuil est configurable mais 20 est le maximum légal.

### 9.4 Le prévu et le réalisé sont deux choses distinctes

L'application conserve les deux et ne les confond jamais.

**Le prévu** est créé à la validation du planning : qui devait tenir quel quart, dans quel groupe.

**Le réalisé** est le résultat de la saisie des présences. Pour alléger le travail, le système **pré-remplit toutes les présences avec le statut « présent »** dès la validation du planning. La responsable ne saisit donc que les exceptions, ce qui prend quelques secondes au lieu de plusieurs minutes.

Trois statuts pour un éducateur :

| Statut | Effet |
|---|---|
| **Présent** | Le quart lui est crédité |
| **Absent** | Aucun crédit. Sa place reste vide dans le réalisé, et l'écart apparaît dans le rapport |
| **Remplacé** | Aucun crédit pour lui. Le remplaçant doit être désigné, et c'est lui qui est crédité |

Un écran compare le prévu et le réalisé côte à côte, avec les écarts en évidence.

### 9.5 Les compteurs d'équité sont calculés, jamais stockés

Les compteurs ne sont pas une donnée entretenue en base : ils sont **recalculés à la demande** à partir des affectations croisées avec les présences.

Trois avantages décisifs :

- ils ne peuvent jamais se désynchroniser de la réalité
- corriger une présence deux semaines après coup se répercute instantanément sur le tableau d'équité et sur la prochaine génération
- aucune tâche de recalcul, aucune procédure de rattrapage en cas d'incident

Le volume est négligeable : une quinzaine d'éducateurs sur une dizaine de journées par an. Si la lecture devenait lente à plusieurs années d'historique, une vue matérialisée rafraîchie à chaque confirmation de journée suffirait.

### 9.6 Rappel de saisie

Chaque jour planifié porte un statut : **à confirmer** ou **confirmé**.

Tant qu'un jour n'est pas confirmé :

- un badge apparaît sur la journée dans la liste
- une alerte figure sur le tableau de bord
- un courriel de rappel est envoyé à la responsable après un délai configurable (défaut : le lendemain matin)
- le tableau d'équité signale les journées non confirmées

Nuance importante : comme le système pré-remplit tout le monde présent, **une journée non confirmée n'est pas fausse, elle est seulement non vérifiée**. Le rappel sert à ce que les absences réelles ne soient pas oubliées, pas à empêcher le fonctionnement.

### 9.7 Exports

Feuille de présence vierge en PDF, imprimable comme solution de repli si le réseau tombe. Rapport de présences en Excel par journée ou sur une période.

---

## 10. Paramètres

### Réglages courants

| Paramètre | Valeur par défaut |
|---|---|
| Types de quart, horaires, effectifs, portée | tableau du §4.2 |
| Capacité maximale d'un groupe | 20 élèves |
| Tranches d'âge (début et fin) | à définir |

### Réglages avancés

Aucun comportement de l'algorithme n'est codé en dur. Tout ce qui suit est lu depuis la configuration à chaque génération, et versionné (§4.6).

| Paramètre | Options | Valeur par défaut |
|---|---|---|
| Mode de groupement | par âge calculé · par niveau scolaire | par âge calculé |
| Date de référence pour le calcul de l'âge | date libre | 30 septembre de l'année scolaire |
| Délai avant rappel de saisie des présences | durée libre | lendemain matin |
| Éviter le même quart deux journées pédagogiques de suite | activé · désactivé | activé |
| Continuité éducateur / tranche d'âge | activé · désactivé | désactivé |
| Double poste : un éducateur peut-il tenir deux quarts non contigus le même jour ? | jamais · uniquement en cas d'effectif insuffisant · toujours autorisé | uniquement en cas d'effectif insuffisant |
| Bloc de plusieurs jours consécutifs | chaque jour planifié séparément · même équipe sur tout le bloc | chaque jour planifié séparément |
| Si l'effectif requis à l'ouverture dépasse le nombre de groupes | réduire l'ouverture au nombre de groupes · le surnuméraire reste en renfort sur un groupe · un éducateur d'un quart ultérieur vient en avance puis revient | réduire l'ouverture au nombre de groupes |
| Critère de départage prioritaire | heures cumulées · nombre de journées travaillées | heures cumulées |
| Report de l'écart résiduel sur l'année suivante | activé · désactivé | activé |

---

## 11. Données

| Entité | Contenu |
|---|---|
| **AnnéeScolaire** | dates de début et de fin, statut |
| **TypeQuart** | les propriétés du §4.1, rattaché à une année scolaire |
| **TrancheÂge** | libellé, borne inférieure, borne supérieure |
| **Élève** | nom, date de naissance, niveau scolaire (facultatif), notes, actif |
| **Éducateur** | nom, courriel, statut d'emploi, date d'embauche, actif |
| **VersionConfiguration** | instantané des types de quart, tranches d'âge et réglages ; référencée par chaque journée, jamais écrasée |
| **JournéePédagogique** | nom, statut (brouillon / généré / validé), année scolaire |
| **JourPlanifié** | date, rattachée à une journée pédagogique |
| **Participation** | élève × journée pédagogique |
| **Disponibilité** | éducateur × jour planifié |
| **Groupe** | tranche d'âge, jour planifié, élèves rattachés |
| **Affectation** | éducateur × groupe × jour × type de quart, avec justification, **et copie du libellé et des horaires du quart** au moment de la création |
| **PrésenceÉlève** | élève × jour × groupe : statut, arrivée, départ |
| **PrésenceÉducateur** | affectation : statut (présent / absent / remplacé), remplaçant éventuel |

**Il n'existe pas de table de compteurs d'équité.** Ils sont calculés à la demande depuis `Affectation` × `PrésenceÉducateur` (§9.5).

Prévu dès maintenant pour ne rien casser plus tard : un élève peut avoir deux tuteurs (garde partagée), et une affectation peut recevoir une évaluation.

---

## 12. Choix techniques

### Stack retenue

| Couche | Choix | Raison |
|---|---|---|
| Interface et API | **Next.js (TypeScript)** | Un seul projet, un seul dépôt, un seul langage pour l'interface et le serveur |
| ORM | **Prisma** | Migrations versionnées et typage de bout en bout depuis le schéma |
| Base de données | **Supabase (PostgreSQL)** | Postgres géré, mise en route immédiate. Base locale sous Docker prévue plus tard pour le développement hors ligne |
| Hébergement | **Vercel** | Déploiement direct depuis le dépôt |
| Algorithme | **TypeScript, dans le projet** | Environ 200 lignes de tri et de compteurs. Aucune bibliothèque d'optimisation nécessaire |
| Exports | Bibliothèque JavaScript PDF et Excel | Aucune donnée d'élève ne sort de l'application |

**Point de vigilance Loi 25** : le projet Supabase doit être créé dans la **région canadienne**. Ce choix est fait à la création et n'est pas modifiable ensuite. À vérifier également : la région d'exécution des fonctions Vercel et ce qu'elle implique pour le transfert de renseignements personnels hors Québec.

### Ce qui a été écarté

Un service séparé en Python avec une bibliothèque de résolution par contraintes était justifié tant que l'affectation semblait être un problème d'optimisation. Après clarification, elle se réduit à un tri par compteurs. Un second langage ajouterait de la complexité de déploiement sans rien apporter.

### Authentification

Une poignée de comptes seulement. Authentification Supabase, sans fournisseur d'identité externe.

### Jeu de données de test (seed)

Objectif : disposer immédiatement d'un historique réaliste pour vérifier que l'équité tient sur la durée.

- **300 élèves** répartis sur toutes les tranches d'âge, avec des dates de naissance dispersées et quelques cas limites en bordure de tranche
- **15 éducateurs**, dont deux entrés en cours d'année et un désactivé, avec des taux d'indisponibilité variés d'une journée à l'autre
- **Année 2024-2025** : 8 journées pédagogiques complètes, planifiées, validées et pointées, avec des absences réalistes
- **Année 2025-2026** : 10 journées pédagogiques dans le même état
- **Année 2026-2027** : créée, configurée, sans journée — prête pour la rentrée de septembre 2026
- Présences saisies avec des absences et des remplacements réalistes, pour que le prévu et le réalisé diffèrent effectivement
- Au moins un changement de configuration en cours d'historique (modification d'horaire), afin de vérifier que les journées antérieures restent intactes

Le seed doit être **déterministe** (graine fixe) pour que deux exécutions produisent le même jeu de données et que les tests soient reproductibles.

---

## 13. Décisions arrêtées

Toutes les questions ouvertes ont été tranchées. Aucune ne reste bloquante pour le schéma de données ni pour le développement.

| # | Question initiale | Décision |
|---|---|---|
| 1 | Groupes par âge réel ou par niveau scolaire ? | **Les deux sont stockés.** Date de naissance obligatoire, niveau facultatif. Un réglage détermine lequel sert au découpage |
| 2 | Sur quelle date calcule-t-on l'âge ? | Réglage. Défaut : 30 septembre de l'année scolaire |
| 3 | Que faire si l'effectif d'ouverture dépasse le nombre de groupes ? | Réglage à trois options. Défaut : **réduire l'ouverture au nombre de groupes** |
| 4 | Un éducateur peut-il tenir deux quarts non contigus le même jour ? | Réglage à trois options. Défaut : uniquement en cas d'effectif insuffisant |
| 5 | Sur un bloc de plusieurs jours, même équipe ou non ? | Réglage. Défaut : chaque jour planifié séparément |
| 6 | Équité pondérée par le pourcentage de tâche ? | **Le temps partiel n'est pas modélisé.** Non disponible équivaut à absent. Ni champ ni réglage |
| 7 | Les compteurs comptent-ils le prévu ou le réalisé ? | **Le réalisé.** Les deux sont conservés séparément, les présences sont pré-remplies à « présent », et un rappel part tant qu'une journée n'est pas confirmée |
| 8 | Combien de types de quart le modèle supporte-t-il ? | **Cinq**, dont trois actifs en Version 1. Aucune modification de configuration ne peut altérer une journée passée (§4.6) |
| 9 | Quel mode de groupement au départ ? | L'âge, modifiable dans les réglages |

**Principe général retenu** : chaque fois qu'une règle relève d'un choix d'organisation plutôt que d'une contrainte légale, elle devient un réglage lu par l'algorithme. Seul le ratio maximal de 1 pour 20 reste une contrainte non contournable, parce qu'elle est réglementaire.

### Prochaine étape

Le schéma Prisma peut être écrit. Ordre suggéré : schéma et migrations, seed, écrans élèves et éducateurs, configuration, algorithme de génération, écrans de planning, présences, tableau de bord d'équité, exports.

---

## 14. Suite envisagée

Par ordre de valeur, une fois la Version 1 en usage réel :

1. **Remplacements assistés** — déclaration d'absence de dernière minute et régénération partielle du planning
2. **Fiches santé** — allergies et plans d'intervention visibles sur la feuille de groupe
3. **Inscriptions parents** — envoi des demandes, collecte des réponses, date limite et relances
4. **Évaluations** — élèves et éducateurs, avec formulaires configurables
5. **Activation de la soirée et de la fermeture** — simple configuration, aucun développement

Chaque étape n'est lancée qu'après que la précédente ait été utilisée sur au moins deux journées pédagogiques réelles.
