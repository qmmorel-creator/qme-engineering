# Guides : propositions et suivi

Établi le 14/11/2026. Huit guides qui répondent à une question réelle (vue dans l'autocomplétion Google, voir
`mots-cles.md`) et mènent au template concerné. Chaque guide demande l'accord de Quentin, puis une relecture des faits
juridiques à la date de publication.

## Suivi

| Guide | Statut |
|---|---|
| 2. Facture impayée → `/guides/facture-impayee/` | Rédigé, PR #PR_GUIDES (non fusionnée), sources revérifiées le 15/11/2026 |
| 3. Levée des réserves → `/guides/levee-des-reserves/` | Rédigé, PR #PR_GUIDES (non fusionnée), sources revérifiées le 15/11/2026 |
| Budget à deux, 50/50 ou prorata → `/guides/budget-couple-50-50-ou-prorata/` (décidé le 15/11/2026, hors liste initiale) | Rédigé, PR #PR_GUIDES (non fusionnée), calculateur sur le moteur de `templates/budget-commun/regles.js` |
| 1, 4, 5, 6, 7, 8 | Proposés, non rédigés |

Rubrique `/guides/` (lot 1, 15/11/2026) : page d'index, `assets/guides.css` et `assets/guides.js`, JSON-LD `Article`
généré par `outils/seo/donnees-structurees.mjs` (date tirée de la mention « à jour au JJ/MM/AAAA »), tests
`outils/templates/guides.test.mjs`, lien « Guides » dans le pied de page (pas dans le menu), lien « Lire le guide »
sur les pages catalogue concernées. Pour un nouveau guide : même squelette, mention datée, sources datées, puis
`node outils/seo/donnees-structurees.mjs` et `node outils/sitemap/generer.mjs`.

Règles de rédaction communes :
- Répondre à la question en premier, complètement, même sans acheter : le template n'arrive qu'à la fin, comme une
  façon de tenir la démarche dans la durée (« Essayer la démo »). Pas de bourrage de mots-clés.
