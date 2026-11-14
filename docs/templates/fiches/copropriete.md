# T96 · Charges et assemblées générales de copropriété

Slug `copropriete`, préfixe `CPR` (clés locales `qme-cpr-*`, règles `window.CPR`), prix 15 €, permalien Gumroad
prévu `charges-ag-copropriete`, catégorie Gumroad prévue `business-and-money/real-estate` (à confirmer), taille S,
priorité P3, usage `perso`. Origine : proposition validée par Quentin le 14/11/2026 (pack « Propriétaire », PPB).
Fiche rédigée le 14/11/2026 par délégation de Quentin (décisions de cadrage déléguées, pas de validation à
attendre). Catalogue : `data-pour="perso"`, thème `argent` (`--c:var(--jaune)`), comme la gestion locative (T71) et
la capacité d'emprunt (T85). Marques de risque : **daté** (trois repères sourcés et datés, désactivables) et
**juridique** (aucune règle de majorité intégrée, avertissement « outil d'aide » partout). **Confidentiel
vérifié** : démo d'une copropriété fictive (« Résidence Les Tilleuls (copropriété fictive) », syndic « Cabinet
Exemple Gestion (syndic fictif) »), montants fictifs, aucun nom de personne.

## Pour qui

Copropriétaires occupants ou bailleurs (un ou plusieurs lots, éventuellement dans plusieurs immeubles), membres de
conseil syndical. Aujourd'hui : les appels de fonds dans la boîte mail, le décompte annuel survolé, la convocation
lue la veille, les procès-verbaux introuvables à la revente.

## Promesse

Chaque appel payé à temps, chaque vote préparé : les appels de fonds suivis, les charges comprises poste par poste
d'une année à l'autre, la part récupérable sur le locataire, et les assemblées générales de l'ordre du jour aux
travaux votés.

## Décisions de cadrage

- **Une clé, plusieurs copropriétés** : une copropriété par immeuble (nom, syndic, mois de début d'exercice,
  tantièmes généraux de l'immeuble), sélecteur dans la barre ; alertes de toutes les copropriétés.
- **Lots** : nom, type (logement, cave, parking, local, autre), numéro, tantièmes généraux, loué ou non. Quote-part =
  tantièmes des lots / tantièmes de l'immeuble ; sert seulement à **estimer** une part d'un montant global (budget,
  travaux), la clé réelle restant celle du syndic.
- **Appels de fonds** : libellé, date d'exigibilité, exercice, provisions, fonds de travaux, lignes de travaux votés
  (rattachées aux échéances de l'échéancier), autres sommes, payé le. États payé / en retard / proche (15 jours,
  réglable) / à venir. Génération des 4 appels d'un exercice à partir de la quote-part annuelle (ou du budget de
  l'immeuble × tantièmes), au 1er jour de chaque trimestre de l'exercice, centimes exacts (écart d'arrondi sur le
  dernier appel).
- **Décompte annuel** : quote-part par poste (15 postes types, montants signés pour un avoir), date d'approbation
  des comptes, date de règlement de la régularisation. **Régularisation** = charges réelles − provisions appelées
  (positif : complément à payer ; négatif : trop-versé), présentée comme indicative (le syndic peut imputer d'autres
  sommes).
- **Part récupérable sur le locataire** : pourcentage saisi par poste. Aide : bouton qui **propose** 100 % pour les
  catégories citées par la fiche F947, seulement sur les postes vides ; rien pour le gardien (« sous certaines
  conditions »), l'assurance, les honoraires, les frais administratifs, les contrats et les réparations (à lire sur
  le décompte du syndic). Récapitulatif imprimable des charges par nature.
- **Graphiques** (skill `dataviz`) : répartition d'un exercice en barres horizontales (une série, triée, valeurs et
  parts écrites) ; évolution par exercice en colonnes groupées provisions appelées / charges réelles (deux séries,
  même axe, légende). Palette `#2A78D6` / `#EB6834` validée par `validate_palette.js` (bande, chroma, daltonisme,
  contraste ≥ 3:1). Infobulles au survol, au toucher et au clavier ; tableaux accessibles (poste × années).
- **Assemblées** : date, type (ordinaire, extraordinaire), lieu, convocation reçue, participation (présent,
  représenté, correspondance, à distance, absent), « préparée », procès-verbal reçu, notes ; ordre du jour collé en
  une fois (une résolution par ligne, numéros retirés). **Résolutions** : numéro, intitulé, majorité **saisie**
  (libellés « Article 24 / 25 / 25-1 / 26 / Unanimité / Non précisée », jamais interprétés), montant global avec la
  part estimée, intention ou vote (pour, contre, abstention, pas de vote), résultat (adoptée, rejetée, ajournée,
  retirée). États de l'AG : à préparer (21 jours avant, réglable), préparée, à venir, résultats à noter, tenue.
