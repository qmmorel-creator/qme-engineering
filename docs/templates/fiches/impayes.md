# T43 · Relance des impayés

Slug `impayes`, préfixe `RCV` (clés locales `qme-rcv-*`), prix prévu 19 €, permalien Gumroad prévu
`relance-impayes`, catégorie Gumroad `business-and-money/accounting`, taille S, priorité P2.
Origine : backlog de Quentin n° 18 (ligne T43 de `IDEES.md` : échéancier, retard en jours, pénalités
légales, modèles de mails par palier ; base : modèles de mails par palier de relance). Fiche rédigée le
13/11/2026. Marques de risque : **daté** (taux de référence, indemnité forfaitaire : paramètres datés,
sourcés, modifiables), **comptable** (estimation, pas un logiciel de comptabilité ni de recouvrement),
**RGPD** (données de débiteurs, parfois des particuliers). Avertissement « outil d'aide, pas un conseil
juridique » dans l'application, la page catalogue et la fiche Gumroad.

## Pour qui

TPE, artisans, freelances et petites structures qui facturent sans service comptable ni logiciel de
recouvrement : ils savent qu'une facture est en retard, mais pas de combien de jours, ce que la loi leur
permet de réclamer, ni quand relancer et avec quels mots. Distinct du **CRM freelance** (T28, suivi
commercial et factures en suivi simple), du **générateur de devis** (T36) et de la **trésorerie** :
ici, uniquement l'argent dû et sa relance.

## Promesse

Chaque facture en retard au même endroit : le retard en jours, les pénalités calculées, et le bon message
de relance prêt à copier au bon moment.

## Écrans (4 onglets + réglages)

1. **Tableau de bord** : tuiles (encours, échu dont litige, relances à faire, pénalités et indemnités
   estimées) ; relances à faire aujourd'hui ; échu par ancienneté (0-30, 31-60, 61-90, plus de 90 jours,
   barres + tableau) ; clients en retard (échu, retard maximal) ; avertissement.
