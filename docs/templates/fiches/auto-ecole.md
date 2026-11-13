# T57 · Gestion d'auto-école

Slug `auto-ecole`, préfixe `AEC`, prix 45 €, permalien Gumroad `gestion-auto-ecole`, port local 8917.
Taille L, P1. Origine : backlog de Quentin n° 34 (« Auto-école »), ligne T57 de `IDEES.md`. Base commune
prévue avec T29 (Gestion de flotte), mais **code propre** (aucune dépendance à `templates/flotte/`).
Marques de risque : **daté** (contrôle technique), **RGPD** (élèves, parfois mineurs ; moniteurs).
Aucune marque de véhicule, nulle part. Exemples fictifs.

## Pour qui

- **Auto-écoles indépendantes de 1 à 10 moniteurs** (permis B surtout), où le gérant, souvent
  moniteur lui-même, tient le planning et les comptes des élèves.
- **Secrétariat d'auto-école** : celui ou celle qui répond au téléphone, cale les leçons, encaisse.
- **Moniteurs indépendants** qui louent un véhicule à double commande et gèrent leurs propres élèves.

Aujourd'hui : planning papier ou agenda partagé, fiche cartonnée par élève (heures faites, paiements),
tableur pour les véhicules ; on découvre au comptoir qu'un forfait est épuisé, qu'un élève doit encore
de l'argent ou qu'un véhicule est réservé deux fois.

## Écrans (5 onglets + guide et réglages)

- **Planning** (accueil) : vue **jour** (par défaut sur téléphone) ou **semaine** (par défaut sur
  ordinateur), navigation précédent / aujourd'hui / suivant. Semaine : grille avec une ligne par
  **moniteur** ou par **véhicule** (bascule), une colonne par jour ouvert, leçons en pastilles
  (heure, élève). Jour : leçons groupées par moniteur, avec actions rapides **Faite**, **Absent**,
  **Annuler** sur les leçons prévues. « Nouvelle leçon » : élève, moniteur, véhicule, date, heure,
  durée. Une leçon qui chevauche une autre leçon du même moniteur, du même véhicule ou du même élève
  est **refusée**, avec la leçon en conflit nommée. Hors disponibilités du moniteur ou hors horaires
  d'ouverture : refusée sauf case « Forcer » cochée.
- **Élèves** : cartes (nom, boîte manuelle ou automatique, heures restantes, montant dû, progression
  des compétences), filtre actifs / terminés, recherche. **Fiche élève** : solde d'heures (achetées,
  faites, planifiées, restantes), solde financier (facturé, payé, reste dû), achats d'heures ou de
  forfaits, paiements, compétences cochées avec date, historique des leçons.
- **Véhicules** : cartes (libellé, immatriculation, boîte, kilométrage, contrôle technique, entretien,
  coût par heure sur 12 mois) ; actions « Relevé km » et « Intervention ». Fiche : interventions
  (entretien, contrôle technique, réparation, assurance, carburant, autre) avec coût.
- **Moniteurs** : cartes (heures de la semaine, occupation, disponibilités hebdomadaires, absences).
  Modale : disponibilités par jour (plages « 08:00-12:00, 14:00-19:00 ») et absences datées.
- **Bilan** : tuiles (heures vendues et faites sur le mois, heures dues aux élèves, reste à encaisser),
  alertes (contrôle technique dépassé ou proche, entretien dû, forfait épuisé ou négatif, impayé),
  graphique heures vendues / faites sur 6 mois, occupation de la semaine par véhicule et par moniteur,
  coût par heure de conduite par véhicule (12 mois glissants), exports CSV.
- **Guide** (depuis le Bilan et les Réglages) : règles de calcul, contrôle technique (source et date),
  rappel RGPD, limites.
- **Réglages** (modale) : nom de l'école, jours et horaires d'ouverture, durée de leçon par défaut,
  absence non excusée décomptée ou non, fenêtres d'alerte (jours, km), liste des compétences
  (modifiable), exports CSV, copie JSON, restauration, déconnexion.

## Saisie

- **Élève** : nom (prénom + initiale conseillés), boîte (manuelle, automatique), date d'inscription,
  case « mineur » (rappel sur le représentant légal), contact facultatif, statut (actif, terminé),
  notes courtes.
- **Achat d'heures** : date, nombre d'heures, montant, libellé (« Forfait 20 h », « 5 h
  supplémentaires »). Le prix est saisi : aucun tarif n'est proposé.
- **Paiement** : date, montant, mode (espèces, carte, chèque, virement, autre).
- **Moniteur** : nom, couleur, disponibilités hebdomadaires, absences (début, fin, motif court).
- **Véhicule** : libellé (« Citadine 1 »), immatriculation, boîte, date d'entrée, km à l'entrée,
  coût fixe mensuel facultatif (loyer, amortissement, assurance au mois…), intervalle d'entretien en km
  et en mois (lu dans le carnet du constructeur, facultatif), **date limite du prochain contrôle
  technique** (lue sur le procès-verbal du dernier contrôle).
- **Intervention** : date, type, km, coût, libellé ; pour un contrôle technique, la nouvelle date
  limite (lue sur le procès-verbal) ; si une périodicité a été saisie dans les réglages, elle est
  proposée.
- **Leçon** : élève, moniteur, véhicule, date, heure de début, durée (minutes), statut (prévue, faite,
  absent, annulée), note courte.

## Mécanique clé (fonctions pures, `regles.js`)

