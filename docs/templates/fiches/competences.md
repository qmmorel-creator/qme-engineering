# T49 · Matrice compétences et formations

Slug `competences`, préfixe `FRM` (clés locales `qme-frm-*`), prix prévu 25 €, permalien Gumroad prévu
`matrice-competences-formations`, catégorie Gumroad `business-and-money/management-and-leadership` (comme T46 et
T48), taille S, priorité P3. Origine : backlog de Quentin n° 25 (ligne T49 de `IDEES.md` : matrice personnes ×
compétences, niveaux, écarts, plan de formation ; base « à définir » ; backlog : tableur seul ; **RGPD**). Fiche
rédigée le 14/11/2026 (lot 9). Format : application web, comme toutes les idées « tableur seul » (décision de
`IDEES.md`, « Format des produits ») ; un modèle tableur reste à trancher par Quentin. Thème du catalogue :
« Organisation et réunions » (`pro`), avec l'onboarding et les congés.

Marques de risque : **données de tiers** (salariés : données minimales, rappel RGPD, effacement de la fiche) ;
**pas un outil de conformité** (formations obligatoires, autorisations, habilitations et entretiens professionnels
relèvent des textes) ; aucune donnée datée dans les calculs.

## Pour qui

Responsables formation et RH de PME, managers d'équipe, dirigeants de TPE qui préparent un plan de formation ou un
entretien annuel avec un tableur bricolé, ou sans rien. Trois questions concrètes : qui sait faire quoi ? qu'est-ce
qui manque par rapport au poste ? quelle compétence ne tient qu'à une seule personne ? Distinct de T46 (parcours
d'arrivée et de départ) et de T55 (compétences d'élèves).

## Promesse

Qui sait faire quoi, et qui former : la matrice des compétences de l'équipe face à ce que chaque poste demande, les
compétences critiques peu couvertes signalées, et le plan de formation avec son budget.

## Écrans (5 onglets + réglages)

