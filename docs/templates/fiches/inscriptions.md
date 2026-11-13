# T53 · Inscriptions associatives

Slug `inscriptions`, préfixe `ASC`, prix 29 €, permalien Gumroad `inscriptions-associatives`. Taille M, P1.
Origine : backlog de Quentin n° 30 (ligne T53 de `IDEES.md` : « Fiches adhérents, activités, quotient
familial, paiements, listes d'appel »).
**confidentiel** : mécanique seulement, aucune donnée de l'artefact client d'origine ; association,
familles et animateurs de la démo inventés. **daté** : aucune grille de quotient familial en base, les
tranches sont saisies par l'association. **RGPD** : données d'adhérents, dont des mineurs.

## Pour qui

- **Associations de loisirs, culturelles et sportives** (une à quelques dizaines d'activités, quelques
  dizaines à quelques centaines d'adhérents) dont le bureau bénévole gère les inscriptions de rentrée.
- **Centres sociaux et maisons de quartier** qui appliquent un tarif modulé selon le quotient familial
  et suivent les paiements en plusieurs fois.
- **Clubs** (sport amateur, musique, théâtre) qui ont des créneaux à capacité limitée et une liste
  d'attente à la rentrée.

Aujourd'hui : fiches papier, un tableur par activité recopié à la main, les places restantes calculées
de tête, les relances d'impayés oubliées, les listes d'appel refaites chaque mois.

## Écrans (5 onglets, Guide et Réglages dans la barre)

- **Tableau de bord** (accueil) : saison en cours ; tuiles (adhérents inscrits, inscriptions, liste
  d'attente, remplissage, impayés en retard, reste à encaisser) ; graphique du remplissage par créneau
  (inscrits sur capacité, liste d'attente en plus) avec tableau accessible ; impayés en retard
  (famille, montant, plus ancienne échéance) ; fiches à compléter (mineur sans responsable légal, sans
  contact d'urgence, famille sans quotient familial, mentions d'information non remises).
- **Activités** : une carte par activité (catégorie, animateur, lieu, tarifs par tranche), ses créneaux
  (jour, horaires, places prises / capacité, liste d'attente). Un créneau ouvre la liste des inscrits et
  de la liste d'attente : passer un adhérent de l'attente à inscrit, annuler une inscription. Bouton
  « Tranches de quotient familial ».
- **Familles** : recherche ; une carte par famille (quotient familial et tranche, responsables légaux,
  contacts d'urgence, membres avec âge et mention « mineur », inscriptions, reste dû). Ajouter une
  famille, un membre, inscrire un membre à un créneau.
- **Paiements** : situation de chaque famille (dû, payé, reste, retard), filtre (en retard, reste dû,
  soldées, toutes), échéancier détaillé, encaissement (date, montant, mode, référence), journal des
  paiements avec suppression annulable. Export CSV des soldes.
- **Appel** : choix du créneau et du mois ; liste d'appel imprimable (A4 paysage) : adhérents inscrits,
  âge, contact d'urgence (option), une colonne par séance du mois (jours de fermeture exclus).
- **Guide** : fonctionnement, quotient familial et tranches, liste d'attente, échéances, rappel RGPD
  sourcé (information, conservation, mineurs, données de santé), fiches arrivées au terme de la durée
  de conservation, limites de l'outil.
- **Réglages** (modale) : association (nom, contact pour les droits RGPD), saison (nom, dates,
  périodes de fermeture), adhésion (montant, par famille ou par personne), durée de conservation,
  exports CSV (inscriptions, soldes), copie JSON, restauration, nouvelle saison, déconnexion, place
  utilisée.

## Saisie

- **Premier lancement** (2 étapes) : nom de l'association, saison (dates proposées : 1er septembre au
  30 juin), adhésion ; tranches (« tarif unique » ou « exemple fictif à 4 tranches, à remplacer par ta
  grille ») et activités types à créer (chacune avec un créneau suggéré, modifiable).
- **Activité** : nom (suggestions de la base), catégorie, couleur, animateur, lieu, tarif annuel par
  tranche, créneaux (jour, début, fin, capacité). Un créneau qui a des inscriptions ne peut pas être
  supprimé.
- **Famille** : nom, adresse, quotient familial (celui de l'attestation fournie par la famille, ou vide :
  tranche la plus haute), nombre d'échéances (1 à 10), date de la première échéance (par défaut : date
  de la première inscription), jusqu'à 2 responsables légaux (nom, lien, téléphone, e-mail), jusqu'à 2
  contacts d'urgence (nom, lien, téléphone), date de remise des mentions d'information.
- **Membre** : prénom, nom, date de naissance, remarque libre (jamais de donnée de santé : avertissement).
- **Inscription** : membre, créneau (places restantes affichées), date, tarif ajusté facultatif (sinon le
  tarif de la tranche s'applique).
- **Paiement** : famille, date, montant (proposé : retard ou prochaine échéance), mode, référence.

## Mécanique clé (fonctions pures, `regles.js`)

1. **Tranche** : les tranches sont triées par plafond croissant, la dernière n'a pas de plafond. La
   tranche d'une famille est la première dont le plafond est supérieur ou égal à son quotient ; sans
   quotient, la dernière (tarif plein). Validation : noms non vides, plafonds entiers strictement
   croissants, une seule tranche sans plafond, en dernier.
2. **Tarif d'une inscription** : tarif ajusté s'il est saisi, sinon tarif de l'activité pour la tranche
   de la famille (0 si non renseigné).
3. **Places et liste d'attente** : une nouvelle inscription est « inscrite » s'il reste une place dans le
   créneau, sinon « en attente ». La file est ordonnée par date d'inscription puis ordre de saisie ;
   rang affiché. Après une annulation ou une hausse de capacité, les premiers de la file qui tiennent
   dans les places libérées passent « inscrits » (toast avec « Annuler »). Un membre ne peut pas être
   inscrit deux fois au même créneau (sauf inscription annulée).
4. **Dû d'une famille** : adhésion (par famille : une fois si au moins un membre est inscrit ; par
   personne : une fois par membre inscrit) + tarifs des inscriptions « inscrites » (l'attente et les
   annulations ne sont pas dues).
5. **Échéancier** : total réparti en N échéances égales au centime près (le reste des centimes sur la
   première), la k-ième à la date de départ + k mois (fin de mois ramenée au dernier jour).
6. **Retard** : montant dû des échéances dont la date est passée (strictement avant aujourd'hui) moins
   le total payé, s'il est positif ; plus ancienne échéance non couverte. Reste dû = total − payé
   (négatif = trop-perçu, signalé).
7. **Remplissage** : par créneau, inscrits / capacité ; global = somme des inscrits / somme des
   capacités.
8. **Séances d'un créneau** : toutes les dates du jour de la semaine entre le début et la fin de la
   saison, hors périodes de fermeture saisies ; filtrées par mois pour la liste d'appel.
9. **Âge** à une date donnée (anniversaire non atteint retranché) ; mineur = moins de 18 ans aujourd'hui.
10. **Conservation** : une famille sans inscription dans la saison en cours dont la dernière saison
    d'inscription s'est terminée il y a plus que la durée réglée (3 ans par défaut) est listée « à
    supprimer » dans le Guide.
11. **Nouvelle saison** : garde l'association, les activités, les tranches et les familles ; vide
    inscriptions et paiements (après export conseillé) ; note pour chaque famille inscrite la fin de la
    saison close.
12. **Export CSV** (point-virgule, BOM UTF-8, guillemets échappés, formules neutralisées) : inscriptions
    (famille, membre, naissance, âge, mineur, activité, créneau, statut, rang d'attente, date, tranche,
    tarif) et soldes (famille, quotient, tranche, dû, payé, reste, retard, échéances).

## Base intégrée (`donnees.js`)

- **18 activités types** en 5 catégories (Sport, Bien-être, Culture et arts, Accompagnement, Loisirs
  et vie de quartier) avec public indicatif et un créneau suggéré (jour, horaires, capacité) : intitulés
  génériques, aucun tarif.
- **Modèle de tranches** : « tarif unique » (aucune tranche) ou **exemple fictif** à 4 tranches
  (A ≤ 600, B ≤ 900, C ≤ 1 200, D au-delà), annoncé comme un exemple à remplacer par la grille votée
  par l'association. Aucun barème officiel.
- **Modes de paiement** : espèces, chèque, virement, carte bancaire, prélèvement, aide ou bon d'un
  organisme (mode générique, sans nom de dispositif).
- **Liens de parenté** proposés : mère, père, tuteur ou tutrice, grand-parent, autre.
- **Rappel RGPD** (texte et liens, voir Sources).

## Sources (consultées le 13/11/2026)

- CNIL, *Guide de sensibilisation au RGPD pour les associations* (PDF,
  https://www.cnil.fr/sites/cnil/files/atoms/files/cnil-guide_association.pdf) : mentions
  d'information à donner à la collecte (identité de l'association, objectif, caractère obligatoire,
  destinataires, durée de conservation, droits, contact, plainte à la CNIL), information adaptée aux
  enfants et à leur représentant légal ; durée limitée : la CNIL recommande de conserver les données
  d'un adhérent trois ans après la fin de son adhésion ; données de santé = données sensibles (exemple
  d'une association de sorties extrascolaires qui recueille une allergie avec l'accord du représentant
  légal) ; accès aux informations de paiement limité aux personnes chargées du suivi.
- CNIL, *Les inscriptions aux activités extrascolaires dans le respect de la vie privée* (page du
  02/09/2024,
  https://www.cnil.fr/fr/les-inscriptions-aux-activites-extrascolaires-dans-le-respect-de-la-vie-privee) :
  ne demander que l'indispensable (pas de nationalité, de numéro de sécurité sociale), information
  obligatoire sur le formulaire, pour un mineur le responsable légal exerce le droit d'opposition.
- Quotient familial : valeur fournie par la famille, tranches et tarifs décidés par l'association.
  Aucune donnée externe reprise, aucune licence en jeu.
- Activités types, modes de paiement : rédigés pour le produit.

## Choix d'implémentation

- Une saison active par compte ; « Nouvelle saison » vide inscriptions et paiements en gardant le
  reste (exporter avant). Les familles anciennes restent jusqu'à leur suppression (liste « à
  supprimer » selon la durée de conservation).
- Aucun champ santé : la remarque libre porte un avertissement ; le Guide renvoie au recueil séparé
  (fiche sanitaire papier) avec l'accord du représentant légal.
- Montants en euros, calculs en centimes entiers.
- Liste d'appel : impression du navigateur (A4 paysage), le contact d'urgence est une option décochée
  par défaut.

## Risques

- **RGPD** : rappel dans le Guide, l'écran Familles et la fiche Gumroad ; l'association reste
  responsable de traitement (outil, pas conseil juridique). Données stockées sur le service QME
  (hébergement Netlify) : indiqué dans le Guide.
- **daté** : rien de réglementaire chiffré hormis la recommandation CNIL de 3 ans (réglable, source
  et date affichées).
- **confidentiel** : démo fictive (« Maison de quartier des Tilleuls », familles inventées).
- **Taille** : une famille avec 3 membres et 4 inscriptions pèse environ 1,5 Ko : quelques centaines de
  familles tiennent dans un compte (900 Ko) ; place utilisée affichée dans les réglages.