1. **Intervalles** : une leçon occupe [début, début + durée[ ; deux leçons se chevauchent si même
   date et intervalles qui se croisent (10:00-11:00 et 11:00-12:00 ne se chevauchent pas). Les leçons
   annulées n'occupent rien. Conflit = même moniteur, même véhicule ou même élève.
2. **Disponibilité** : la leçon doit tenir dans une plage hebdomadaire du moniteur (jour de la
   semaine), hors absence, et dans les horaires d'ouverture.
3. **Solde d'heures** d'un élève : achetées = somme des achats ; faites = leçons « faite » (+ « absent »
   si le réglage décompte les absences) ; planifiées = leçons « prévue » ; restantes = achetées −
   faites ; disponibles à planifier = restantes − planifiées (négatif → alerte).
4. **Solde financier** : facturé = somme des achats ; payé = somme des paiements ; reste dû = facturé −
   payé.
5. **Kilométrage** : plus grand des km d'entrée, relevés et km des interventions.
6. **Entretien** : référence = dernière intervention « entretien », sinon entrée du véhicule ;
   échéance km = réf. + intervalle km, échéance date = réf. + intervalle mois ; la première atteinte
   compte ; état `retard`, `proche` (fenêtre réglable), `ok`, `inconnu` (pas d'intervalle saisi).
7. **Contrôle technique** : date limite = celle de la dernière intervention « contrôle technique »
   si elle est renseignée, sinon celle de la fiche véhicule ; état `retard` (date passée), `proche`,
   `ok`, `inconnu`.
8. **Coût par heure de conduite** sur une période : (coûts des interventions de la période + coût fixe
   mensuel × mois de la période au prorata des jours de présence) ÷ heures de leçons faites (ou
   décomptées) avec ce véhicule sur la période ; rien si aucune heure.
9. **Occupation** de la semaine : heures de leçons non annulées ÷ heures ouvertes (véhicule) ou ÷ heures
   de disponibilité hors absences (moniteur).
10. **Heures vendues / faites par mois** pour le graphique du bilan.
11. **Export CSV** : élèves (soldes), leçons (période), véhicules (km, échéances, coût par heure) ;
    point-virgule, BOM UTF-8, formules neutralisées (`=`, `+`, `-`, `@` en tête préfixés d'une apostrophe).

## Base intégrée (`donnees.js`)

- **Compétences** : 10 étapes génériques de progression rédigées pour le produit (installation et
  commandes, démarrage et arrêt, trajectoire et allure, intersections, changements de direction,
  insertion et dépassement, manœuvres, agglomération, route et voie rapide, conduite autonome).
  **Ce n'est pas le référentiel officiel** de la formation à la conduite (non repris, non vérifié) :
  liste modifiable, à aligner sur le livret d'apprentissage de l'élève.
- Modes de paiement, types d'intervention, couleurs des moniteurs (ordre fixe de la charte).
- Contrôle technique : règle générale des voitures (M1) avec source et date, **sans périodicité
  imposée** pour les véhicules d'auto-école (voir Sources).
- Aucun tarif, aucune durée de formation, aucun intervalle d'entretien par défaut.

## Sources (consultées le 13/11/2026)

- **Contrôle technique d'une voiture (catégorie M1)**, service-public.gouv.fr, fiche F2878, « Vérifié
  le 1er janvier 2026 » : 1er contrôle dans les 6 mois avant le 4e anniversaire de la 1re mise en
  circulation ; résultat favorable valable 2 ans pour un véhicule M1. La fiche **ne traite pas** des
  véhicules utilisés pour l'enseignement de la conduite. Aucune source officielle consultée n'a permis
  de confirmer une périodicité propre aux véhicules d'auto-école : **la date limite est donc une
  saisie** (lue sur le procès-verbal du contrôle), et la périodicité éventuelle se règle dans les
  réglages (vide par défaut), avec un avertissement « à vérifier auprès de ton centre de contrôle ».
- RGPD : principes généraux (minimisation, information des personnes, durée de conservation) ; pas de
  durée de conservation chiffrée affichée (non vérifiée).

## Risques

- **daté** : contrôle technique en saisie (date limite du procès-verbal) ; la règle générale M1 est
  affichée avec sa source et sa date de vérification.
- **RGPD** : données d'élèves (parfois mineurs ; aucun âge réglementaire n'est cité, faute de
  vérification) et de moniteurs. Rappel dans la modale élève, la modale moniteur et le Guide : ne saisir que le nécessaire
  (pas de numéro de permis, de données de santé, de pièce d'identité), informer les élèves et leurs
  représentants légaux, limiter la conservation, supprimer les élèves partis. Démo : prénoms fictifs et
  initiale.
- **Argent** : montants tels que saisis ; pas un logiciel de facturation ni de caisse ; pas de conseil
  comptable ni fiscal (TVA non gérée).
- **Pédagogie** : la liste de compétences est un aide-mémoire, pas le livret d'apprentissage officiel.

## Choix d'implémentation (V1)

- Socle de `templates/revision/` (structure reprise de `templates/reserves/` : `regles.js` exposé en
  `window.REGLES`), testé par `outils/templates/auto-ecole.test.mjs` avec une date de référence fixe.
- Un compte = une clé : les moniteurs et les élèves n'ont pas d'accès séparé ; pas de réservation en
  ligne par les élèves.
- Pas de paiement en ligne, pas de facture, pas de lien avec l'administration des examens.
- Données JSON uniquement (≈ 900 Ko par compte) : plusieurs milliers de leçons ; archiver (exporter
  puis supprimer) les élèves terminés.
