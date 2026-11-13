# T04 · Nutrition et dépense énergétique · choix d'implémentation

Slug `nutrition`, préfixe `NTR`, prix 19 €, permalien Gumroad `nutrition`, taille L, priorité P1.
La fiche validée est dans `docs/templates/IDEES.md` (section « T04 · Nutrition et dépense
énergétique ») : elle n'est pas réécrite ici. Ce document note seulement les choix faits au
développement (13/11/2026), les sources vérifiées et les écarts à la fiche.

## Fichiers

`templates/nutrition/` : `index.html`, `app.css`, `donnees.js` (repas, nutriments, facteurs d'activité,
69 activités MET, sources), `aliments.js` (base Ciqual réduite, chargée à la demande), `regles.js`
(règles pures, `window.NTR`), `app.js`, `sw.js` (`nutrition-20261113`), manifeste, icônes.
Tests : `outils/templates/nutrition.test.mjs` (18 tests, dates fixes).

## Écrans (5 onglets + réglages)

1. **Journal** : navigation jour par jour (pas de jour futur) ; phrase « X kcal mangées sur Y
   dépensées » ; 4 tuiles (mangé, dépensé = repos + sport, facteur calorique et facteur visé, reste à
   manger ou dépassement de la cible) ; 6 nutriments avec barre si une cible est fixée ; 4 repas
   (petit-déjeuner, déjeuner, dîner, collations) ; ajouter, repas enregistré, enregistrer ce repas ;
   « Copier la veille » ; avertissement santé en pied de page.
2. **Activité** : détail du calcul de la dépense du jour (métabolisme, facteur, repos, séances, total,
   objectif et cible), poids (courbe 90 jours, dernières pesées), séances des 14 derniers jours.
3. **Bilan** : 7 ou 30 jours ; facteur de la période (total mangé ÷ total dépensé sur les jours notés),
   moyennes mangé et dépensé, variation de poids ; graphique mangé (barres) / dépensé (repère) par jour,
   jours non notés hachurés ; tableau nutriments moyenne / cible ; courbe de poids.
4. **Menus** : menus types (journées composées d'aliments de la base, totaux kcal, protéines, fibres),
   « Copier dans le journal », semaine (un menu par jour), **liste de courses** additionnée par aliment,
   rangée par groupe Ciqual, cases à cocher gardées, copie de la liste.
5. **Aliments** : recherche dans toute la base (valeurs pour 100 g), fiche d'un aliment (7 valeurs,
   favori, portions), favoris, aliments perso (valeurs pour 100 g saisies), repas enregistrés.

**Réglages** : profil, avertissement santé et citation HAS, texte « Tes données », export / import JSON,
**Effacer toutes mes données**, sources et licences, déconnexion.

## Base aliments : table Ciqual 2025 (Anses)

- Source vérifiée le 13/11/2026 : jeu de données « Table de composition nutritionnelle des aliments
  Ciqual 2025 », Anses, sur entrepot.recherche.data.gouv.fr (DOI 10.57745/RDMHWY), vers lequel renvoie
  la page data.gouv.fr de Ciqual 2020. Licence affichée par l'API du dépôt : **etalab 2.0** (Licence
  Ouverte / Open Licence 2.0) ; la page data.gouv.fr de la version 2020 indique aussi « Licence Ouverte ».
  Réutilisation commerciale autorisée avec mention de la source. ciqual.anses.fr renvoyait une erreur 503
  ce jour-là (non consulté).
- Fichier utilisé : `Table Ciqual 2025_FR_2025_11_03.xlsx` (version 1.0 du dépôt, publiée le 19/11/2025),
  lu avec `python3 -I` dans un dossier dédié du scratchpad.
- Colonnes gardées (pour 100 g) : énergie kcal (règlement UE 1169/2011), protéines (N × facteur de Jones),
  glucides, lipides, fibres, sucres, sel. « traces » et « < seuil » → 0 ; « - » → `null` (affiché « – »,
  compté 0, total signalé incomplet).
- Retirés : 141 aliments sans valeur énergétique, 39 aliments infantiles (produit réservé aux adultes).
  Reste **3 304 aliments**, 288 ko (88 ko compressé), chargés à la première recherche puis gardés en cache.
- Les aliments utilisés sont copiés dans les données de l'utilisateur (nom, groupe, 7 valeurs) : le
  journal reste lisible hors ligne et ne change pas si la base est mise à jour.
- Mention dans l'application : onglet Aliments (pied), Réglages → Sources, pied du journal et du bilan.

## Activités physiques : 2024 Adult Compendium of Physical Activities

- Site officiel pacompendium.com (consulté le 13/11/2026) : « The Adult, Older Adult, and Wheelchair
  Compendia are free to use for commercial purposes », « Please cite the Compendium website or
  publication(s) », « Please do not change MET values ». Référence vérifiée sur PubMed (PMID 38242596) :
  Herrmann SD et al., J Sport Health Sci 2024;13(1):6-12.
- 69 activités reprises avec leur code et leur MET **sans modification** (pages bicycling,
  conditioning-exercise, running, walking, sports, water-activities, dancing, home-activities), libellés
  traduits ; vitesses converties de mph en km/h.
