-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatutAnnee" AS ENUM ('PREPARATION', 'ACTIVE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "PorteeQuart" AS ENUM ('TOUS_GROUPES', 'PAR_GROUPE');

-- CreateEnum
CREATE TYPE "StatutJournee" AS ENUM ('BROUILLON', 'GENERE', 'VALIDE');

-- CreateEnum
CREATE TYPE "StatutConfirmation" AS ENUM ('A_CONFIRMER', 'CONFIRME');

-- CreateEnum
CREATE TYPE "StatutPresenceEleve" AS ENUM ('PRESENT', 'ABSENT', 'PARTI_TOT');

-- CreateEnum
CREATE TYPE "StatutPresenceEducateur" AS ENUM ('PRESENT', 'ABSENT', 'REMPLACE');

-- CreateEnum
CREATE TYPE "StatutEmploi" AS ENUM ('TEMPS_PLEIN', 'TEMPS_PARTIEL', 'OCCASIONNEL', 'REMPLACANT');

-- CreateEnum
CREATE TYPE "ModeGroupement" AS ENUM ('AGE_CALCULE', 'NIVEAU_SCOLAIRE');

-- CreateEnum
CREATE TYPE "PolitiqueDoublePoste" AS ENUM ('JAMAIS', 'SI_EFFECTIF_INSUFFISANT', 'TOUJOURS');

-- CreateEnum
CREATE TYPE "PolitiqueBloc" AS ENUM ('CHAQUE_JOUR_SEPAREMENT', 'MEME_EQUIPE_SUR_LE_BLOC');

-- CreateEnum
CREATE TYPE "PolitiqueSurEffectifOuverture" AS ENUM ('REDUIRE_AU_NOMBRE_DE_GROUPES', 'RENFORT_SUR_UN_GROUPE', 'AVANCE_PUIS_RETOUR');

-- CreateEnum
CREATE TYPE "CritereDepartage" AS ENUM ('HEURES_CUMULEES', 'NB_JOURNEES');