2. **Factures** : filtres Ouvertes, En retard, À échoir, Litige, Payées, Abandonnées, Toutes ; recherche ;
   chaque ligne : client, numéro, émission, échéance, type de client, statut, retard en jours, prochaine
   relance, restant dû, pénalités. **Détail** : synthèse, pénalités période par période (base, taux,
   jours, montant), indemnité, total réclamable, paiements partiels datés (ajout, suppression, « payée
   aujourd'hui »), journal des relances, prochaine relance.
3. **Relances** : à faire, dans les 14 jours, journal des 15 dernières relances, paliers et modèles
   (modifier, ajouter, supprimer, revenir aux paliers d'origine), repères juridiques.
4. **Clients** : type (professionnel ou particulier), contact facultatif, encours et échu, retard
   maximal ; effacement des données personnelles ou suppression avec les factures ; encadré RGPD.
5. **Réglages** : entreprise, signature, délai de paiement habituel, écart minimal entre relances, délai
   laissé au client ; **taux datés** (taux BCE par semestre, majoration, taux contractuel professionnel avec
   plancher affiché, intérêt légal par semestre, taux contractuel particulier et son point de départ,
   indemnité, date de vérification, sources) ; export CSV ; sauvegarde JSON ; compte ; « Sur téléphone ».

**Préparer une relance** : choix du palier (le prochain dû par défaut), objet et message remplis et
modifiables, bouton **« Copier le message »** (presse-papiers, rien n'est envoyé), puis « Noter comme
envoyée » (date, canal, note) qui l'ajoute au journal.

Premier lancement en 2 étapes : entreprise, signature et 4 conseils, puis délai de paiement habituel et
délai de chacun des 4 paliers.

## Base intégrée (`templates/impayes/donnees.js`)

- **4 paliers par défaut** avec modèles rédigés pour QME (vouvoiement du client) : rappel courtois (J+3),
  relance ferme (J+15), mise en demeure (J+30, marque « mise en demeure », recommandé conseillé), dernier
  avis avant procédure (J+45). 18 champs remplis : client, numéro, dates, montant, déjà payé, restant,
  retard, taux, pénalités, indemnité, total dû, phrase sur les pénalités adaptée au type de client, délai
  et date limite de réponse, date du jour, entreprise, signature.
- **Taux datés** (relevés le 13/11/2026) : taux BCE de l'opération principale de refinancement au
  01/01/2025 (3,15 %), 01/07/2025 (2,15 %), 01/01/2026 (2,15 %), 01/07/2026 (2,40 %) ; intérêt légal
  « autres cas » (créancier professionnel) 2,62 % au 1er semestre 2026 et 2,75 % au 2nd ; majoration 10
  points ; indemnité 40 €.
- 6 canaux de relance (e-mail, courrier, recommandé avec AR, téléphone, message, en personne),
  4 conseils, 5 repères juridiques, sources.

## Calculs (règles pures, `templates/impayes/regles.js`, `window.RCV`)

- Montants en centimes entiers (TTC), taux en pour cent ; saisie tolérante.
- **Restant dû** = montant − paiements datés jusqu'au jour ; **date du solde** = date où le cumul des
  paiements atteint le montant.
- **Statut calculé**, par priorité : payée, abandonnée, litige, à échoir (jusqu'à l'échéance incluse), en
  relance (au moins une relance notée), échue.
- **Retard en jours** : échéance → aujourd'hui (facture ouverte) ou → date du solde (facture payée).
- **Taux applicable** (règle du semestre de l'art. L441-10 : taux BCE en vigueur au 1er janvier pour le
  premier semestre, au 1er juillet pour le second) : professionnel → taux contractuel saisi, sinon BCE du
  semestre + majoration ; particulier → taux contractuel saisi, sinon intérêt légal du semestre.
  « À vérifier » si le semestre n'a pas de taux saisi (le plus proche est repris). Plancher contractuel
  entre professionnels : 3 × taux légal (8,25 % au 2nd semestre 2026), signalé dans les Réglages.
- **Pénalités** : intérêts simples au prorata des jours (base 365) sur le restant dû, découpés à chaque
  paiement partiel et à chaque début de semestre ; professionnel : dès l'échéance ; particulier : à partir
  de la première relance notée « mise en demeure » (art. 1231-6 du Code civil), ou dès l'échéance si un
  taux contractuel le prévoit ; arrêt à la date du solde ; rien pour une facture abandonnée.
- **Indemnité forfaitaire** : 40 € par facture en retard (même payée ensuite), entre professionnels
  seulement.
- **Prochaine relance** : premier palier (délais croissants) au-delà du plus avancé déjà envoyé ; date =
  échéance + délai du palier, et au moins 7 jours (réglable) après la dernière relance ; aucune pour une
  facture payée, abandonnée ou en litige, ni après le dernier palier.
- **Synthèse** : encours, échu, à échoir, litige, tranches d'ancienneté, pénalités et indemnités, relances
  dues et à venir, encours par client.
- **RGPD** : effacement (nom remplacé par « Client effacé n », contact et notes vidés, montants et dates
  gardés) ; suppression du client et de ses factures.
- Export CSV (point-virgule, BOM UTF-8), normalisation tolérante des anciennes données.
- 16 tests `node --test` dans `outils/templates/impayes.test.mjs`.

## Sources (vérifiées le 13/11/2026)

- Code de commerce, art. L441-10 (version en vigueur depuis le 26/04/2019, ordonnance n° 2019-359) :
  taux BCE de l'opération de refinancement la plus récente + 10 points à défaut de clause, plancher de
  3 fois le taux légal, règle du semestre, exigibilité sans rappel, indemnité forfaitaire, exception des
  procédures collectives. https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414392
- Code de commerce, art. D441-5 (version en vigueur depuis le 27/02/2021, décret n° 2021-211) : 40 €.
  https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043197457
- Banque de France, « Taux directeurs de la BCE » : 2,15 % depuis le 11/06/2025, 2,40 % depuis le
  17/06/2026, 2,65 % depuis le 16/09/2026 (non utilisé avant le 01/01/2027, règle du semestre).
  https://www.banque-france.fr/fr/les-taux-monetaires-directeurs
- Taux de l'intérêt légal du 2nd semestre 2026 : 2,75 % (autres cas) et 6,84 % (créancier personne
  physique n'agissant pas pour des besoins professionnels), arrêté du 26/06/2026, JO du 30/06/2026, d'après
  legifiscal.fr (source secondaire ; **à vérifier** au JORF). 1er semestre 2026 : 2,62 % (arrêté du
  15/12/2025), source secondaire, **à vérifier**. Le choix du taux dépend de la qualité du créancier.
- Code civil, art. 1231-6 : intérêts au taux légal à compter de la mise en demeure, sans justifier d'une
  perte (section consolidée sur Légifrance, relevée le 13/11/2026) ; art. 1344 : la mise en demeure peut
  résulter de la seule exigibilité si le contrat le prévoit (option « dès l'échéance » des Réglages).
  Cour de cassation, ch. com., 24/04/2024, n° 22-24.275 : pénalités L441-10 et intérêts de l'art. 1231-6
  ne se cumulent pas (le calcul n'applique jamais les deux à une même facture).
  https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000006150254/
- Convention de calcul (base 365 jours, pénalités sur le TTC) : pratique courante, **à vérifier** selon
  les conditions générales de l'utilisateur.

## Risques

- **Daté** : nouveaux taux chaque 1er janvier et 1er juillet (prochain : 01/01/2027, BCE à 2,65 % au
  16/09/2026 sauf décision ultérieure) ; mise à jour semestrielle de `donnees.js` ; l'utilisateur peut
  saisir le taux lui-même.
- **Comptable / juridique** : estimations, pas un conseil juridique ; ne gère ni les procédures
  collectives, ni l'injonction de payer, ni la TVA sur encaissements ; aucun envoi.
- **RGPD** : données de tiers hébergées en ligne avec les données de l'acheteur ; minimisation (nom, type,
  un contact facultatif), effacement et suppression en un geste, rappel dans l'application. Durées de
  conservation comptables : renvoyées au comptable (à vérifier).
- Concurrence : logiciels de facturation et de recouvrement par abonnement ; se distinguer par l'achat
  unique, les pénalités calculées période par période et les paliers modifiables.

## Choix d'implémentation (13/11/2026)

- Socle copié de `templates/abonnements/` (connexion, synchronisation, démo, modales, toast, fenêtre
  « Comme une application », bandeau « Bientôt en vente »).
- Démo : entreprise fictive, 7 clients (dont un sans facture, deux particuliers), 12 factures à dates
  relatives : à échoir (2), échue sans relance, rappel dû, paiement partiel avec mise en demeure due,
  particulier mis en demeure, fin de parcours à plus de 90 jours, litige, abandonnée, payée en retard
  (pénalités et indemnité), payée à temps ; montants de 35 € à 18 450 €.
- Graphique (skill dataviz) : une seule série (bleu `--bleu`), sans légende ; valeurs en texte d'encre,
  barres de 20 px à bout arrondi de 4 px, infobulle au survol, au toucher et au clavier, tableau
  accessible sous les barres.