- **Travaux votés** : nom, AG et résolution d'origine (« Suivre les travaux » depuis une résolution adoptée avec un
  montant), montant voté, quote-part (estimée avec les tantièmes ou saisie), statut, échéancier (dates et montants,
  répartition automatique de la quote-part). Suivi : appelé, payé, reste, échéances appelées ou non.
- **Documents à conserver** : nom, type (12 types), date, exercice, **où il est rangé** (aucun fichier), note ;
  types sans document signalés. Aucune durée de conservation imposée.
- **Alertes** : appel en retard ou proche, échéance de travaux proche sans appel noté, AG à préparer, résultats d'AG
  à noter (120 jours), régularisation d'un exercice approuvé non réglée.
- **Exports** : appels, charges (poste × années, part récupérable, provisions) et résolutions en CSV (« ; »,
  virgule décimale, BOM), copie JSON, impressions (récapitulatif des charges d'un exercice, fiche d'AG avec cases de
  vote).

## Repères sourcés (aucune règle non sourcée)

Repris de service-public.gouv.fr, consultés le 14/11/2026, dans `donnees.js` (`regles`, `sources`), désactivables
(Réglages) et présentés comme indicatifs :

- fiche **F20586** « Budget prévisionnel d'une copropriété » (vérifiée le 4 août 2026) : provisions égales au quart
  du budget voté, dues le 1er jour de chaque trimestre ou de la période fixée par l'AG → génération des 4 appels ;
- fiche **F34026** « Fonds de travaux mis en place dans les copropriétés » (vérifiée le 9 juin 2026) : cotisation
  annuelle d'au moins 5 % du budget prévisionnel (et 2,5 % des travaux du plan pluriannuel adopté), immeubles
  d'habitation de plus de 10 ans → rapport fonds de travaux / provisions affiché, signalé sous 5 % (sur la
  quote-part, indicatif) ;
- fiche **F947** « Charges à payer par le locataire » (vérifiée le 15 avril 2025) : liste des charges récupérables
  fixée par le décret n° 87-713 du 26 août 1987, régularisation au moins annuelle, décompte par nature → aide à la
  saisie de la part récupérable.

**Pas de règle de majorité**, pas de délai de convocation ni de contestation, pas de durée de conservation : tout
ce qui relève de la loi du 10 juillet 1965 est laissé au règlement de copropriété, à la convocation et au
procès-verbal. Avertissement affiché : outil d'aide, le règlement de copropriété et le syndic font foi, ne remplace
pas un conseil juridique.

## Base intégrée (`donnees.js`)

15 postes de charges types (avec catégorie citée ou non et aide), 5 types de lots, 2 types d'AG, 6 libellés de
majorité, 5 modes de participation, 12 types de documents, 3 repères et 3 sources datées, réglages par défaut,
2 couleurs de graphique validées, 4 conseils de démarrage.

## Écrans

Connexion (clé ou code, démo) · premier lancement (copropriété, syndic, exercice, tantièmes, premier lot, loué) ·
Tableau de bord (à payer, appelé, charges réelles et régularisation, récupérable, à traiter, prochaine AG, lots) ·
Appels de fonds (par exercice, à payer et payés) · Charges (décompte, régularisation, répartition, évolution,
repères) · AG et travaux (assemblées à venir et tenues, travaux votés) et fiche d'AG (ordre du jour, vote, résultat)
· Documents · Réglages (alertes, repères, copropriétés, exports, sauvegarde, compte, « Sur téléphone », sources).

## Tests

`outils/templates/copropriete.test.mjs` (14 tests) : base et sources, montants et normalisation, références
orphelines, tantièmes et quote-part, appels trimestriels (exercice civil et décalé, centimes), état d'un appel,
travaux (appelé, payé, échéances à appeler), exercice (régularisation, récupérable, fonds de travaux), répartition,
évolution et tableau poste × années, aide part récupérable, assemblées, alertes et tri, documents, CSV. Parcours
Playwright (1280 px, iPhone 13 et Pixel 7 en Chromium) : code faux et clé d'un autre template refusés, premier
lancement, génération des appels, paiement, décompte, aide récupérable, AG avec ordre du jour collé, vote,
synchronisation vers un second contexte, rechargement, démo, fenêtre « Comme une application », largeur ≤ 412 px.

## Risques et limites

- Fiches service-public.gouv.fr à revérifier à la mise à jour annuelle de la base.
- Les montants sont la quote-part saisie : la régularisation affichée peut différer du décompte du syndic (autres
  imputations, mutations de lot en cours d'année).
- La part estimée par tantièmes généraux ignore les charges spéciales (bâtiment, ascenseur) : affichée « environ ».
- Pas de gestion du conseil syndical à plusieurs comptes (une clé partagée suffit), pas d'envoi au syndic.
- Version anglaise en attente.
