# T80 · Document unique d'évaluation des risques (DUERP)

Slug `document-unique`, préfixe `DRP` (clés locales `qme-drp-*`, règles `window.DRP`), prix 29 €, permalien
Gumroad prévu `document-unique-evaluation-risques`, catégorie Gumroad prévue `business-and-money` (à
confirmer), taille M, priorité P2, usage `pro`. Origine : proposition validée par Quentin le 14/11/2026
(pack « Petite entreprise », PPE). Fiche rédigée le 14/11/2026 par délégation de Quentin (décisions de
cadrage déléguées, pas de validation à attendre). Catalogue : `data-pour="pro"`, thème
`organisation-et-reunions` (`--c:var(--rouge)`), avec l'onboarding et les congés (RH de la petite équipe).
Marques de risque : **daté / réglementaire** (obligations sourcées et datées, à revérifier chaque année) ;
**confidentiel** (démo 100 % fictive : « Menuiserie Exemple », adresse « rue de l'Exemple »). Avertissement
partout : outil d'aide, ne remplace ni un préventeur ni un conseil juridique.

## Pour qui

Employeurs de TPE et de PME, dès le premier salarié, qui n'ont pas de document unique, ou un document écrit
une fois et jamais mis à jour : artisans, commerçants, restaurateurs, entreprises du bâtiment, ateliers,
services, associations employeuses. Aussi : office managers et responsables RH de PME (11 à 100 salariés)
qui doivent tenir la mise à jour annuelle, et, dès 50 salariés, présenter un programme annuel de prévention
au CSE.

## Promesse

« Tes risques évalués, ton document à jour. » Le document unique construit unité par unité, coté, suivi par
un plan d'actions, archivé à chaque mise à jour, et imprimable à tout moment.

## Obligations (sources datées, intégrées dans `donnees.js`)

Légifrance n'est pas consultable par nos outils (403) : les obligations sont résumées d'après deux pages
officielles, avec les articles du Code du travail **qu'elles citent** ; l'application invite à lire le
texte en vigueur sur Légifrance.

- **service-public.gouv.fr (Entreprendre)**, fiche F35360 « Qu'est-ce que le document unique d'évaluation
  des risques professionnels (DUERP) ? », vérifiée le 22/07/2026 par la DILA, consultée le 14/11/2026.
- **INRS**, « Document unique d'évaluation des risques. Ce qu'il faut retenir », mise à jour le 18/10/2024,
  consultée le 14/11/2026.
- **INRS**, brochure ED 840 « Évaluation des risques professionnels. Aide au repérage des risques dans les
  PME-PMI » (édition d'octobre 2023 d'après le PDF ; le catalogue en ligne affiche 06/2025), consultée le
  14/11/2026 : source des **20 familles de risques**, dont les titres, situations et mesures sont
  **reformulés** pour QME (la brochure interdit la reproduction ; rien n'est recopié).

Résumé intégré (10 entrées, filtrées par l'effectif saisi) : obligation dès le premier salarié (R4121-1 à
R4121-4) ; contenu (inventaire par unité, méthode, actions, annexe d'exposition aux facteurs de risques,
L4161-1) ; mise à jour à chaque aménagement important ou information nouvelle (R4121-2) ; **au moins une fois
par an dès 11 salariés** (R4121-2) ; transmission au SPST et consultation du CSE dès 11 ; **liste des actions
sous 50 salariés** ; **programme annuel de prévention dès 50** (L2312-27) ; **conservation des versions
40 ans** ; mise à disposition et affichage des modalités d'accès (R4121-4) ; sanctions (R4741-1 :
1 500 € / 3 000 € en récidive pour une personne physique, 7 500 € / 15 000 € pour une personne morale).
Seuils 11 et 50 dans `BASE.seuils` ; tout le reste est saisi par l'utilisateur.

## Écrans

- **Premier lancement** : entreprise, effectif, activité parmi 9 secteurs (bureaux, commerce, restauration,
  bâtiment, atelier, logistique, aide à domicile, coiffure, autre) ; étape 2, unités de travail proposées à
  cocher, chacune avec ses risques à examiner (non cotés).
- **Bord** : tuiles (priorité 1, actions en retard, prochaine mise à jour obligatoire ou conseillée, taux
  d'actions réalisées), alertes triées (mise à jour annuelle dépassée ou proche, événement en attente,
  action en retard ou proche, priorité 1 sans action, risques à coter, unité sans risque, programme
  incomplet dès 50, modifications non archivées), matrice gravité × probabilité (cotation résiduelle,
  priorité écrite dans chaque case), répartition par unité, obligations clés selon l'effectif.
- **Évaluation** : risques par unité, filtres (priorité 1/2/3, à coter, P1 sans action), recherche ; fiche
  d'un risque (famille, situation dangereuse avec suggestions, conséquences, personnes exposées, cotation
  initiale, mesures en place, cotation résiduelle, date) ; repères de la famille (exemples de mesures).