- Calcul : `(MET − 1) × poids × durée (h)`, comme la fiche ; le niveau d'activité est présenté comme
  « hors séances de sport » à chaque endroit où on le choisit.

## Dépense énergétique

- Mifflin-St Jeor (vérifiée sur le résumé PubMed, PMID 2305711) : homme `10 P + 6,25 T − 5 A + 5`,
  femme `… − 161`.
- **Écart à la fiche, estimation dégradée** : la même publication donne une équation sur le poids seul
  (`REE = 15,1 × poids + 371`, R² 0,56). Elle est utilisée quand le sexe, l'âge ou la taille manquent,
  avec le bandeau « Estimation dégradée ». Aucun chiffre inventé pour compléter les champs manquants.
- Population de l'étude : 19 à 78 ans ; au-delà de 78 ans, une note signale une estimation moins fiable.
- Âge calculé depuis l'**année de naissance** seule (minimisation des données).
- Facteurs d'activité 1,2 / 1,375 / 1,55 / 1,725 / 1,9 : ceux de la fiche validée ; **aucune source
  officielle trouvée**, présentés comme « coefficients d'usage courant, sans valeur officielle » ;
  remplaçables par un facteur personnalisé (1 à 2,5) ou par une dépense de repos connue (mesurée).

## Objectif et santé

- Objectif perte / maintien / prise + écart en % (0 à 50, saisi par l'utilisateur, pas de valeur
  recommandée) ; facteur visé = 1 − écart (perte), 1 + écart (prise), 1 (maintien) ; cible = dépense ×
  facteur visé.
- **Plancher** : aucun chiffre de plancher bloquant. Alerte rouge si la cible du jour passe sous
  **1 000 kcal**, avec la citation de la HAS (recommandation « Surpoids et obésité de l'adulte : prise en
  charge médicale de premier recours », septembre 2011, PDF lu le 13/11/2026) : « Les régimes très basses
  calories (moins de 1 000 kcal par jour) ne sont pas indiqués sauf cas exceptionnels. Ils doivent être
  supervisés par un médecin spécialisé en nutrition. » Lien vers la page HAS.
- Avertissement général (connexion, consentement, pied du journal et du bilan, réglages) : outil d'aide,
  pas un dispositif médical, ne remplace pas un médecin ou un diététicien ; réservé aux adultes ;
  déconseillé sans avis médical en cas de grossesse, d'allaitement, de maladie chronique ou de trouble du
  comportement alimentaire.
- **Pas de mineurs** : case « J'ai 18 ans ou plus » obligatoire au consentement, année de naissance
  refusée si l'âge calculé est inférieur à 18 ans, aliments infantiles retirés de la base.

## Données de santé (RGPD)

- **Consentement explicite au premier lancement**, avant tout enregistrement : écran dédié, deux cases
  non cochées (accord pour l'enregistrement en ligne des données de santé ; 18 ans ou plus), texte en
  4 points : quelles données, où (hébergement du site qm-engineering.fr + copie dans le navigateur), à
  quoi elles servent, comment les effacer et qui contacter. Bouton « Refuser et me déconnecter ».
  L'accord (date, version du texte) est stocké avec les données ; sans lui, rien n'est envoyé.
- **Effacer toutes mes données** (Réglages) : remplace la version en ligne par un état vide sans
  consentement (PUT, 409 géré), vide le cache local, revient à l'écran de consentement. Refusé hors
  ligne (message clair). Les autres appareils voient l'effacement à la reconnexion ou au retour sur
  l'onglet. L'API commune n'a pas de route de suppression : un enregistrement vide (sans donnée de
  santé) subsiste sous la clé.
- Points à faire valider par Quentin (non tranchés ici) : politique de confidentialité du site (nommer
  l'hébergeur et sa localisation, durée de conservation) ; la CNIL indique qu'une application de
  bien-être n'est pas soumise à l'hébergement HDS hors activité de prévention, de diagnostic ou de suivi
  (page « Applications mobiles en santé… », ancienne : à revérifier).

## Portions types : écart à la fiche

Aucune table officielle de poids de portions réutilisable n'a été trouvée (Anses, INCA, data.gouv) : le
template **ne fournit aucun poids de portion**. L'utilisateur définit une portion par aliment (nom
proposé : « 1 œuf », « 1 tranche », « 1 yaourt », « 1 verre »…, poids lu sur l'emballage ou pesé une
fois), puis saisit des portions au lieu de grammes. La démo contient des portions fictives saisies par
« Camille ».

## Menus types : écart à la fiche

Aucun menu type n'est livré avec des quantités : l'utilisateur compose ses menus avec les aliments de la
base (totaux calculés). La démo en montre trois, fictifs.

## Démo

Profil fictif « Camille » (femme, 34 ans, 168 cm, légèrement active, perte 10 %, cibles protéines, fibres,
sel) ; 21 jours relatifs à aujourd'hui : deux jours non notés, deux jours au-dessus de la dépense, dîner
du jour pas encore saisi ; 7 pesées en baisse ; 10 séances ; aliment perso ; portions ; favoris ; 2 repas
enregistrés ; 3 menus, semaine avec un jour vide, 2 articles cochés.
