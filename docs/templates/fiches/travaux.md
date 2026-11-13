# T67 · Pilote de travaux maison

Slug `travaux`, préfixe `TRV`, prix 25 €, permalien Gumroad `pilote-travaux`. Taille M, P1.
Origine : backlog de Quentin n° 49 « Pilote de travaux maison » (ligne T67 de `IDEES.md`). Réutilise la
mécanique de T02 (planning), T36 (devis) et T32 (réserves), mais pour un **particulier** : un seul
chantier (sa maison ou son appartement), des artisans à comparer et à coordonner, son propre argent.
**confidentiel** (remarque d'IDEES.md) : « Chemin critique » = mécanique seulement, aucune donnée d'un
outil personnel ou professionnel ; exemples fictifs.

Distinct de **Levée de réserves** (T32, `templates/reserves/`) : T32 sert un professionnel (conducteur
de travaux, maître d'œuvre) qui gère plusieurs opérations, des lots et des PV de levée. Ici, le
particulier suit quelques réserves de fin de travaux par poste, dans le même outil que ses devis, son
budget et son planning.

## Pour qui

- **Particuliers qui rénovent** une cuisine, une salle de bains ou tout un appartement ou une maison, en
  faisant appel à plusieurs artisans sans maître d'œuvre.
- **Couples et familles** qui doivent décider ensemble (même clé sur plusieurs appareils).
- **Primo-accédants** qui enchaînent achat et travaux et veulent tenir un budget serré.

Aujourd'hui : des devis en PDF dans les e-mails, un tableur de budget qui ne sait pas ce qui est signé ou
payé, des dates d'intervention notées au fil des appels, des défauts de fin de chantier oubliés.

## Écrans (5 onglets + réglages)

- **Devis** (accueil) : postes de travaux regroupés par pièce ; pour chaque poste, le **comparateur de
  devis** : artisan, montants HT et TTC, TVA déduite (taux implicite), ce qui est inclus et exclu, délai
  annoncé, assurance déclarée (oui / non / inconnue), note sur 5 ; moins cher signalé, écart en € et %,
  alertes (assurance non déclarée, TVA à vérifier, rien d'inclus noté). Bouton « Retenir ce devis ».
  Les postes sans devis apparaissent « à chiffrer ». Points à vérifier sur le devis selon le type de poste.
- **Budget** : tuiles prévu, engagé, payé, reste à payer ; provision pour imprévus (en % du prévu)
  et consommation de cette provision ; barre par poste (payé, engagé non payé, prévu restant) avec
  tableau accessible ; dépassements signalés ; saisie des paiements (acomptes, soldes) et des imprévus
  (supplément, découverte en cours de chantier).
- **Planning** : interventions par artisan (début, fin) sur une frise ; état (à venir, en cours,
  terminée) ; **chevauchements signalés** (même pièce, même artisan, ou simple parallélisme) et
  **ordre inhabituel** (par exemple peinture avant plâtrerie dans la même pièce). Application d'un
  modèle de planning.
- **Réserves** : défauts constatés en fin de travaux par poste (ouverte, levée), date de constat,
  référence photo en texte (V1 : pas de photo stockée), réception du poste et date de fin de la garantie
  de parfait achèvement (réception + 1 an, source ci-dessous).
- **Guide** : comment comparer des devis, ordre habituel des travaux, TVA (taux et conditions, source
  datée), aides publiques (renvoi vers les sites officiels, sans montant), garanties après réception,
  limites de l'outil, avertissement argent.
- **Réglages** (modale) : nom du chantier, provision pour imprévus (%), pièces, artisans, export et
  restauration JSON, déconnexion.

## Saisie

- **Premier lancement** : nom du chantier, date de début envisagée, budget global indicatif
  (facultatif), modèle (cuisine, salle de bains, rénovation complète d'un appartement, ou vide). Le
  modèle crée les pièces, les postes et un planning provisoire (sans artisan, durées à confirmer).
- **Poste** : intitulé, type (base), pièce (ou « tout le logement »), budget prévu TTC, notes.
- **Devis** : artisan (liste ou nouveau), référence, date, HT, TTC, inclus, exclus, délai annoncé
  (semaines ou jours, texte libre court + jours de travaux), assurance déclarée, note 1 à 5, commentaire.
- **Paiement** : poste, date, montant, libellé (acompte, situation, solde).
- **Imprévu** : poste (ou général), date, libellé, montant TTC.
- **Intervention** : poste, artisan, début, fin.
- **Réserve** : poste, description, constatée le, référence photo, statut (ouverte / levée le…).

## Mécanique clé (fonctions pures, `regles.js`)

1. **Taux de TVA implicite** = (TTC / HT − 1) × 100, arrondi à 0,1. S'il ne correspond à aucun des taux
   applicables aux travaux dans un logement (5,5 %, 10 %, 20 % en métropole, source ci-dessous), le devis
   porte « taux mixte ou à vérifier » (un devis peut légitimement mélanger plusieurs taux). L'outil ne
   choisit jamais le taux : il le **déduit** des montants saisis.
2. **Comparateur** : tri par TTC ; moins cher marqué ; écart au moins cher en € et en % ; alertes.
3. **Budget d'un poste** : prévu (saisi) ; engagé = TTC du devis retenu + imprévus du poste ; payé =
   somme des paiements ; reste à payer = engagé − payé ; écart = engagé − prévu.
4. **Budget global** : sommes des postes + imprévus généraux ; provision = prévu × % imprévus ;
   consommation de la provision = imprévus réels / provision ; « au-delà de l'enveloppe » si engagé >
   prévu + provision.
5. **Planning** : état d'une intervention à une date donnée ; chevauchements de toutes les paires
   (type `meme-piece`, `meme-artisan`, `parallele`), ordre inhabituel quand un poste de rang supérieur
   commence avant la fin d'un poste de rang inférieur dans la même pièce ; frise (début, fin, durée).
6. **Modèle de planning** : étapes enchaînées à partir de la date de début ; une étape `avec` la
   précédente démarre en même temps (plomberie et électricité).
7. **Réserves** : compteurs par poste ; fin de la garantie de parfait achèvement = réception + 1 an
   (29 février → 28 février).

Les tests (`outils/templates/travaux.test.mjs`) utilisent une date de référence fixe.

## Base intégrée (`donnees.js`)

- **Types de postes** (18) : code, intitulé, métier, rang dans l'ordre habituel des travaux, points à
  vérifier sur le devis (fourniture ou pose seule, dépose et évacuation, protections, raccordements,
  finitions…). Aucun prix moyen : aucune source officielle n'en publie qui vaille pour un chantier donné.
- **Modèles de planning** : cuisine, salle de bains, rénovation complète d'un appartement (pièces,
  postes, enchaînement, durée de départ en jours **à remplacer** par celle annoncée par l'artisan).
- **Taux de TVA travaux** (5,5 %, 10 %, 20 %) avec source et date de vérification ; **liens officiels**
  pour les aides, sans montant.

## Sources (vérifiées le 13/11/2026)

- Taux de TVA pour les travaux de rénovation d'un logement : Entreprendre Service Public, fiche F23568,
  « Vérifié le 21 février 2026 » — 10 % (amélioration, transformation, aménagement, entretien), 5,5 %
  (rénovation énergétique), logement achevé depuis plus de 2 ans, chaudière à énergie fossile au taux
  normal (20 % en métropole) depuis le 1er mars 2025 ; 2,1 % en Guadeloupe, Martinique et à La Réunion.
  https://entreprendre.service-public.gouv.fr/vosdroits/F23568
- Garanties après la réception des travaux : Service Public, fiche F2958, « Vérifié le 25 septembre
  2026 » — garantie de parfait achèvement d'un an après la réception, qui couvre les désordres du PV de
  réception et ceux apparus dans l'année. https://www.service-public.gouv.fr/particuliers/vosdroits/F2958
- Aides : MaPrimeRénov', Service Public, fiche F35083, « Vérifié le 1er septembre 2026 » ; portail
  officiel France Rénov' (france-renov.gouv.fr). **Aucun montant ni plafond repris** : ils dépendent des
  revenus et changent ; l'application renvoie vers ces pages avec la date de consultation.

## Risques

- **Argent** : avertissement dans l'application (outil de suivi, pas un conseil financier ni juridique ;
  les montants sont ceux que tu saisis ; le devis signé et les factures font foi).
- **Fiscal / daté** : taux de TVA affichés avec source et date ; rappel de vérifier auprès de l'artisan
  et sur le site officiel. À revérifier une fois par an (loi de finances).
- **Aides** : aucun montant ; renvoi vers les sites officiels.
- **Données personnelles** : noms d'artisans et contacts saisis par l'acheteur ; pas de données de
  santé ; export et suppression possibles.
- **Photos** : pas stockées en V1 (limite de taille du stockage) ; référence texte.

## Choix d'implémentation

- Un seul chantier par clé (le besoin d'un particulier) ; pièces et artisans gérés dans les réglages.
- Devis retenu = un par poste (`poste.retenuId`) ; retenir un autre devis remplace le précédent.
- Frise du planning en CSS (positions en %), lisible au téléphone ; liste des alertes sous la frise.
- Graphique budget : barres horizontales empilées, couleurs de la charte, tableau de valeurs dessous.
