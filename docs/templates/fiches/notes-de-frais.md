# T26 · Notes de frais et indemnités kilométriques

Slug `notes-de-frais`, préfixe `NDF` (clés locales `qme-ndf-*`), prix prévu 15 €, permalien Gumroad prévu
`notes-de-frais`, catégorie Gumroad `business-and-money/accounting`, taille S, priorité P2.
Origine : ligne T26 de `IDEES.md` (documents de travail de Quentin du 12/11/2026, backlog n° 19 fusionné :
saisie, justificatifs, statut de remboursement, barème kilométrique, récapitulatif et export mensuels).
Fiche rédigée le 13/11/2026. Marques de risque : **fiscal** (avertissement « outil d'aide, ne remplace pas
votre service comptable ni un professionnel ») ; barème kilométrique **daté** (sourcé, modifiable, mise à
jour annuelle). Pas de données de tiers (les invités d'un repas d'affaires ne sont qu'un texte libre saisi
par l'utilisateur).

## Pour qui

- **Salariés** qui avancent des frais (déplacements, repas, hôtels, péages) et utilisent leur véhicule
  personnel : ils doivent remettre chaque mois une note de frais avec justificatifs à leur employeur.
- **Indépendants et dirigeants** (gérant de SASU, de SARL, entrepreneur) qui se font rembourser par leur
  structure ou suivent leurs frais et leurs kilomètres pour leur comptable.

Distinct du **Budget du foyer** (T05) et de la **Micro-entreprise** (T44, chiffre d'affaires et
cotisations) : ici, uniquement les dépenses avancées à rembourser et les indemnités kilométriques.

## Promesse

Chaque euro avancé, retrouvé : le justificatif et où il est rangé, le statut de remboursement,
l'indemnité kilométrique au barème et la note du mois prête à imprimer.

## Écrans (4 onglets + réglages)

1. **Aperçu** : tuiles (à rembourser = soumis, à soumettre = brouillons, remboursé dans l'année,
   kilomètres de l'année et indemnité au barème) ; « À faire » (notes des mois passés encore en brouillon,
   justificatifs à fournir, remboursements en attente au-delà du délai réglable, barème de l'année pas
   encore publié) ; derniers frais ; graphique mois par mois (frais + kilomètres) ; frais par catégorie
   (barres + tableau) ; avertissement.
2. **Frais** : liste par mois (repliable), filtres Tous / Brouillons / Soumis / Remboursés / Sans
   justificatif, recherche ; chaque ligne : description, date, catégorie, statut, justificatif (fourni avec
   sa référence, ou à fournir), mission, TTC et TVA saisie, dates de soumission ou de remboursement.
3. **Kilomètres** : année choisie ; bandeau du barème utilisé (source, ou « barème de l'année précédente en
   attendant, à vérifier ») ; une carte par véhicule (distance cumulée et tranche, distance avant la tranche
   suivante, indemnité exacte au barème avec sa formule, montant compté au fil de l'eau et taux provisoire,
   régularisation, projection de l'année au rythme actuel, bouton « Ajouter la régularisation en frais ») ;
   explication du calcul ; trajets par mois (repliables).
4. **Notes du mois** : mois choisi ; tuiles (total, frais TTC et TVA saisie, kilomètres, remboursé) ;
   actions « Marquer soumise » et « Marquer remboursée » (avec date), « Imprimer ou PDF », « CSV du mois »,
   « Texte à copier » ; la note elle-même (en-tête demandeur, employeur ou structure, période, date
   d'édition, statut ; tableau des frais ; tableau des trajets ; total ; justificatifs à fournir ; cadres
   de signature) ; historique des notes avec statut et remboursé.
5. **Réglages** : prénom, nom sur les notes, profil (salarié / indépendant), employeur ou structure,
   délai de remboursement attendu (30 jours, 1 à 180) ; barèmes kilométriques (liste, modification
   complète, nouveau barème par copie du plus récent) ; impression de la note, export CSV complet ;
   sauvegarde JSON ; compte ; « Sur téléphone » ; à propos (sources, justificatifs).

Premier lancement en 2 étapes : prénom, nom sur les notes, profil, structure et 4 conseils ; puis le
véhicule personnel (type, puissance fiscale, électrique) ou « pas de véhicule ».

## Saisie

- **Frais** : date, catégorie, montant payé TTC, TVA facultative (recopiée du justificatif, jamais calculée,
  plafonnée au TTC), description, mission ou client (suggestions des missions déjà saisies), justificatif
  fourni / à fournir, référence ou lieu de rangement, statut (brouillon, soumis, remboursé) et dates.
  « Ajouter et un autre », « Dupliquer » (en brouillon), suppression avec « Annuler ».
- **Trajet** : date, véhicule, départ et arrivée en texte libre, distance aller (km, une décimale), aller-
  retour (distance doublée), motif, mission, statut et dates ; montant provisoire affiché pendant la saisie.
- **Véhicule** : nom, type (voiture, moto ou scooter de plus de 50 cm³, cyclomoteur), puissance fiscale
  (case P.6 de la carte grise), 100 % électrique, kilomètres professionnels estimés par an (facultatif),
  archivé.
- **Justificatifs** : aucun fichier ni photo n'est stocké (l'espace de données par compte est limité à
  environ 900 Ko, `TAILLE_MAX` de `netlify/lib/templates-acces.mjs`). Dit dans l'application (Frais, Aperçu
  vide, formulaire, Réglages) et dans la FAQ de la page catalogue.

