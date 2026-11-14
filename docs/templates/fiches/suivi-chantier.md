# T23 · Suivi de chantier par lot (contrat, avenants, non-conformités)

Slug `suivi-chantier`, préfixe `CHT` (clés locales `qme-cht-*`, règles `window.CHT`), prix prévu 40 €,
permalien Gumroad prévu `suivi-chantier-lot`, catégorie Gumroad prévue
`business-and-money/management-and-leadership` (à confirmer), taille L, priorité P2. Origine : documents de
travail de Quentin du 12/11/2026 (ligne T23 de `IDEES.md`). Fiche rédigée le 14/11/2026 sur délégation de
Quentin (décisions de cadrage déléguées, pas de validation à attendre). Catalogue : `data-pour="pro"`, thème
`projets-et-chantiers` (`--c:var(--bleu)`). Marques de risque : **confidentiel** (structure seulement,
exemples fictifs, aucune donnée de l'artefact d'origine), **RGPD** (intervenants, sous-traitants).

## Décision de périmètre (14/11/2026)

T23 est un **produit séparé** de T32 (Levée de réserves) et de T25 (Registre des non-conformités). Il couvre
le **pilotage contractuel et financier par lot** d'une opération, avec un registre de non-conformités
simplifié (constat, gravité, action, échéance, statut) ; il renvoie vers T25 (causes, actions correctives,
vérification d'efficacité) et T32 (réserves de réception, PV de levée) pour le détail. Vente croisée avec le
pack « Chef de projet BTP » à décider par Quentin.

## Pour qui

Maîtres d'œuvre d'exécution, architectes et petits bureaux d'études qui suivent des opérations découpées
en lots ; conducteurs de travaux et chargés d'affaires de PME du BTP ; maîtres d'ouvrage occasionnels et
AMO. Aujourd'hui : un tableur par sujet (situations, avenants), ordres de service dans la messagerie,
journal de chantier à part, revue de projet reconstruite à la main.

## Promesse

Chaque lot tenu, du marché au solde : avenants, situations de travaux, jalons recalés, non-conformités,
risques et ordres de service au même endroit, et la revue de projet qui se prépare toute seule.

## Écrans (5 onglets + revue + réglages)

1. **Tableau de bord** : tuiles (marché actualisé et écart, travaux facturés et écart au prévisionnel,
   jalons en retard et prochain jalon contractuel recalé, NC ouvertes et risques critiques) ; liste
   « À traiter » (alertes rouges puis jaunes, cliquables) ; courbe d'avancement financier ; avancement par
   lot ; trois dernières entrées du journal. Boutons « Fiche de l'opération » et « Revue de projet ».
2. **Lots** : un lot par ligne (code, entreprise, dates, marché actualisé, % facturé, étiquettes : montant à
   saisir, au-delà du marché, avenants en projet, situation à valider, paiement en retard, sous-traitant en
   attente, NC ouvertes, prolongation) ; tableau des avenants (filtre par lot) ; sous-traitance. Fiche lot :
   synthèse, avenants, sous-traitants, situations, échéancier (répartition linéaire ou mois par mois).
3. **Finances** : tuiles, courbe prévu / réalisé, barres par lot, synthèse financière (CSV), situations du
   plus récent au plus ancien (CSV). Saisie d'une situation avec aperçu du calcul à la frappe.
4. **Planning** : Jalons (date contractuelle, date recalée, état, retard, pénalités estimées), Journal
   (météo, effectif, faits, intempérie), Intempéries (jours constatés et retenus, prolongation par lot).
5. **Registres** : Non-conformités (filtres ouvertes, en retard, à vérifier, closes), Risques (matrice
   4 × 4, niveaux, exposition pondérée), Courriers et OS (numérotation, réponse attendue), Intervenants.
6. **Revue de projet** (depuis le tableau de bord) : six sections du modèle (délais, finances, qualité,
   risques, courriers et OS, points à arbitrer) avec la question à se poser, cadres « Décisions » et
   « Actions et porteurs » à remplir à la main ; « Imprimer » et « Copier le texte ».
7. **Réglages** : fiche de l'opération (identité, retenue de garantie, délai de paiement, alerte, relance
   sous-traitance, délais NC par gravité, pièces du marché), changer d'opération, exports CSV, sauvegarde
   JSON, compte, « Sur téléphone », repères, à propos.

Plusieurs opérations par clé (sélecteur dans la barre). Premier lancement en 2 étapes : nom, référence,
maître d'ouvrage, OS de démarrage et fin contractuelle (créent les jalons « OS de démarrage » et
« Réception ») ; lots cochés dans le découpage type, retenue et délai de paiement.

## Base intégrée (`templates/suivi-chantier/donnees.js`)

Découpage type en 20 lots (codes et intitulés usuels), 15 jalons types (portée opération ou lot, contractuel
ou interne), 12 pièces contractuelles types, 10 types de non-conformités avec exemple, 10 catégories de
risques avec exemple, échelle de probabilité et d'impact (1 à 4), météo, natures d'intempérie, 13 rôles
d'intervenants, modèle de revue de projet (6 sections et questions), 4 conseils, 7 repères. **Aucun indice,
taux ou délai réglementaire** : valeurs de départ modifiables (retenue 5 %, paiement 30 jours, alerte
7 jours, relance sous-traitance 15 jours, NC 30 / 15 / 7 jours).

