# T63 · Vérifications réglementaires

Slug `verifications`, préfixe `VRF`, prix 35 €, permalien Gumroad prévu `verifications-reglementaires`.
Taille M, P2. Origine : backlog Quentin n° 41. Cadrage délégué par Quentin (14/11/2026) : fiche rédigée et
appliquée sans validation intermédiaire. Packs : « Moyens généraux » (PMG) et « Exploitation et
maintenance » (PXP). Marques de risque : **daté** (périodicités réglementaires), **confidentiel** (aucune
donnée réelle, démo fictive).

## Pour qui

- **Responsables QHSE et préventeurs de PME** (industrie, logistique, BTP) : plusieurs contrôles par site,
  rapports d'organismes, observations à lever, audits.
- **Gestionnaires de bâtiments, services généraux, office managers multi-sites** : extincteurs, électricité,
  portes, ascenseurs pour plusieurs adresses.
- **Dirigeants de PME et de petits ERP** (commerces, restaurants, hôtels, salles) : registre de sécurité,
  passage de la commission, vérifications annuelles.

Aujourd'hui : un tableur par site, des rapports dans plusieurs dossiers, des observations jamais relues ;
l'échéance dépassée se découvre à l'audit ou à la commission de sécurité.

## Règle de cadrage : aucune périodicité légale non sourcée

Chaque périodicité intégrée cite sa source officielle avec sa date de consultation, affichée dans
l'application (fiche de l'équipement, guide, registre imprimé). Source retenue : **brochure INRS ED 828
« Principales vérifications périodiques », édition de septembre 2026** (PDF officiel téléchargé sur
inrs.fr le 14/11/2026, 228 pages), qui récapitule pour chaque contrôle la périodicité, l'intervenant et les
textes de référence. Pour chaque type : page de la brochure, textes cités (Code du travail, CCH, arrêté du
25 juin 1980, arrêtés techniques). Les lignes issues d'une **règle APSAD ou d'une norme** (extincteurs
hors ERP, RIA) sont marquées « référentiel, pas un texte de loi ». **Tout contrôle absent de la base** se
crée en « Autre contrôle » : périodicité saisie par l'utilisateur, affichée « saisie par toi » partout.
Contrôles écartés faute de périodicité simple dans la brochure ou parce qu'ils dépendent trop du cas :
équipements sous pression, installations frigorifiques, gaz hors ERP, ICPE, rayonnements, bruit (à créer
en « Autre » si besoin).

## Écrans (5 onglets + guide et réglages)

- **Bord** : tuiles (en retard, à prévoir, observations à lever avec retards et dangers, taux à jour),
  délai moyen de levée sur 12 mois, alertes triées (échéances dépassées, observations en retard ou
  « danger », échéances proches, dates manquantes), état par site (barre empilée + légende, chiffres).
- **Équipements** : filtres (tous, à traiter, en retard, à prévoir, à compléter, à jour, hors service),
  site, recherche ; regroupés par site ; prochaine échéance, périodicité, étiquettes (délai de 2 ans,
  périodicité saisie, date fixée, observations). Fiche : échéance, dernière vérification, périodicité et
  sa source, observations à lever, historique des rapports (référence, lien). Gestion des sites.
- **Observations** : à lever, en retard, danger, levées, toutes ; gravité, échéance, responsable, rapport
  d'origine, jours ouverts ; « Lever » (date + preuve obligatoire : référence ou lien), rouvrir.
- **Calendrier** : retards à part, puis les 12 prochains mois (échéances répétées pour les contrôles
  fréquents), contrôles sans date.
- **Registre** : par site ou tous les sites, imprimable (A4 paysage, un site par page) : contrôles et
  échéances avec la source de la périodicité, historique des vérifications avec références des rapports,
  observations et levées avec preuves ; export CSV.
- **Guide et sources** : tableau des 22 types (périodicité, nature, textes, page), règles de calcul,
  limites.
- **Réglages** : structure, fenêtre d'alerte, délais de levée proposés par gravité, exports CSV (registre,
  observations), copie JSON, restauration, compte, « Sur téléphone ».

## Mécanique (fonctions pures, `regles.js`, `window.VRF`)

1. **Moteur d'échéances commun** (même logique que T11 entretien et T24 visa, destiné à T61) : prochaine =
   dernière date + périodicité en mois (fin de mois bornée : 31 janvier + 1 mois = 28 février) ou en jours.
2. **Dernière date** : vérification enregistrée la plus récente, sinon « dernière vérification connue »
   saisie à la création. **Date fixée** (rapport, mise en demeure) prioritaire jusqu'à la vérification
   suivante, qui l'efface.
3. **Périodicité** : saisie par l'utilisateur prioritaire ; sinon celle de la base ; type « Autre » sans
   saisie → échéance inconnue (« périodicité à saisir »).
4. **Délai de 2 ans des installations électriques** (arrêté du 26/12/2011, art. 3, note 105 de la brochure)
   : seulement si demandé dans la fiche ET dernier rapport sans observation, ou toutes ses observations
   levées au plus tard à l'échéance annuelle ; rapport défavorable → 12 mois.
5. **Statut** : en retard (échéance passée), à prévoir (dans la fenêtre d'alerte, 45 j par défaut, ramenée
   au tiers de la périodicité pour les contrôles fréquents), à jour, date à renseigner, hors service.
6. **Observations** : échéance proposée selon la gravité (danger 7 j, majeure 30 j, mineure 90 j :
   choix d'organisation, modifiables, pas des délais légaux) ; statut levée, en retard, à lever bientôt
   (15 j), à lever ; levée refusée sans date valide (pas dans le futur, pas avant le constat) ni preuve.
7. **Synthèse** : compteurs par statut, taux à jour (à jour + à prévoir / contrôles datés), délai moyen de
   levée sur 12 mois glissants.
8. **Liens** : `http(s)` seulement (pas de `javascript:` ni `data:`).
9. **CSV** : point-virgule, BOM UTF-8, formules neutralisées, source de chaque périodicité.

## Preuves : référence et lien, pas de fichiers

Le service des templates ne stocke que du JSON (limite ≈ 900 Ko par compte) ; ajouter des fichiers
demanderait un stockage et des quotas nouveaux. V1 : référence du rapport et de la preuve, plus un lien
(Drive, serveur, GED) ; le registre imprimé les reprend.

## Démo

Entreprise fictive « Services Exemple », 3 sites (bureaux avec ascenseur, plateforme logistique, espace
recevant du public), 22 équipements, deux ans d'historique simulé avec les vraies règles. États couverts :
2 retards (porte automatique, nacelle), échéances proches, date à renseigner (chariot neuf), délai de 2 ans
appliqué, périodicité saisie (rayonnages), équipement hors service, rapport défavorable avec observation
« danger », observation en retard, observations levées avec preuve. Organismes, adresses et références
fictifs (« Exemple », liens `example.com`).

## Risques et avertissements

- **daté** : base tirée de l'édition de septembre 2026 de la brochure ; à revérifier à chaque nouvelle
  édition (au moins une fois par an), date affichée partout.
- **Outil d'aide** : ne remplace ni un organisme agréé ou accrédité, ni la réglementation ; ne dit pas quels
  contrôles s'imposent (catégorie d'ERP, ICPE, équipements particuliers). Avertissement sur le tableau de
  bord, les équipements, le guide, le registre imprimé, la page du site et la fiche Gumroad.
- Pas de données personnelles hors « responsable » (fonction conseillée) et intervenant facultatif.
