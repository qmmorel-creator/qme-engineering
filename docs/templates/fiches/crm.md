# T28 · CRM freelance

Slug `crm`, préfixe `CRM`, prix 25 €, permalien Gumroad `crm-freelance`, taille M, priorité P1.
Origine : documents de travail de Quentin (12/11/2026) + backlog n° 09 fusionné (historique des
échanges, prochaine action, chiffre d'affaires par client). Fiche rédigée le 12/11/2026.

## Pour qui

Freelances, consultants, indépendants et petites structures de services (1 à 3 personnes) qui suivent
leurs prospects dans leur boîte mail, un carnet ou un tableur, oublient de relancer et ne savent pas
d'un coup d'œil qui leur doit de l'argent. Ceux qui ont essayé un CRM d'équipe et l'ont trouvé trop
lourd ou trop cher pour une personne seule.

## Promesse

Chaque matin, la liste exacte des personnes à relancer, et à côté ce qui reste à encaisser.

## Écrans (5 onglets)

1. **Aujourd'hui** : « À relancer aujourd'hui » (prochaines actions dues, retards en tête), factures en
   retard de paiement, devis envoyés à relancer, contacts actifs sans prochaine action, actions des
   7 prochains jours. Tuiles : encaissé ce mois-ci, reste à encaisser, dont en retard. Bouton « Fait »
   sur chaque action : l'échange est noté dans l'historique et la prochaine action type est proposée.
2. **Contacts** : prospects et clients (statut calculé : client dès qu'une facture existe ou qu'une
   affaire est gagnée), recherche, filtre (prospects, clients, à revoir RGPD, archivés). Fiche contact :
   coordonnées, origine, notes, prochaine action datée, historique des échanges (appel, e-mail,
   rendez-vous, visio, message, autre), affaires, devis et factures, chiffre d'affaires du client.
3. **Affaires** (pipeline) : colonnes par étape de vente, montant estimé par colonne, passage à l'étape
   suivante en un clic ; une affaire gagnée suit son avancement (à démarrer, en cours, terminée) ; une
   affaire perdue garde son motif.
4. **Factures** : devis et factures **en suivi seulement** (numéro, date, objet, montant HT, taux de TVA
   saisi, TTC, échéance, statut). Devis : brouillon, envoyé, accepté, refusé, expiré (validité
   dépassée). Factures : à encaisser, partiellement payée, payée, en retard, annulée. Encaissements
   (date, montant, mode) ; un devis accepté se transforme en facture préremplie.
5. **Chiffres** : CA facturé HT et encaissé par mois (12 mois glissants, graphique + tableau
   accessible), CA par client sur l'année choisie, taux de transformation des devis, montant du pipeline.

## Saisie

- Contact : nom (obligatoire), entreprise, e-mail, téléphone, origine, notes ; prochaine action
  (type, date, note).
- Échange : date, type, résumé ; puis prochaine action (proposée selon le type choisi).
- Affaire : contact, titre, montant HT estimé, étape, date de décision visée.
- Document : type, numéro (suggéré : `D-2026-001`, `F-2026-001`), contact, affaire, date, objet,
  montant HT, taux de TVA (%), délai de paiement (jours) ou date de validité du devis.

## Mécanique clé

- **Prochaine action datée** : un contact actif a toujours une prochaine action ; « Fait » ouvre la
  saisie de l'échange et propose la suivante (type, délai) selon la base. Retards en rouge.
- **Statut des factures** calculé : solde = TTC − encaissements ; « en retard » si échéance dépassée
  et solde positif. Échéance = date + délai saisi (30 jours par défaut, réglable).
- **CA par mois** : facturé (HT, date de facture, factures non annulées) et encaissé (TTC, date
  d'encaissement).
- **RGPD** : un prospect sans échange depuis la durée choisie (3 ans par défaut, référentiel CNIL) ou un
  client dont la relation est terminée depuis cette durée est signalé « à revoir » ; suppression ou
  archivage en un clic.

## Base intégrée

- **6 étapes de vente** : Piste, Qualifié, Proposition envoyée, Négociation, Gagné, Perdu (définition,
  action conseillée à l'entrée de l'étape).
- **14 prochaines actions types** avec délai par défaut et conseil : premier contact, relance sans
  réponse, rendez-vous de découverte, envoi de la proposition, relance du devis, point sur la décision,
  lancement du projet, point d'avancement, livraison et facture, relance de facture, demande de
  témoignage, prise de nouvelles, raison du refus, recontacter plus tard.
- 6 types d'échange, 8 origines de contact, 6 motifs de perte, 5 modes de paiement.
- Aucun taux de TVA, aucune mention légale de facture : saisis par l'utilisateur.

## Repères réglementaires (affichés avec source et date dans l'aide)

- Délai de paiement entre professionnels : 30 jours après la réalisation de la prestation à défaut
  d'accord ; jusqu'à 60 jours après l'émission de la facture si convenu ; indemnité forfaitaire de 40 €
  pour frais de recouvrement. Source : entreprendre.service-public.gouv.fr (fiche F23211, vérifiée le
  07/08/2026, consultée le 12/11/2026). Seul le délai par défaut de 30 jours est utilisé, comme valeur
  réglable.
- Facturation électronique : réception obligatoire pour toutes les entreprises depuis le
  01/09/2026 ; émission obligatoire au 01/09/2027 pour les PME et micro-entreprises. Source :
  impots.gouv.fr (« Je découvre la facturation électronique », consultée le 12/11/2026). Sert à dire
  que l'application n'émet pas de factures.
- Conservation des données de prospects : 3 ans à compter de la collecte ou du dernier contact venant
  du prospect ; clients : 3 ans après la fin de la relation commerciale (référentiel non contraignant).
  Source : cnil.fr, questions-réponses sur les référentiels « gestion des activités commerciales »
  (consultée le 12/11/2026).

## Risques et avertissements

- **Comptable / fiscal** : suivi seulement, pas un logiciel de facturation ni de comptabilité ; ne
  produit aucune facture ; taux de TVA et mentions vérifiés par l'utilisateur. Dit dans l'onglet
  Factures, l'aide et la fiche Gumroad.
- **RGPD** : données de clients et de prospects (tiers) hébergées en ligne ; rappel dans l'aide
  (minimisation, information des personnes, durées de conservation, droits d'accès et d'effacement).
- **Daté** : les trois repères ci-dessus, avec source et date ; à revérifier une fois par an.
- Frontières : T35 (prospection B2B : cadences et scripts de messages) et T36 (générateur de devis :
  lignes, PDF) restent séparés ; T28 ne produit ni script ni PDF de devis.

## Choix d'implémentation

- Socle `templates/revision/` ; règles métier pures dans `templates/crm/regles.js`
  (`globalThis.CRM_REGLES`), testées par `outils/templates/crm.test.mjs`.
- Une seule prochaine action par contact (simplicité) ; l'historique garde tous les échanges.
- Montants saisis au centime ; TTC = HT × (1 + TVA %) arrondi au centime.
- Démo relative à aujourd'hui, 100 % fictive (noms d'entreprises inventés, domaines `example.com`).