1. **Tableau de bord** : 4 tuiles cliquables (part des niveaux requis atteints ; écarts à combler, dont sans
   formation prévue et non évalués ; compétences fragiles ; budget de l'année engagé sur budget) ; compétences
   fragiles (« personne », « 1 seule ») ; formations à venir et à confirmer ; écarts sans formation prévue (critiques
   d'abord, bouton « Planifier ») ; part des exigences atteintes par équipe (barres avec valeur écrite) ; personnes à
   réévaluer ; avertissement.
2. **Matrice** : tableau personnes × compétences groupées par domaine, en-têtes verticaux, première colonne et en-têtes
   figés, ligne de couverture en pied. Filtres : équipe, domaine, compétences « requises ou évaluées » ou « toutes »,
   affichage « Niveaux » (rampe bleue du clair au foncé, chiffre dans la case, liseré rouge sous le niveau requis,
   case pâle si l'évaluation est ancienne, pointillés pour « requis, non évalué ») ou « Écarts » (✓, −1, −2, ?).
   Légende ; une case = un bouton (libellé complet en `aria-label` et infobulle) qui ouvre l'évaluation. Impression
   (paysage conseillé) et CSV.
3. **Personnes** : cartes filtrées par équipe, recherche, part du poste couverte, étiquettes (écarts, non évaluées,
   formations prévues). **Fiche** : exigences du poste (jauge à points remplis jusqu'au niveau actuel et cerclés
   jusqu'au requis, chiffre « 2/3 », étiquette), autres compétences évaluées, formations, historique des évaluations
   (repliable, retrait possible) ; actions : évaluer (toutes les compétences en une fois), formation, modifier,
   imprimer (fiche avec visas), effacer.
4. **Plan de formation** : année (année en cours, suivante, autres, toutes) ; tuiles budget, prévu, engagé, réalisé ;
   barre du budget engagé ; filtres par statut ; formations datées avec personne, compétence, modalité, durée, coût,
   statut et action (« Valider », « Réalisée ») ; écarts sans formation prévue (10 puis repliés) ; CSV.
5. **Référentiel** : compétences par domaine (critique, nombre de postes, couverture), ajout et modification
   (domaine, description, critique), domaines ; **postes** (niveau requis par compétence en liste déroulante,
   ajout, retrait, nouveau poste vide ou en copie, dupliquer, renommer, supprimer) ; **échelle** (0 à 3, 4 ou 5
   niveaux, libellés et descriptions).
6. **Réglages** : entreprise, couverture minimale (2 par défaut), réévaluation après N mois (12), niveau de référence
   par défaut (3), exports CSV (matrice, plan, historique), sauvegarde JSON, compte, « Sur téléphone », données
   personnelles, à propos.

Premier lancement en 2 étapes : nom de l'entreprise et 4 conseils, puis domaines et postes à garder.

## Saisie

- **Personne** : prénom et initiale (un nom complet est raccourci : « Jeanne Martin » → « Jeanne M. »), poste,
  équipe (suggestions), date d'arrivée facultative, note sans donnée sensible.
- **Évaluation** : niveau (boutons colorés avec libellé), date, source (évaluation du manager, auto-évaluation,
  entretien professionnel, observation en situation ; « après formation » est automatique), note factuelle.
  Évaluation d'une case ou de toutes les compétences d'une personne (seules les lignes modifiées sont enregistrées).
- **Formation** : intitulé, personne, compétence visée, modalité (interne, organisme externe, à distance, tutorat),
  organisme ou formateur en texte libre, date (vide : à dater), durée en heures, coût, statut (envisagée, validée,
  réalisée, annulée), niveau visé, niveau atteint après. « Réalisée » demande la date, le coût réel et le niveau
  atteint, qui crée une évaluation « après formation ».

## Calculs (règles pures, `templates/competences/regles.js`, `window.FRM`)

- **Niveau actuel** = dernière évaluation (date, puis ordre de saisie le même jour).
- **Requis** = niveau demandé par le poste (0 = non requis). **Écart** = max(0, requis − actuel), un niveau jamais
  évalué comptant 0. **Cellule** : atteint, écart, non évalué, non requis ; « au-delà » si l'actuel dépasse le requis ;
  « ancienne » si la dernière évaluation a plus de N mois (`ajoutMois`, fin de mois bornée).
- **Conformité** = exigences atteintes ÷ exigences (personne, équipe, entreprise) ; points d'écart cumulés.
- **Niveau de référence** d'une compétence = le plus haut niveau requis par un poste, sinon le réglage.
  **Couverture** = personnes à ce niveau ou plus. **Fragile** = compétence critique dont la couverture est sous le
  seuil (option : toutes les compétences requises par un poste occupé).
- **Statut d'une formation** : réalisée, annulée, à dater, à confirmer (date passée, ni réalisée ni annulée), à venir.
  **Budget de l'année** : prévu (hors annulées), engagé (validées + réalisées), réalisé, restant = budget − engagé,
  heures réalisées, dépassement du prévu. Les formations sans date n'entrent dans aucun budget.
- **Écarts sans action** : exigences non atteintes sans formation envisagée ou validée sur la même compétence.
- **Réévaluations dues**, **indicateurs**, changement d'échelle (niveaux ramenés au nouveau maximum), suppression
  d'une compétence (retirée des postes, évaluations effacées, formations détachées) ou d'une personne (évaluations
  et formations effacées), normalisation tolérante, exports CSV (point-virgule, BOM UTF-8) de la matrice, du plan et
  de l'historique.

## Base intégrée (`templates/competences/donnees.js`)

Rédigée pour QME le 14/11/2026, **sans source externe** (aucun référentiel officiel, aucune nomenclature, aucun
organisme repris) : compétences transverses génériques, à adapter.

- **8 domaines, 44 compétences** (chacune avec une description), dont **8 critiques** par défaut : bureautique et
  numérique (6, dont cybersécurité), sécurité et prévention (6, dont risques du poste, premiers secours, évacuation
  et première intervention incendie, consignes de sécurité électrique), management (6), qualité et amélioration
  continue (5), communication et relation client (6), gestion de projet (5), organisation et transmission (4, dont
  transmission des savoir-faire), technique et production (6, dont diagnostic de panne et conduite d'équipements de
  manutention).
- **9 modèles de postes** avec niveau requis (8 à 12 compétences chacun) : assistant(e) administratif(ve),
  chargé(e) de clientèle, commercial(e), technicien(ne) de maintenance, agent(e) logistique, chef(fe) d'équipe,
  manager, chef(fe) de projet, responsable qualité.
- **Échelle 0 à 4** : non acquis, notions, opérationnel, maîtrise, expert (descriptions modifiables).
- **Rampes de couleurs** de la matrice pour 3, 4 et 5 niveaux non nuls, validées avec le script du skill `dataviz`
  (`--ordinal` : luminosité monotone, écarts visibles, extrémité claire ≥ 2:1 sur blanc) ; chiffre écrit dans chaque
  case (la couleur n'est jamais seule), texte blanc seulement sur les deux tons les plus foncés.
- 4 conseils de démarrage. Aucune personne, marque ni lien (test automatique).

Libellés volontairement neutres pour les sujets réglementés : « consignes de sécurité électrique » et « conduite
d'équipements de manutention » sont décrits « selon les autorisations de l'entreprise », sans nommer d'habilitation
ni de certificat.

## Sources et risques

- Rien ne se périme : aucun barème, taux ni obligation datée n'est fourni. Le budget est saisi par l'utilisateur.
- **RGPD** : niveaux de compétence = données personnelles de salariés. Minimisation par conception (prénom +
  initiale, poste, équipe ; aucun champ santé, salaire, vie privée ; note « factuelle, jamais une appréciation
  sur la personne ») ; rappel dans la saisie, la fiche, les réglages et la page catalogue ; « une évaluation n'est
  jamais une sanction » ; effacement de la fiche au départ ; l'acheteur reste responsable de traitement et informe
  les personnes. Renvoi général au référentiel CNIL « Gestion des ressources humaines », **à vérifier** (repère déjà
  cité par T46, non relu dans cette session).
- **Pas un conseil RH ni un outil de conformité** : avertissement dans l'application (tableau de bord, réglages),
  la page catalogue et la fiche Gumroad. Aucune mention d'un dispositif de financement, d'un organisme ou d'un texte.
- Aucune automatisation : pas d'intégration à un logiciel RH, pas d'e-mail, pas de lien externe. Partage par
  impression (matrice, fiche) et CSV.
- **Usage à plusieurs** : une clé = un espace ; pas de droits par manager (dit dans la FAQ).
- Risque produit : SIRH avec module compétences (abonnement), modèles de matrice gratuits en tableur. Se distinguer par
  le référentiel prêt, les écarts et la couverture calculés, le plan de formation relié aux niveaux, l'achat unique.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/onboarding/` (connexion `{ code, produit: 'FRM' }` dans les deux appels, démo `?demo`
  non mémorisée, synchronisation, 409, hors ligne, modales, toast « Annuler », fenêtre « Comme une application »,
  `qme-frm-ecran-accueil`, réglages « Sur téléphone »).
- Démo « Ateliers Brunet (fictif) » : 12 personnes, 6 équipes, deux campagnes (il y a 14 mois et 2 mois, une personne
  non réévaluée), une arrivée récente sans évaluation, compétences fragiles à 0 et à 1 personne, plan de formation
  couvrant tous les statuts (réalisées avec niveau après, validées à venir, à confirmer, envisagée datée et sans date,
  annulée, tutorat sans coût), budget de l'année et de la suivante. Niveaux tirés par un générateur à graine fixe,
  puis valeurs imposées.
- Bandeau de démo « Bientôt en vente · Être prévenu de la sortie » → `/catalogue/competences/`.