## Calculs (règles pures, `templates/suivi-chantier/regles.js`, `window.CHT`)

- Montants en centimes HT entiers ; dates « AAAA-MM-JJ », mois « AAAA-MM ».
- **Marché actualisé** = montant initial + avenants **signés** ; avenants en projet isolés ; écart en %.
- **Situation** (saisie en cumul des travaux exécutés, hors révision) : travaux du mois = cumul − cumul
  précédent ; révision = travaux du mois × (K − 1), K saisi (aucun indice intégré) ; retenue = (travaux +
  révision) × taux ; net HT = montant − retenue − pénalités saisies ; paiement attendu = réception + délai ;
  retard de paiement (en cours ou constaté). Dépassement du marché actualisé signalé.
- **Synthèse par lot** et totaux : avancement, reste à facturer, révision, retenue, payé, à payer, à valider,
  sous-traité et part sous-traitée, pénalités encourues, prolongation.
- **Échéancier linéaire** au prorata des jours de chaque mois (somme exacte) ; **courbe** cumul prévu /
  réalisé par mois ; écart au prévisionnel au mois de la dernière situation.
- **Prolongation d'un lot** = délais des avenants signés + intempéries retenues du lot + intempéries
  retenues de toute l'opération tombées pendant la période du lot (demi-journées additionnées, total arrondi
  au jour supérieur). Pour un jalon, seuls les événements datés au plus tard à sa date comptent (avenant sans
  date : toujours). Jalon d'opération : la plus longue prolongation des lots.
- **Jalon** : date recalée, état (atteint, atteint en retard, en retard, proche selon l'alerte, à venir),
  retard en jours calendaires, pénalités = retard × pénalité par jour saisie (jalon contractuel) ; par lot,
  plafond en % du marché actualisé saisi.
- **NC** : retard après l'échéance, compteurs par gravité et par lot, échéance proposée selon la gravité.
- **Risques** : criticité = probabilité × impact ; niveaux faible (1-3), modéré (4-6), élevé (8-9),
  critique (12-16) ; matrice ; exposition = Σ montant × probabilité / 4 (pondération QME, indicative).
- **Courriers et OS** : numéro suivant par type, réponse attendue en retard ou proche.
- **Sous-traitants** : attente depuis la demande, relance après le délai réglé.
- **Alertes** consolidées (rouge puis jaune), **texte de revue** à copier, **CSV** (point-virgule, BOM).
- 13 tests `node --test` dans `outils/templates/suivi-chantier.test.mjs`.

## Sources et repères

- Aucune règle légale n'est appliquée par l'outil. Deux repères sont cités dans l'application, marqués
  **« à vérifier sur Légifrance »** (page non consultée le 14/11/2026) : loi n° 71-584 du 16 juillet 1971
  (plafond de 5 % de la retenue de garantie, remplacement par une caution) ; loi n° 75-1334 du 31 décembre
  1975 (acceptation des sous-traitants et agrément des conditions de paiement). Non cités dans la
  communication.
- Révision : « index BT ou TP » cités comme exemples d'indices, sans valeur intégrée.

## Risques

- **Juridique** : outil de suivi, pas un conseil ; pénalités affichées = estimation ; avertissement en pied
  de chaque vue et dans la fiche Gumroad.
- **RGPD** : intervenants limités à des coordonnées professionnelles, fonction plutôt que nom ; rappel dans
  l'application ; données hébergées dans l'UE avec le socle commun.
- **Confidentialité** : démo entièrement fictive (« Résidence Les Tilleuls · 32 logements », entreprises
  « … Exemple », adresses `example.com`).
- **Hors périmètre** : TVA, avances et leur remboursement, décompte général et définitif calculé, révision
  automatique, multi-utilisateurs avec droits (piste sur mesure).
- **Volume** : calculs refaits à chaque affichage ; rapide pour une dizaine d'opérations de quelques
  centaines de situations.

## Choix d'implémentation (14/11/2026)

- Socle copié de `templates/stocks/` (lui-même issu de `templates/revision/`) : connexion clé ou code avec
  `produit: 'CHT'`, démo `?demo` non mémorisée, synchronisation et conflit 409, modales (bouton principal
  en premier), toast « Annuler », export et import JSON, service worker, fenêtre « Comme une application »
  (clé `qme-cht-ecran-accueil`, entrée « Sur téléphone » des Réglages), bandeau « Bientôt en vente · Être
  prévenu de la sortie » vers `/catalogue/suivi-chantier/`.
- Démo : opération fictive de 8 lots, environ 8 mois de situations simulées (courbe en S, graine fixe,
  dates relatives) ; avenants signé, en projet et refusé ; lot CE à 104 % de son marché ; situation ME
  validée en retard de paiement ; lot PEI pas commencé ; jalons atteint, atteint en retard avec pénalités,
  en retard, proche, à venir ; intempéries retenues ou non ; NC en retard, critique, à vérifier, closes ;
  risque critique ; courrier en retard, mise en demeure et OS en attente ; sous-traitant à relancer ; une
  pièce du marché manquante.
- Graphique (skill dataviz) : deux séries ; le bleu de la charte échoue au plancher de chroma du validateur,
  compensé par l'encodage secondaire (prévu en tirets, réalisé en trait plein avec points), légende,
  étiquette directe de la dernière valeur, infobulle au survol, au toucher et au clavier, tableau accessible.
