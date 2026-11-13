# T14 · Suivi des abonnements

Slug `abonnements`, préfixe `ABN` (clés locales `qme-abn-*`), prix prévu 8 €, permalien Gumroad prévu
`suivi-abonnements`, catégorie Gumroad `business-and-money/personal-finance`, taille S, priorité P2.
Origine : liste initiale du 12/11/2026 (ligne T14 de `IDEES.md` : coût mensuel et annuel, renouvellements ;
base : abonnements courants sans prix figés). Fiche rédigée le 13/11/2026. Marques de risque : **argent**
(avertissement « outil d'aide, ne remplace pas un avis professionnel ») ; repères juridiques **datés**
(sourcés, « à vérifier », mise à jour annuelle). Pas de données de tiers.

## Pour qui

Particuliers et foyers qui accumulent des abonnements (vidéo, musique, presse, téléphone, box, assurances,
sport, logiciels, stockage, livraison, jeux…) et ne savent plus ce qu'ils paient au total, ni quand un
essai gratuit devient payant ou quand ils peuvent sortir d'un engagement. Distinct du **Budget du foyer**
(T05, `templates/budget/`, toutes les dépenses du mois) et du **Budget commun** (T65, qui doit quoi à qui) :
ici, uniquement les dépenses récurrentes, avec leurs dates qui engagent.

## Promesse

Ce que tu paies vraiment, chaque mois et chaque année, et la date avant laquelle décider pour chaque essai,
engagement ou renouvellement.

## Écrans (4 onglets + réglages)

1. **Aperçu** : tuiles (par mois, par an, prélevé ce mois-ci dont à venir, économies obtenues et à
   résilier) ; « À décider » (fin d'essai, fin d'engagement avec préavis, renouvellement annuel ou
   semestriel ; préavis dépassé en rouge, proche en jaune ; les échéances plus lointaines repliées) ;
   30 prochains prélèvements ; coût mensuel par catégorie (barres) ; montant prélevé sur les 12 prochains
   mois (colonnes, pics des annuels) ; avertissement.
2. **Abonnements** : liste groupée par catégorie (total mensuel et annuel du groupe), filtres En cours /
   À résilier / Résiliés / Tous, recherche ; chaque ligne : montant et périodicité, ma part, moyen de
   paiement, étiquettes (prix à compléter, essai, engagé jusqu'au, partagé, à résilier, résilié), coût
   mensuel et annuel, prochain prélèvement. Bouton « Compléter » qui enchaîne les abonnements sans prix.
3. **Calendrier** : grille du mois (lundi → dimanche), prélèvements à leur jour avec montant, total du mois
   et part à venir, navigation entre mois ; liste jour par jour. Sur téléphone : total par jour dans la
   grille, détail dans la liste.
4. **Économies** : à résilier (économie annuelle, « C'est résilié » avec date d'effet, « Garder »),
   résiliés (« Réactiver »), total mensuel après résiliation, pistes (doublons dans une catégorie où l'on
   en garde souvent un seul, essais en cours), repères pour résilier (sources, « à vérifier »).
5. **Réglages** : prénom, délai d'alerte (30 jours par défaut, 1 à 120), récapitulatif texte à copier,
   impression de la liste, export CSV, sauvegarde JSON (export / import), compte, « Sur téléphone ».

Premier lancement en 2 étapes : prénom et méthode (4 conseils), puis cases à cocher dans la base intégrée ;
chaque abonnement coché arrive « prix à compléter ».

## Saisie

Formulaire unique : choix facultatif dans la base (remplit nom, catégorie, périodicité et préavis courant,
affiche l'engagement courant comme repère), nom, catégorie, périodicité, montant (vide = à compléter),
**date d'un prélèvement** (le prochain ou un passé), moyen de paiement (libre, suggestions), partage
(nombre de parts, ma part facultative), fin d'essai, fin d'engagement, préavis en jours, statut
(actif, à résilier, résilié + date d'effet), note.

## Calculs (règles pures, `templates/abonnements/regles.js`, `window.ABN`)

- Montants en centimes entiers ; saisie tolérante (« 12,99 », « 12.99 € », « 1 234,5 »).
- **Ma part** = part saisie (plafonnée au montant), sinon montant ÷ nombre de parts (arrondi au centime).
- **Coût annuel** = ma part × prélèvements par an (hebdo 52, mensuel 12, bimestriel 6, trimestriel 4,
  semestriel 2, annuel 1) ; **coût mensuel** = annuel ÷ 12.
- **Prélèvements** : à partir de la date saisie, pas de 7 jours ou de n mois avec jour d'ancrage (31/01 →
  28/02 → 31/03) ; aucun avant la date saisie ; un abonnement résilié n'a plus de prélèvement à partir de
  sa date d'effet.
- **Décisions** : essai → date limite = fin d'essai ; engagement en cours → fin d'engagement − préavis ;
  annuel ou semestriel sans engagement en cours → prochain prélèvement − préavis. Niveau « dépassé » si la
  date limite est passée (échéance encore à venir), « proche » dans le délai d'alerte, sinon « plus tard ».
- **Totaux** : actifs et « à résilier » (on paie encore), par catégorie ; les abonnements sans prix sont
  comptés « à compléter », hors totaux. **Économies** : coût annuel des « à résilier » (potentielle) et
  des « résiliés » (obtenue).
- **Calendrier** et **projection 12 mois** : somme des parts prélevées par jour et par mois.
- Export CSV (point-virgule, BOM UTF-8), récapitulatif texte, normalisation tolérante des anciennes données.

## Base intégrée (`templates/abonnements/donnees.js`)

- **17 catégories, 96 abonnements types** : vidéo et TV, musique et audio, presse et lecture, téléphone
  mobile, internet et box, assurances, sport et bien-être, logiciels et applications, stockage en ligne,
  livraison et achats, jeux vidéo, transports, banque, maison et services, famille et apprentissage, dons
  et adhésions, autres. **Aucun nom de marque, aucun prix** (test automatique sur une liste de marques).
- Pour chaque type : périodicité courante, engagement courant (repère affiché, pas imposé), préavis courant
  (modifiable), essai fréquent ou non. Valeurs indicatives rédigées pour QME : le contrat fait foi.
- 6 périodicités, 6 moyens de paiement suggérés, 4 conseils de méthode.
- **Repères pour résilier** (droit français de la consommation) : reconduction tacite et information du
  consommateur (art. L215-1 du Code de la consommation) ; assurances auto, habitation, affinitaires
  résiliables à tout moment après un an (loi Hamon), complémentaire santé aussi depuis le 01/12/2020 ;
  résiliation en ligne obligatoire depuis le 01/06/2023 pour les contrats souscrits en ligne ; box et
  mobile : engagement de 24 mois au plus, frais limités au quart des sommes restantes à partir du 13e mois
  (art. L224-28) ; essais gratuits. **Source** : Code de la consommation et fiches de service-public.fr,
  relevés le 13/11/2026, **à vérifier** (affiché dans l'application ; mise à jour annuelle du fichier).

## Sources et risques

- Aucun prix ni barème intégré : rien ne se périme, sauf les repères juridiques (datés, à revérifier chaque
  année ; le texte des repères est volontairement général).
- Aucune automatisation : pas de connexion bancaire, pas de lien de résiliation, pas de notification ni
  d'export agenda. Partage par texte à copier, impression, CSV, JSON.
- Argent : avertissement dans l'application (Aperçu, Économies), la page catalogue (FAQ) et la fiche Gumroad.
- Risque produit : applications gratuites de suivi d'abonnements (souvent avec connexion bancaire) ; se
  distinguer par l'absence de connexion bancaire, les dates qui engagent (préavis) et l'achat unique.

## Choix d'implémentation (13/11/2026)

- Socle copié du planner horaire (connexion, synchronisation, démo, modales, toast, fenêtre « Comme une
  application » reprise du bloc de `templates/gantt/app.js`).
- Démo : foyer fictif, 21 abonnements à des dates relatives à aujourd'hui : essai qui finit dans 4 jours,
  engagement à décider (préavis de 10 jours), préavis dépassé, renouvellement annuel proche, partagé à
  parts égales, part saisie (moitié remboursée par l'employeur), 2 « à résilier », 2 résiliés, 1 prix à
  compléter, hebdomadaire, trimestriel, annuels.
- Graphiques (skill dataviz) : une seule série par graphique (bleu `--bleu`), donc pas de palette
  catégorielle ni de légende ; valeurs en texte d'encre (jamais dans la couleur de la donnée), barres
  ≤ 24 px à bout arrondi de 4 px, infobulle au survol, au toucher et au clavier, tableau accessible
  (visible sous les barres, masqué pour lecteurs d'écran sous les colonnes). Le validateur signale un bleu
  peu saturé et un jaune trop clair en tant que palette catégorielle : sans objet ici (pas de couleur
  d'identité), le jaune n'est pas utilisé dans les graphiques.
