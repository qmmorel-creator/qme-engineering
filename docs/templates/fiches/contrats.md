# T81 · Contrats fournisseurs et échéances de résiliation

Slug `contrats`, préfixe `CTR`, prix 25 €, permalien Gumroad prévu `contrats-fournisseurs`. Usage `pro`,
catalogue thème « Équipements et véhicules » (moyens généraux). Proposition validée par Quentin le 14/11/2026 ;
cadrage délégué (fiche rédigée et appliquée sans validation intermédiaire). Packs : « Moyens généraux » (PMG)
et « Exploitation et maintenance » (PXP). Marques de risque : **juridique** (règles de résiliation : aucune
règle non sourcée), **confidentiel** (aucune donnée réelle, démo fictive).

## Pour qui

- **Office managers et assistantes de direction de TPE et PME** : assurance, maintenance, télécoms, copieurs,
  nettoyage, logiciels, énergie, dans un classeur ou un tableur, sans date limite écrite nulle part.
- **Dirigeants de TPE** qui gèrent eux-mêmes : la reconduction tacite se découvre à la facture.
- **Services généraux de PME** : dizaines de contrats, plusieurs sites, budget à défendre et à renégocier.

## Règle de cadrage : aucune règle légale non sourcée

Les contrats visés sont professionnels : l'outil calcule **à partir de ce que dit chaque contrat** (date de
fin de la période en cours, reconduction, préavis). Les préavis par catégorie sont des **valeurs par défaut
d'organisation**, modifiables, affichées « préavis par défaut » tant que le contrat n'a pas le sien.

Un seul repère légal est cité, avec sa source : **Code des assurances, art. L113-12** (version en vigueur
depuis le 28/05/2026, loi n° 2026-403 du 26 mai 2026, art. 30), lu sur Légifrance le **14/11/2026**
(https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054141689) : la police fixe la durée et les
conditions de résiliation ; l'assuré peut résilier à l'expiration d'un délai d'un an en notifiant au moins
deux mois avant l'échéance ; il peut être dérogé à ces règles pour les risques autres que ceux des
particuliers. D'où le préavis par défaut de 2 mois de la catégorie « Assurances », avec la mention que la
police d'un contrat professionnel prime. **Non cités** (décision de cadrage) : loi Chatel et résiliation
infra-annuelle des assurances, pensées pour les consommateurs et non vérifiées ici ; rien n'est affirmé
à leur sujet dans le produit ni dans sa communication.

## Écrans (5 onglets + guide et réglages)

- **Bord** : tuiles (préavis dépassés, à traiter J-30, à anticiper J-60, coût annuel), économies (résiliations
  décidées, renégociations et résiliations des 12 derniers mois), alertes triées avec « Décider » ou « Lettre »,
  coût annuel par catégorie (barres + valeurs en texte).
- **Contrats** : filtres (en cours, à traiter, préavis dépassé, J-30, J-60, à compléter, rien à faire,
  résiliés et terminés), catégorie, recherche, regroupement par catégorie ou par fournisseur ; date limite,
  coût annuel, étiquettes (statut, décision, tacite, préavis par défaut). Fiche : date limite, échéance en
  cours et reconductions, préavis et son origine, coût, actions (décider, lettre, renégocié, résiliation
  envoyée, annuler la résiliation), historique du contrat, notes.
- **Calendrier** : préavis dépassés à part, puis les 12 prochains mois (dates d'envoi conseillées, échéances
  avec reconduction, fins de contrat, fins effectives des résiliations), contrats sans date.
- **Coûts** : coût annuel total et mensuel, à résilier, économisé ; par catégorie (barres + tableau avec part)
  et par fournisseur ; paiements uniques à part.
- **Historique** : décisions, renégociations (écart de coût annuel), résiliations, annulations, notes et
  reconductions tacites déduites des dates ; filtre par contrat ; export CSV.
- **Guide et calculs** : règles de calcul, repère légal sourcé (assurances), lettre, limites.
- **Réglages** : structure, alertes (60 et 30 jours), marge d'envoi (7 jours), montants HT ou TTC, en-tête et
  signataire de la lettre, catégories (nom, préavis par défaut, reconduction, durée), exports CSV, copie JSON,
  compte, « Sur téléphone ».

## Mécanique (fonctions pures, `regles.js`, `window.CTR`)

1. **Moteur d'échéances commun avec T63** (`templates/verifications/`) : mêmes fonctions de dates (mois
   bornés à la fin du mois, en avant comme en arrière : 31 mai − 3 mois = 28 ou 29 février).
2. **Échéance en cours** : date de fin saisie ; avec reconduction tacite, avancée de la durée de reconduction
   (contrat, sinon catégorie, 12 mois par défaut) tant qu'elle est passée ; reconductions gardées et
   affichées dans l'historique.
3. **Préavis** : celui du contrat (mois ou jours, 0 possible), sinon celui de la catégorie ; aucun → à saisir.
4. **Date limite de réception** = échéance − préavis ; **envoi conseillé** = date limite − marge.
5. **Statut** : préavis dépassé (date d'envoi passée, tacite), à traiter (≤ 30 j), à anticiper (≤ 60 j), rien à
   faire, à compléter (sans date de fin), résiliation envoyée, terminé. Sans reconduction tacite, l'alerte porte
   sur la fin du contrat. Préavis dépassé : prochaine date limite affichée (échéance suivante).
6. **Décision** : vaut pour l'échéance où elle est prise (`decisionPour`) ; « Renouveler » éteint l'alerte ;
   après la reconduction, retour à « à décider ».
7. **Résiliation** : envoyée au plus tard à la date limite → fin à l'échéance en cours ; après → échéance
   suivante (modifiable si le fournisseur accepte une autre date) ; refus d'une date d'envoi future.
8. **Renégociation** : nouveau montant (et périodicité), nouvelle fin facultative ; écart de coût annuel gardé.
9. **Coût annuel** = montant × paiements par an (12, 4, 2, 1 ; paiement unique 0, montré à part).
10. **Lettre** : modèle à adapter (structure, adresse, fournisseur, n° et objet du contrat, date de
    souscription, échéance visée, préavis, demande de confirmation écrite), champs manquants en
    `[crochets]` ; copie et impression seules (aucun envoi).
11. **CSV** : point-virgule, BOM UTF-8, formules neutralisées ; contrats (dates limites, origine du préavis,
    décision) et historique.

## Démo

« Société Exemple », 15 contrats de fournisseurs fictifs (« … Exemple »), dates relatives à aujourd'hui.
États couverts : préavis dépassé (nettoyage), J-30 (assurance des locaux ; copieur avec décision « Résilier »
et préavis de 6 mois saisi), J-60 (climatisation à renégocier ; électricité sans reconduction), reconductions
tacites passées (fibre), renégociations (fibre, portes), résiliation envoyée (télésurveillance), contrat
terminé (fontaines), paiement unique, date de fin à saisir (messagerie), décisions « Renouveler ».

## Risques et avertissements

- **Juridique** : outil d'aide, ne remplace ni la lecture du contrat ni un conseil juridique ; avertissement
  sur le bord, les contrats, les coûts, le guide, la page du site et la fiche Gumroad. Repère L113-12 à
  revérifier sur Légifrance en cas de modification de l'article.
- Pas de stockage de fichiers (lien vers le contrat), pas d'envoi d'e-mails ni de rappels hors de l'outil.
- Indexations de prix non calculées (saisir le nouveau montant).
- Données personnelles : signataire et interlocuteur (fonction conseillée) seulement.