## Calculs (règles pures, `templates/notes-de-frais/regles.js`, `window.NDF`)

- Montants en centimes entiers, saisie tolérante (« 18,50 », « 18.5 € », « 1 234,56 ») ; négatif accepté
  seulement pour la régularisation kilométrique. Distances en km à une décimale.
- **Hors taxe** = TTC − TVA saisie, affiché seulement si la TVA est saisie.
- **Barème** : un barème par année de trajets (`annee`), seuils et formules `d × a + b` par tranche, pour
  chaque ligne de puissance (voitures 5 lignes, motos 3, cyclomoteurs 1), majoration électrique en %.
  Barème des trajets d'une année = celui de l'année, sinon le plus récent des années précédentes
  (provisoire, signalé), sinon le plus ancien.
- **Indemnité annuelle exacte** d'un véhicule = formule de la tranche où tombe la **distance cumulée de
  l'année** (appliquée à toute la distance, pas par morceaux), × (1 + majoration) si électrique.
- **Au fil de l'eau** : chaque trajet × taux provisoire du véhicule = taux moyen du barème pour les
  kilomètres estimés (`f(est) / est`), sinon coefficient de la 1re tranche. **Régularisation** = exacte −
  compté − régularisations déjà saisies (écarts d'arrondi ≤ 1 centime par trajet ignorés). Projection de
  l'année en cours au prorata des jours écoulés.
- **Note mensuelle** : frais et trajets du mois, TTC, TVA saisie, indemnités, total, justificatifs
  manquants, totaux par statut ; statut de la note = brouillon, en partie soumise, soumise, remboursée.
  « Marquer soumise » passe les brouillons du mois en soumis (date), « Marquer remboursée » les soumis en
  remboursés (date).
- **Alertes** : mois passés avec brouillons, justificatifs à fournir (hors remboursés), soumis depuis plus
  que le délai, barème de l'année absent.
- Export CSV (point-virgule, BOM UTF-8, une ligne par frais et par trajet), texte à copier, normalisation
  tolérante des anciennes données (barème complété depuis le modèle).

## Base intégrée (`templates/notes-de-frais/donnees.js`)

- **18 catégories de frais** (repas, repas d'affaires, hébergement, train et car, avion, taxi et VTC,
  transports en commun, location de véhicule, carburant, péage, stationnement, fournitures, petit matériel,
  téléphone et internet, documentation, formation et salon, frais postaux, autres) + catégorie interne
  « Régularisation kilométrique », chacune avec le justificatif habituel ; couleurs fixes.
- 3 types de véhicule, 3 statuts, 4 conseils de méthode.
- **Barème kilométrique fiscal des revenus 2025** (trajets 2025), voitures, motos (plus de 50 cm³),
  cyclomoteurs, majoration de 20 % pour les véhicules électriques.

## Sources et risques

- **Barème** : actualité Service-public.fr A14686 « Impôts 2026 », DILA, publiée le 9 avril 2026
  (`https://www.service-public.gouv.fr/particuliers/actualites/A14686`), qui reprend les barèmes de la
  brochure pratique 2026 de la DGFiP : non revalorisés, identiques à 2023 et 2024 ; exemple officiel
  4 000 km à 5 CV = 2 544 € (vérifié par un test). Relevé le 13/11/2026. Coefficients vérifiés ; **à
  vérifier** : la majoration électrique pour les deux-roues (l'article la cite pour les véhicules, sans
  détail par type). Le barème des trajets 2026 sera publié au printemps 2027 : d'ici là l'application
  utilise celui de 2025 et l'indique (« à vérifier »). Mise à jour annuelle de `donnees.js`.
- L'employeur ou le comptable peut appliquer d'autres règles (barème interne, plafond de puissance, taux
  fixe, remboursement mensuel sans régularisation) : dit dans l'application et la FAQ ; tout est modifiable.
- Aucune automatisation : pas d'envoi de la note, pas d'OCR, pas de lien vers une application tierce.
  Impression navigateur (PDF), CSV, texte à copier, JSON.
- Fiscal : avertissement dans l'application (Aperçu, Kilomètres, Notes, Réglages), la page catalogue et la
  fiche Gumroad.
- Risque produit : logiciels de notes de frais d'entreprise (abonnement par utilisateur, avec OCR) ; se
  distinguer par le prix unique, la simplicité, le barème sourcé et expliqué, l'usage individuel.

## Choix d'implémentation (13/11/2026)

- Socle copié de `templates/abonnements/` (connexion, synchronisation, démo, modales, toast, fenêtre
  « Comme une application » reprise du bloc de `templates/gantt/app.js`, bandeau « Bientôt en vente »).
- Démo : salariée fictive, frais et trajets sur 10 mois relatifs à aujourd'hui ; mois de plus de 2 mois
  remboursés, mois −2 soumis sans réponse (retard), mois −1 en brouillon (à soumettre), mois en cours en
  saisie ; justificatifs manquants ; hôtel de 486 € (valeur extrême) ; voiture 5 CV sans estimation qui
  passe le seuil de 5 000 km (régularisation négative), scooter électrique avec estimation (régularisation
  nulle) ; année précédente vide.
- Graphiques (skill dataviz) : une seule série par graphique (bleu `--bleu`), pas de légende ; valeurs en
  encre ; infobulle au survol, au toucher et au clavier ; tableau accessible. Le validateur signale le bleu
  comme peu saturé pour une palette catégorielle : sans objet (une seule série, aucune couleur d'identité).
- Impression : `body.impression-note` + `@media print` ne gardent que la note du mois.