-- CreateTable
CREATE TABLE "annee_scolaire" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" DATE NOT NULL,
    "dateFin" DATE NOT NULL,
    "statut" "StatutAnnee" NOT NULL DEFAULT 'PREPARATION',
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieeLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annee_scolaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "type_quart" (
    "id" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "debutMinutes" INTEGER NOT NULL,
    "finMinutes" INTEGER NOT NULL,
    "portee" "PorteeQuart" NOT NULL,
    "effectifRequis" INTEGER NOT NULL DEFAULT 1,
    "enchaineSurId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "type_quart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tranche_age" (
    "id" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "niveauMin" INTEGER,
    "niveauMax" INTEGER,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "tranche_age_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglages" (
    "id" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "capaciteMaxGroupe" INTEGER NOT NULL DEFAULT 20,
    "ratioMaxEleves" INTEGER NOT NULL DEFAULT 20,
    "modeGroupement" "ModeGroupement" NOT NULL DEFAULT 'AGE_CALCULE',
    "dateReferenceAgeJour" INTEGER NOT NULL DEFAULT 30,
    "dateReferenceAgeMois" INTEGER NOT NULL DEFAULT 9,
    "delaiRappelHeures" INTEGER NOT NULL DEFAULT 16,
    "eviterMemeQuartConsecutif" BOOLEAN NOT NULL DEFAULT true,
    "continuiteTrancheAge" BOOLEAN NOT NULL DEFAULT false,
    "doublePoste" "PolitiqueDoublePoste" NOT NULL DEFAULT 'SI_EFFECTIF_INSUFFISANT',
    "politiqueBloc" "PolitiqueBloc" NOT NULL DEFAULT 'CHAQUE_JOUR_SEPAREMENT',
    "surEffectifOuverture" "PolitiqueSurEffectifOuverture" NOT NULL DEFAULT 'REDUIRE_AU_NOMBRE_DE_GROUPES',
    "critereDepartage" "CritereDepartage" NOT NULL DEFAULT 'HEURES_CUMULEES',
    "reportEcartAnneeSuivante" BOOLEAN NOT NULL DEFAULT true,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_configuration" (
    "id" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "commentaire" TEXT,
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eleve" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" DATE NOT NULL,
    "niveauScolaire" INTEGER,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateInscription" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuteur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "courriel" TEXT,
    "telephone" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuteur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eleve_tuteur" (
    "eleveId" TEXT NOT NULL,
    "tuteurId" TEXT NOT NULL,
    "lien" TEXT,

    CONSTRAINT "eleve_tuteur_pkey" PRIMARY KEY ("eleveId","tuteurId")
);

-- CreateTable
CREATE TABLE "educateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "courriel" TEXT,
    "statutEmploi" "StatutEmploi" NOT NULL DEFAULT 'TEMPS_PLEIN',
    "dateEmbauche" DATE,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "educateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journee_pedagogique" (
    "id" TEXT NOT NULL,
    "anneeScolaireId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "statut" "StatutJournee" NOT NULL DEFAULT 'BROUILLON',
    "versionConfigurationId" TEXT,
    "genereeLe" TIMESTAMP(3),
    "valideeLe" TIMESTAMP(3),
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieeLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journee_pedagogique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jour_planifie" (
    "id" TEXT NOT NULL,
    "journeePedagogiqueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statutConfirmation" "StatutConfirmation" NOT NULL DEFAULT 'A_CONFIRMER',
    "confirmeLe" TIMESTAMP(3),
    "confirmePar" TEXT,
    "rappelEnvoyeLe" TIMESTAMP(3),

    CONSTRAINT "jour_planifie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participation" (
    "eleveId" TEXT NOT NULL,
    "journeePedagogiqueId" TEXT NOT NULL,
    "inscritLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participation_pkey" PRIMARY KEY ("eleveId","journeePedagogiqueId")
);

-- CreateTable
CREATE TABLE "disponibilite" (
    "educateurId" TEXT NOT NULL,
    "jourPlanifieId" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "motif" TEXT,

    CONSTRAINT "disponibilite_pkey" PRIMARY KEY ("educateurId","jourPlanifieId")
);

-- CreateTable
CREATE TABLE "groupe" (
    "id" TEXT NOT NULL,
    "jourPlanifieId" TEXT NOT NULL,
    "trancheAgeId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "groupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groupe_eleve" (
    "groupeId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,

    CONSTRAINT "groupe_eleve_pkey" PRIMARY KEY ("groupeId","eleveId")
);

-- CreateTable
CREATE TABLE "affectation" (
    "id" TEXT NOT NULL,
    "jourPlanifieId" TEXT NOT NULL,
    "educateurId" TEXT NOT NULL,
    "typeQuartId" TEXT NOT NULL,
    "groupeId" TEXT,
    "quartCode" TEXT NOT NULL,
    "quartLibelle" TEXT NOT NULL,
    "quartDebutMinutes" INTEGER NOT NULL,
    "quartFinMinutes" INTEGER NOT NULL,
    "justification" TEXT,
    "issueEnchainement" BOOLEAN NOT NULL DEFAULT false,
    "ajusteeManuellement" BOOLEAN NOT NULL DEFAULT false,
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_educateur" (
    "id" TEXT NOT NULL,
    "affectationId" TEXT NOT NULL,
    "statut" "StatutPresenceEducateur" NOT NULL DEFAULT 'PRESENT',
    "remplacantId" TEXT,
    "note" TEXT,
    "saisieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_educateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_eleve" (
    "id" TEXT NOT NULL,
    "jourPlanifieId" TEXT NOT NULL,
    "eleveId" TEXT NOT NULL,
    "groupeId" TEXT NOT NULL,
    "statut" "StatutPresenceEleve" NOT NULL DEFAULT 'PRESENT',
    "heureArriveeMinutes" INTEGER,
    "heureDepartMinutes" INTEGER,
    "note" TEXT,
    "saisieLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_affectation" (
    "id" TEXT NOT NULL,
    "affectationId" TEXT NOT NULL,
    "note" INTEGER,
    "commentaire" TEXT,
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_modification" (
    "id" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "utilisateur" TEXT,
    "donneesAvant" JSONB,
    "donneesApres" JSONB,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_modification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "annee_scolaire_libelle_key" ON "annee_scolaire"("libelle");

-- CreateIndex
CREATE INDEX "type_quart_anneeScolaireId_actif_ordre_idx" ON "type_quart"("anneeScolaireId", "actif", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "type_quart_anneeScolaireId_code_key" ON "type_quart"("anneeScolaireId", "code");

-- CreateIndex
CREATE INDEX "tranche_age_anneeScolaireId_ordre_idx" ON "tranche_age"("anneeScolaireId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "tranche_age_anneeScolaireId_libelle_key" ON "tranche_age"("anneeScolaireId", "libelle");

-- CreateIndex
CREATE UNIQUE INDEX "reglages_anneeScolaireId_key" ON "reglages"("anneeScolaireId");

-- CreateIndex
CREATE UNIQUE INDEX "version_configuration_anneeScolaireId_numero_key" ON "version_configuration"("anneeScolaireId", "numero");

-- CreateIndex
CREATE INDEX "eleve_actif_idx" ON "eleve"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "eleve_nom_prenom_dateNaissance_key" ON "eleve"("nom", "prenom", "dateNaissance");

-- CreateIndex
CREATE UNIQUE INDEX "educateur_courriel_key" ON "educateur"("courriel");

-- CreateIndex
CREATE INDEX "educateur_actif_idx" ON "educateur"("actif");

-- CreateIndex
CREATE INDEX "journee_pedagogique_anneeScolaireId_statut_idx" ON "journee_pedagogique"("anneeScolaireId", "statut");

-- CreateIndex
CREATE INDEX "jour_planifie_date_idx" ON "jour_planifie"("date");

-- CreateIndex
CREATE INDEX "jour_planifie_statutConfirmation_idx" ON "jour_planifie"("statutConfirmation");

-- CreateIndex
CREATE UNIQUE INDEX "jour_planifie_journeePedagogiqueId_date_key" ON "jour_planifie"("journeePedagogiqueId", "date");

-- CreateIndex
CREATE INDEX "groupe_jourPlanifieId_ordre_idx" ON "groupe"("jourPlanifieId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "groupe_jourPlanifieId_libelle_key" ON "groupe"("jourPlanifieId", "libelle");

-- CreateIndex
CREATE INDEX "affectation_educateurId_idx" ON "affectation"("educateurId");

-- CreateIndex
CREATE INDEX "affectation_jourPlanifieId_idx" ON "affectation"("jourPlanifieId");

-- CreateIndex
CREATE UNIQUE INDEX "affectation_jourPlanifieId_educateurId_typeQuartId_key" ON "affectation"("jourPlanifieId", "educateurId", "typeQuartId");

-- CreateIndex
CREATE UNIQUE INDEX "presence_educateur_affectationId_key" ON "presence_educateur"("affectationId");

-- CreateIndex
CREATE INDEX "presence_educateur_statut_idx" ON "presence_educateur"("statut");

-- CreateIndex
CREATE INDEX "presence_eleve_groupeId_idx" ON "presence_eleve"("groupeId");

-- CreateIndex
CREATE UNIQUE INDEX "presence_eleve_jourPlanifieId_eleveId_key" ON "presence_eleve"("jourPlanifieId", "eleveId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_affectation_affectationId_key" ON "evaluation_affectation"("affectationId");

-- CreateIndex
CREATE INDEX "journal_modification_entite_entiteId_idx" ON "journal_modification"("entite", "entiteId");

-- CreateIndex
CREATE INDEX "journal_modification_creeLe_idx" ON "journal_modification"("creeLe");

-- AddForeignKey
ALTER TABLE "type_quart" ADD CONSTRAINT "type_quart_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "annee_scolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "type_quart" ADD CONSTRAINT "type_quart_enchaineSurId_fkey" FOREIGN KEY ("enchaineSurId") REFERENCES "type_quart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tranche_age" ADD CONSTRAINT "tranche_age_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "annee_scolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglages" ADD CONSTRAINT "reglages_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "annee_scolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_configuration" ADD CONSTRAINT "version_configuration_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "annee_scolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleve_tuteur" ADD CONSTRAINT "eleve_tuteur_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eleve_tuteur" ADD CONSTRAINT "eleve_tuteur_tuteurId_fkey" FOREIGN KEY ("tuteurId") REFERENCES "tuteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journee_pedagogique" ADD CONSTRAINT "journee_pedagogique_anneeScolaireId_fkey" FOREIGN KEY ("anneeScolaireId") REFERENCES "annee_scolaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journee_pedagogique" ADD CONSTRAINT "journee_pedagogique_versionConfigurationId_fkey" FOREIGN KEY ("versionConfigurationId") REFERENCES "version_configuration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jour_planifie" ADD CONSTRAINT "jour_planifie_journeePedagogiqueId_fkey" FOREIGN KEY ("journeePedagogiqueId") REFERENCES "journee_pedagogique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participation" ADD CONSTRAINT "participation_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participation" ADD CONSTRAINT "participation_journeePedagogiqueId_fkey" FOREIGN KEY ("journeePedagogiqueId") REFERENCES "journee_pedagogique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilite" ADD CONSTRAINT "disponibilite_educateurId_fkey" FOREIGN KEY ("educateurId") REFERENCES "educateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilite" ADD CONSTRAINT "disponibilite_jourPlanifieId_fkey" FOREIGN KEY ("jourPlanifieId") REFERENCES "jour_planifie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupe" ADD CONSTRAINT "groupe_jourPlanifieId_fkey" FOREIGN KEY ("jourPlanifieId") REFERENCES "jour_planifie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupe" ADD CONSTRAINT "groupe_trancheAgeId_fkey" FOREIGN KEY ("trancheAgeId") REFERENCES "tranche_age"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupe_eleve" ADD CONSTRAINT "groupe_eleve_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "groupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groupe_eleve" ADD CONSTRAINT "groupe_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_jourPlanifieId_fkey" FOREIGN KEY ("jourPlanifieId") REFERENCES "jour_planifie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_educateurId_fkey" FOREIGN KEY ("educateurId") REFERENCES "educateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_typeQuartId_fkey" FOREIGN KEY ("typeQuartId") REFERENCES "type_quart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "groupe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_educateur" ADD CONSTRAINT "presence_educateur_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "affectation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_educateur" ADD CONSTRAINT "presence_educateur_remplacantId_fkey" FOREIGN KEY ("remplacantId") REFERENCES "educateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_eleve" ADD CONSTRAINT "presence_eleve_jourPlanifieId_fkey" FOREIGN KEY ("jourPlanifieId") REFERENCES "jour_planifie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_eleve" ADD CONSTRAINT "presence_eleve_eleveId_fkey" FOREIGN KEY ("eleveId") REFERENCES "eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_eleve" ADD CONSTRAINT "presence_eleve_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "groupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_affectation" ADD CONSTRAINT "evaluation_affectation_affectationId_fkey" FOREIGN KEY ("affectationId") REFERENCES "affectation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