- **Actions** (« Programme annuel de prévention » dès 50 salariés) : type de mesure (supprimer, remplacer,
  protection collective, organisation, protection individuelle, formation), responsable, échéance, coût,
  indicateur de résultat, statut ; coût prévu et réalisé ; bandeau de l'année ; « Faite » propose de recoter
  le risque résiduel et d'ajouter l'action aux mesures en place.
- **Document** : version de travail ou version archivée (lecture seule) ; page de garde, sommaire,
  1 cadre, 2 méthode et grille, 3 inventaire par unité, 4 plan d'actions / programme annuel, 5 historique,
  6 accès et conservation, 7 annexe d'exposition ; impression A4 paysage ou PDF ; exports CSV.
- **Versions** : version en vigueur, prochaine mise à jour, modifications non archivées, archivage (date,
  motif, résumé proposé d'après les différences, participants), versions avec date limite de conservation,
  journal des événements (accident, aménagement, information nouvelle, demande CSE/SPST/inspection).
- **Obligations et sources** (icône) ; **Réglages** : entreprise (dont modalités d'accès et annexe), grille
  de cotation (3 à 5 niveaux par axe, libellés, seuils P1/P2, aperçu), unités, alerte (jours), revue
  conseillée sous 11 salariés (mois, choix de l'entreprise), exports, sauvegarde, « Sur téléphone ».

## Calculs (`regles.js`, testés dans `outils/templates/document-unique.test.mjs`, 15 tests)

Score G × P, priorité selon les seuils, résiduel par défaut égal à l'initial ; changement de grille avec
cotations ramenées au maximum ; obligations selon l'effectif ; statut des actions (retard, proche) ;
prochaine mise à jour (12 mois dès 11 salariés, sinon revue réglable) ; différences entre instantanés et
résumé ; archivage (date non future, pas avant la précédente, numérotation) ; événements en attente ;
alertes ; synthèse, matrice, répartition par unité ; plan d'actions trié et programme d'une année ;
démarrage par secteur ; suppressions en cascade ; exports CSV. Montants en centimes.

## Décisions de cadrage

- **Grille par défaut 4 × 4**, seuils P1 ≥ 9, P2 ≥ 4 : proposition QME, pas une norme (l'INRS laisse le mode
  d'appréciation à l'entreprise). Paramétrable.
- **Risque résiduel = cotation avec les mesures en place** ; la priorité se calcule dessus.
- **Versions** : instantané complet dans l'état synchronisé (pas de fichier). Seule la dernière version peut
  être supprimée (erreur de saisie), avec avertissement 40 ans. L'outil n'est pas un archivage légal :
  impression ou PDF conseillés à chaque version.
- **Pas d'annexe calculée** des facteurs de risques professionnels (texte libre).
- **Démo** : menuiserie fictive de 14 salariés, V1 il y a deux ans, V2 il y a un peu moins d'un an (mise à
  jour annuelle dans 10 jours), événement après V2, modifications non archivées, actions de tous états,
  risque P1 sans action, risque à coter, unité sans risque, risques réduits.

## Risques

- Réglementaire : textes susceptibles de changer (projet de décret évoqué sur la mise à jour sous 11
  salariés, non confirmé) : dates de consultation affichées, revérification annuelle.
- Ne pas laisser croire à une conformité garantie : avertissement dans l'application, sur le site et sur
  Gumroad.
- Données : pas de nom de personne demandé (fonctions), événements « sans nom de personne ».

## Statut

**Prêt** le 14/11/2026, « Mise en vente prochaine ». Communication dans `communication/document-unique/`.