- Chaque fait juridique ou chiffré cite sa source officielle avec sa date de vérification ; les taux qui changent
  (taux d'intérêt légal, cotisations) sont datés dans le texte.
- Mention visible : « Guide d'information générale, à jour au JJ/MM/AAAA. Il ne remplace pas un avis professionnel
  (juriste, expert-comptable, préventeur, assureur). »
- Emplacement proposé : `/guides/<slug>/` (nouvelle rubrique indexée, ajoutée au sitemap, JSON-LD `Article` +
  `BreadcrumbList`, FAQ visible seulement si elle apporte quelque chose).
- Toutes les sources ci-dessous ont été **ouvertes le 14/11/2026** ; la date indiquée est celle affichée par la page.

## 1. Document unique (DUERP) : qui doit le faire, quand le mettre à jour, combien de temps le garder

- Requêtes visées : « document unique d'évaluation des risques », « document unique modèle », « document unique
  exemple », « duerp obligatoire ».
- Plan : obligation dès le premier salarié ; contenu (unités de travail, inventaire, cotation, plan d'actions) ;
  mise à jour selon l'effectif ; conservation 40 ans ; dépôt sur un portail numérique (état réel aujourd'hui) ;
  erreurs fréquentes ; méthode pas à pas.
- Mène à : [Document unique](https://qm-engineering.fr/catalogue/document-unique/).
- Sources :
  - entreprendre.service-public.gouv.fr/vosdroits/F35360, vérifiée le 22/07/2026 : obligatoire dès le 1er salarié ;
    mise à jour au moins annuelle à partir de 11 salariés ; versions conservées 40 ans (C. trav. R4121-1 à R4121-4).
  - inrs.fr, focus juridique « Document unique d'évaluation des risques professionnels : quelles obligations ? »,
    mis à jour le 04/10/2024 : le portail de dépôt « n'est toujours pas disponible ».
  - code.travail.gouv.fr, article L4121-3-1 (mise à jour 31/03/2022) : conservation d'au moins 40 ans ; dépôt
    dématérialisé prévu dès le 01/07/2023 (150 salariés et plus), au plus tard le 01/07/2024 pour les autres, à des
    dates fixées par décret.
- **À vérifier avant rédaction** : l'INRS écrit « plus de 11 salariés » alors que service-public écrit « 11 salariés et
  plus » (retenir le texte de l'article R4121-2 sur Légifrance) ; l'ouverture effective du portail de dépôt (aucune
  source officielle trouvée la confirmant en 2026).

## 2. Facture impayée entre professionnels : délais, pénalités, indemnité de 40 €, mise en demeure

- Requêtes visées : « relance facture impayée », « relance facture impayée délai », « relance facture impayée avant
  mise en demeure », « modèle 1ère relance facture impayée ».
- Plan : délais de paiement légaux ; calcul des pénalités (exemple chiffré daté) ; indemnité forfaitaire ; paliers de
  relance (exemples de messages) ; mise en demeure ; injonction de payer et procédure simplifiée ; cas du client
  particulier et du micro-entrepreneur (fiche distincte).
- Mène à : [Relance des impayés](https://qm-engineering.fr/catalogue/impayes/).
- Sources :
  - entreprendre.service-public.gouv.fr/vosdroits/F23211, vérifiée le 07/08/2026 : délai par défaut 30 jours ; 60 jours
    date de facture ou 45 jours fin de mois au plus (C. com. L441-10, L441-11) ; pénalités dès le lendemain de
    l'échéance, au moins 3 fois le taux d'intérêt légal, taux de référence BCE + 10 points (12,15 % au 1er semestre
    2026, 12,40 % au 2nd) ; indemnité forfaitaire de 40 € par facture (D441-5).
  - entreprendre.service-public.gouv.fr/vosdroits/F38586, vérifiée le 27/11/2024 : relance non obligatoire ; trois formes
    de mise en demeure (C. civ. 1344 à 1345-3) ; procédure simplifiée sous 5 000 €.
  - service-public.gouv.fr/particuliers/vosdroits/F1746, vérifiée le 01/09/2026 : injonction de payer (CPC 1405 à 1422),
    frais au tribunal de commerce, procédure simplifiée.
- À vérifier : la procédure annoncée pour les créances entre commerçants « au plus tard le 31/12/2026 » (F38586).
- **Revérifié le 15/11/2026 (rédaction)** : F23211, F38586 et F1746 disent toujours la même chose (mêmes dates de
  vérification affichées) ; L441-10 (version du 26/04/2019) et D441-5 (27/02/2021) inchangés sur Légifrance ; Banque de
  France : 2,15 % au 01/01/2026, 2,40 % au 01/07/2026, puis 2,65 % depuis le 16/09/2026 (sans effet sur le 2nd
  semestre 2026). F23211 donne le plancher de 3 fois le taux légal : 8,25 %. F1746 : frais de greffe 33,47 €,
  procédure simplifiée 14,92 € + 30,06 € TTC. Procédure entre commerçants : loi n° 2026-307 du 23/04/2026 confirmée
  par l'actualité service-public A18889 (27/04/2026) ; F38586 la dit « opérationnelle après parution d'un arrêté et au
  plus tard le 31 décembre 2026 » ; la presse juridique cite un décret du 20/10/2026, **aucune source officielle
  consultée ne confirme la date d'entrée en vigueur** : le guide le dit et renvoie vers un commissaire de justice.
  F23211 précise qu'elle ne concerne pas les micro-entrepreneurs : le guide le signale.

## 3. Lever les réserves après la réception des travaux

- Requêtes visées : « levée des réserves », « levée des réserves travaux », « modèle pv levée des réserves »,
  « suivi des levées de réserves », « levée des réserves et garantie de parfait achèvement ».
- Plan : réception avec ou sans réserves ; ce qui arrive à un désordre non signalé ; garantie de parfait achèvement ;
  délai de levée (convenu, pas fixé par la loi) ; mise en demeure puis travaux aux frais de l'entrepreneur ;
  procès-verbal de levée ; suivi par lot et par entreprise.
- Mène à : [Levée de réserves](https://qm-engineering.fr/catalogue/reserves/) (professionnels) et
  [Pilote de travaux maison](https://qm-engineering.fr/catalogue/travaux/) (particuliers).
- Sources :
  - service-public.gouv.fr/particuliers/vosdroits/F2958, vérifiée le 25/09/2026 : réception avec ou sans réserves ;
    désordre non signalé considéré comme accepté ; garantie de parfait achèvement d'un an (C. civ. 1792-6).
  - legifrance.gouv.fr, Code civil article 1792-6 (en vigueur depuis le 01/01/1979) : délai de réparation fixé d'un
    commun accord ; à défaut, mise en demeure, puis travaux aux frais et risques de l'entrepreneur défaillant.
- À vérifier : la retenue de garantie (5 %) et les règles des marchés publics (CCAG Travaux) si le guide les aborde ;
  la fiche DGCCRF sur les malfaçons n'a pas pu être ouverte (erreur 403).
- **Revérifié le 15/11/2026 (rédaction)** : F2958 (titre « Garanties après la réception des travaux », vérifiée le
  25/09/2026) et l'article 1792-6 (LEGIARTI000006443552, en vigueur depuis le 01/01/1979) disent toujours la même chose.
  F2958 ne parle ni de levée des réserves ni de retenue de garantie. **Retenue de garantie (5 %, loi 71-584) : texte
  officiel non retrouvé sur Légifrance pendant la session, point retiré du guide.** CCAG Travaux : non abordé (le
  guide se limite aux travaux de droit privé et le dit). Le délai de 8 jours du maître d'ouvrage non assisté (CCMI)
  n'est pas abordé non plus.

## 4. État des lieux d'entrée et de sortie : mentions, vétusté et restitution du dépôt de garantie

- Requêtes visées : « état des lieux de sortie », « état des lieux modèle », « état des lieux entrée et sortie sur le
  même document ».
- Plan : mentions obligatoires ; entrée et sortie comparées ; photos ; vétusté et grille ; délais de restitution du
  dépôt (1 ou 2 mois) et pénalité de retard ; retenues justifiées ; recours.
- Mène à : [État des lieux](https://qm-engineering.fr/catalogue/etat-des-lieux/).
- Sources :
  - service-public.gouv.fr/particuliers/vosdroits/F31270, vérifiée le 10/03/2026 : mentions minimales (loi 89-462 art.
    3-2, décret 2016-382) ; correction possible sous 10 jours ; grille de vétusté si convenue au bail.
  - service-public.gouv.fr/particuliers/vosdroits/F33671, vérifiée le 10/03/2026 : état des lieux de sortie de même
    forme ; pas de retenue pour vétusté.
  - service-public.gouv.fr/particuliers/vosdroits/F31269, vérifiée le 09/06/2026 : dépôt plafonné à 1 mois de loyer
    hors charges (logement vide) ; restitution sous 1 ou 2 mois ; pénalité de 10 % du loyer par mois de retard (loi
    89-462 art. 22).
- Limite : location vide ; le meublé et la location saisonnière ont d'autres règles (à traiter à part ou à exclure).

## 5. Livre des recettes du micro-entrepreneur : mentions, registre des achats, conservation

- Requêtes visées : « livre des recettes micro entreprise », « livre des recettes auto-entrepreneur », « livre des
  recettes exemple », « registre des achats micro-entrepreneur ».
- Plan : qui doit le tenir ; mentions (et celles des professions libérales) ; registre des achats pour la vente ;
  tenue sur papier ou informatique ; conservation 10 ans ; exemple de lignes.
- Mène à : [Livre recettes-dépenses micro-entreprise](https://qm-engineering.fr/catalogue/micro-entreprise/).
- Source : entreprendre.service-public.gouv.fr/vosdroits/F36018, vérifiée le 21/02/2026 (CGI art. 99 ; LPF L102 B).

## 6. Dégât des eaux : déclarer le sinistre dans les délais et monter son dossier

- Requêtes visées : « dégât des eaux que faire », « déclaration dégât des eaux modèle », « constat amiable dégât des
  eaux », « dégât des eaux locataire ou propriétaire ».
- Plan : premiers gestes ; délai de déclaration (5 jours ouvrés, 2 en cas de vol) ; constat amiable ; ne pas réparer
  sans accord ; inventaire et preuves ; expertise ; délais d'indemnisation.
- Mène à : [Dossier sinistre habitation](https://qm-engineering.fr/catalogue/sinistre/).
- Sources :
  - service-public.gouv.fr/particuliers/vosdroits/F1352, vérifiée le 25/07/2025 : déclaration sous 5 jours ouvrés ou
    délai du contrat s'il est plus long ; constat amiable facultatif ; expertise en général au-delà de 1 600 €.
  - legifrance.gouv.fr, Code des assurances article L113-2 (version en vigueur depuis le 01/04/2018) : délai d'au moins
    5 jours ouvrés, 2 jours ouvrés en cas de vol.
  - service-public.gouv.fr/particuliers/vosdroits/F2028, vérifiée le 10/09/2025 (vol).
- À vérifier : la convention IRSI (partage locataire / propriétaire / copropriété) avant d'en parler ; la fiche F1352
  date de 2025 : revérifier à la rédaction.

## 7. Faire son plan de trésorerie prévisionnel sur 12 mois

- Requêtes visées : « plan de trésorerie prévisionnel », « plan de trésorerie exemple », « plan de trésorerie
  mensuel », « plan de trésorerie association ».
- Plan : à quoi il sert ; encaissements et décaissements TTC au mois prévu ; solde du mois et cumulé ; échéances
  (TVA, cotisations, impôts) ; prévu contre réalisé ; scénarios ; que faire face à un creux.
- Mène à : [Trésorerie prévisionnelle 12 mois](https://qm-engineering.fr/catalogue/tresorerie/).
- Source : bpifrance-creation.fr, « Le plan de trésorerie dans un projet de création d'entreprise », publié en février
  2025 (aucun texte de loi : sujet de gestion). Bpifrance propose aussi un modèle Excel gratuit : le citer honnêtement
  et expliquer ce que l'application ajoute (réalisé, scénarios, alerte), sans dénigrer.

## 8. Calculer son TJM de freelance à partir du revenu visé

- Requêtes visées : « calcul tjm freelance », « calcul tjm salaire net », « calcul tjm auto entrepreneur ».
- Plan : jours réellement facturables ; frais ; cotisations selon le statut ; du revenu visé au TJM minimum ; TJM
  conseillé ; exemple chiffré daté ; limites (impôt, SASU/EURL à voir avec un expert-comptable).
- Mène à : [Calculateur de TJM](https://qm-engineering.fr/catalogue/tjm/) et
  [Coût de revient](https://qm-engineering.fr/catalogue/cout-revient/).
- Source : entreprendre.service-public.gouv.fr/vosdroits/F36232, vérifiée le 01/01/2026 : taux micro-entrepreneur
  2026 : prestations BIC 21,2 %, libéral non réglementé BNC 25,6 %, BNC Cipav 23,2 %, vente 12,3 % (CSS D613-4).
- À vérifier : les pages Urssaf n'ont pas pu être ouvertes (erreur 503) ; confirmer les taux sur urssaf.fr à la
  rédaction.

## Ordre conseillé

1, 2, 3 d'abord (requêtes larges, concurrence surtout faite de modèles gratuits, templates déjà en vente, publics
professionnels), puis 4, 6, 7 ; 5 et 8 ensuite (concurrence forte de simulateurs gratuits d'acteurs installés).
Publier par lots de 2 ou 3 pour limiter les déploiements.
