# T93 · Assemblée générale et vie statutaire

Slug `assemblee-generale`, préfixe `AGS` (clés locales `qme-ags-*`, règles `window.AGS`), prix 19 €, permalien
Gumroad prévu `assemblee-generale-association`, catégorie Gumroad prévue `business-and-money` (à confirmer à la
création de la fiche), taille S, priorité P2, usage `pro`. Origine : proposition validée par Quentin le 14/11/2026
(pack « Associations et clubs », PAS, où T93 est prévu). Fiche rédigée le 14/11/2026 par délégation de Quentin
(décisions de cadrage déléguées, pas de validation à attendre). Catalogue : `data-pour="pro"`, thème
`associations-formation-et-evenements` (`--c:var(--rouge)`), à côté des inscriptions associatives (T42) et de la
gestion de compétition (T52). Marques de risque : **RGPD** (données des membres : minimisées, supprimables),
**juridique** (aucune règle légale intégrée : délais, quorums, pouvoirs, majorités et durées de mandat sont saisis
d'après les statuts ; avertissement « les statuts font foi, ne remplace pas un conseil juridique »).
**Confidentiel vérifié** : démo entièrement fictive (association « Les Amis du Val Fleuri », commune inventée
Valbrune, code postal fictif 99100, e-mails en `@asso.example`, domaine réservé).

## Pour qui

- Bureaux d'associations loi 1901 (président·e, secrétaire, trésorier·e bénévoles) : une AG par an, quelques
  conseils et réunions de bureau, des mandats à renouveler, des statuts que personne ne relit avant l'AG.
- Clubs sportifs et culturels, amicales, comités des fêtes, associations de parents, petites structures (conseil
  syndical bénévole, coopérative de quartier) qui ont des statuts avec quorum et majorités.
- Prescripteurs : maisons des associations, fédérations sportives, points d'appui à la vie associative.

## Promesse

« Une AG en règle, sans stress. » Le rétroplanning daté depuis le délai de convocation de tes statuts, la
convocation prête à copier, la feuille de présence et les pouvoirs, le quorum et les votes calculés avec tes
règles, le procès-verbal imprimé, et les mandats du bureau suivis jusqu'au renouvellement.

## Décisions de cadrage

- **Aucune règle légale intégrée.** Délais, quorums et majorités relèvent des statuts de chaque association : l'outil ne
  propose que des **valeurs de départ marquées « à vérifier »** (exemple, pas norme) et un bandeau tant qu'une
  instance n'est pas confirmée « conforme à nos statuts ». Un champ « référence » (« Statuts, article 11 »)
  accompagne chaque règle. Aucune donnée datée à maintenir.
- **Quatre instances** : AG ordinaire, AG extraordinaire, conseil d'administration, bureau. Pour chacune :
  délai de convocation (jours), quorum (aucun, fraction « au moins » ou « plus de », ou nombre de membres),
  pouvoirs comptés ou non dans le quorum, quorum en seconde convocation (identique, aucun, autre), pouvoirs
  admis ou non avec plafond par mandataire (0 = sans plafond), majorité par défaut, durée des mandats (conseil
  et bureau).
- **Majorités nommées**, choisies point par point : base (suffrages exprimés pour + contre, votes abstentions
  comprises, présents et représentés, tous les inscrits), fraction, « au moins » ou « plus de ». Quatre de départ
  (simple, absolue des présents, deux tiers, unanimité), définitions mathématiques modifiables, ajout libre.
  **Calculs en entiers** (aucune virgule flottante) : seuil requis affiché (« il faut 9 voix pour »).
- **Électeurs** : AG = membres votants à jour de cotisation (case) ; conseil = mandats en cours au conseil ou
  au bureau à la date de la réunion ; bureau = mandats de bureau. La feuille de présence est figée au premier
  pointage (actualisable), ce qui garde l'archive juste quand les membres changent.
- **Pouvoirs** : valables s'ils sont admis, confiés à un membre présent autre que soi, dans la limite du plafond,
  dans l'ordre de la liste ; les autres sont refusés avec leur raison. Avant la réunion, un pouvoir reçu dont le
  mandataire n'est pas encore pointé présent est « en attente », pas « refusé ».
- **Une voix par membre** (pas de vote pondéré) ; un décompte supérieur aux voix possibles est signalé ; un
  quorum non atteint rend les votes sans valeur et propose la seconde convocation (ordre du jour recopié).
- **Rétroplanning** : 12 étapes types pour une AG, 4 pour un conseil ou un bureau, datées depuis la date limite
  de convocation (date de la réunion moins le délai saisi) ou la date de la réunion ; suggestions d'organisation,
  modifiables et complétables réunion par réunion. Envoi de la convocation daté : « dans le délai » ou
  « tardive ».
- **Trames originales** (rédaction QME, 14/11/2026) : convocation d'AG formelle et conviviale, convocation de
  conseil ou de bureau, pouvoir (procuration), procès-verbal d'AG et compte rendu de conseil. Remplies avec
  l'ordre du jour, la date, le lieu, les règles (quorum, pouvoirs, cotisation) et, pour le PV, la présence, le
  quorum, les résolutions, les votes et les notes par point. Texte de convocation modifiable à la main.
- **Mandats** : début + durée (ou échéance précise), états en cours / à renouveler (alerte réglable, 90 jours par
  défaut) / échu / terminé ; renouvellement en un geste (clôture à la date choisie, nouveau mandat même
  fonction) ; mandats à renouveler listés dans la préparation de l'AG avec ajout d'un point d'élection.
- **Archive** : réunions groupées par année, filtre « PV à signer », export CSV des réunions avec quorum et votes.
- **Aucune automatisation d'envoi** (règle de Quentin du 13/11/2026) : texte à copier, e-mails des convoqués à
  copier en copie cachée, impression (convocation et pouvoir, feuille de présence, PV).

## Écrans

1. **Aperçu** : prochaine réunion, votants à jour, mandats à renouveler, étapes en retard ; alertes (règles à
   vérifier, convocation à envoyer, PV à signer) ; « À faire » (étapes en retard et proches de toutes les
   réunions) ; mandats ; chiffres des membres.
2. **Réunions** : à venir, PV à signer, années de l'archive. Fiche d'une réunion en cinq parties :
   Préparation (date limite, rétroplanning, mandats à renouveler, votants et quorum), Convocation (ordre du jour
   ordonnable, points types, texte de convocation et pouvoir, e-mails, date d'envoi), Présence (jauge du quorum,
   P / R / E / A par membre, mandataire, pouvoirs refusés), Votes (pour, contre, abstentions, majorité, résultat
   expliqué), Procès-verbal (séance, notes par point, PV généré, impression, « signé le »).
3. **Membres** : catégorie, voix délibérative, cotisation (case), e-mail facultatif, filtres, recherche,
   import d'une liste collée, « nouvel exercice » (cotisations décochées), copie des e-mails.
4. **Mandats** : bureau, conseil, historique ; renouveler, terminer.
5. **Statuts** : règles des quatre instances et majorités.

Réglages : association (nom, ville, siège, signataire, qualité), alertes, exports CSV (membres, mandats, archive),
copie JSON et restauration, compte, « Sur téléphone », données personnelles, à propos.

## Règles métier (`regles.js`, testées dans `outils/templates/assemblee-generale.test.mjs`)

Normalisation tolérante (fractions réduites, liens orphelins retirés, majorités inconnues remplacées) ; quorum
requis (fraction au moins / plus de, nombre, aucun, seconde convocation) ; électeurs par instance et par date ;
émargement (statuts conservés, lignes saisies gardées) ; pouvoirs (plafond, absent, sans mandataire, soi-même,
non admis) ; résultat des votes (quatre bases, deux comparaisons, quorum non atteint, décompte invalide) ;
textes des règles ; mandats (échéance, 29 février, états, renouvellement, à renouveler à l'AG) ; rétroplanning et
état de la convocation ; trames remplies ; liste collée et import sans doublon ; cotisations remises à zéro ;
suppression d'un membre ; archive par année ; indicateurs ; CSV (point-virgule, BOM).

## Données personnelles (RGPD)

L'association est responsable de traitement ; l'outil ne demande qu'un nom, une catégorie et, facultativement,
un e-mail et une date d'entrée. Aucune donnée sensible, aucun téléphone ni adresse postale. Suppression d'un
membre : fiche, mandats et lignes des réunions à venir ; les procès-verbaux passés gardent le nom consigné
(archives de l'association). Exports pour répondre à une demande d'accès.

## Démo (fictive, relative à aujourd'hui)

« Les Amis du Val Fleuri » : 24 membres (3 membres d'honneur non votants, 4 cotisations à régulariser), bureau
et conseil (présidence à renouveler à l'AG, vice-présidence échue, un ancien mandat terminé), AG ordinaire dans
26 jours (préparation en cours, une étape en retard, deux pouvoirs reçus), bureau dans 6 jours (convoqué),
conseil il y a 40 jours (PV à signer), AG ordinaire de l'an dernier (archivée, votes), AG extraordinaire sans
quorum puis tenue en seconde convocation (statuts modifiés aux deux tiers).

## Risques et points à suivre

- Statuts atypiques (vote pondéré, collèges, vote électronique, quorum calculé sur une autre base) : non couverts,
  signalés par l'avertissement ; la majorité « sur tous les inscrits » et le quorum en nombre couvrent une partie.
- Les trames sont des modèles : vérifier les mentions que les statuts imposent (signataires, registre).
- Usage à plusieurs (bureau) : même clé, conflit 409 commun ; pas de rôles.

## Statut

**Prêt** le 14/11/2026, « Mise en vente prochaine » : démo libre, page `catalogue/assemblee-generale/`,
communication dans `docs/templates/communication/assemblee-generale/`. Restent la fiche Gumroad et la clé de licence
(Quentin), l'ajout au pack PAS (`netlify/lib/packs.mjs`, pages régénérées), la carte anglaise et les plannings
LinkedIn et Instagram.
