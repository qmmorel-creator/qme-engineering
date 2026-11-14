# T39 · Kit références et plaquette

Slug `references-plaquette`, préfixe `KRF` (clés locales `qme-krf-*`, règles `window.KRF`), prix prévu 19 €,
permalien Gumroad prévu `kit-references-plaquette`, catégorie Gumroad prévue `business-and-money` (à confirmer),
taille S, priorité P3. Origine : backlog de Quentin n° 14 (ligne T39 de `IDEES.md` : fiches projets, filtres,
page imprimable type plaquette ; modèles de fiches projets et de mise en page ; références réelles non reprises,
exemples fictifs). Format : **application web** (socle commun). Fiche rédigée le 14/11/2026 par délégation de
Quentin (décisions de cadrage déléguées, pas de validation à attendre). Catalogue : `data-pour="pro"`, thème
`clients-et-prospection` (`--c:var(--encre)`), pack « Freelance : trouver ses clients » (PFC).

**Confidentiel vérifié** : l'inspiration vient des outils internes de références et de plaquette de QME
(mécanique seulement : fiche projet, filtre, mise en page imprimable). Aucune référence réelle de QME, d'un
employeur ou d'un client n'est reprise : la démo présente un indépendant fictif (« Atelier Exemple ») et des
clients fictifs ou anonymisés. Aucune marque tierce.

## Pour qui

Indépendants, consultants, petites agences (communication, web, design), formateurs, architectes et
décorateurs, artisans du bâtiment, photographes et vidéastes : ceux qui doivent **montrer ce qu'ils ont déjà
fait** pour convaincre un prospect, mais dont les références dorment dans des mails, des dossiers de photos et
un vieux PDF refait à chaque appel d'offres. Le besoin revient à chaque proposition : « envoyez-moi deux ou
trois références proches de mon projet ».

Distinct du **CRM freelance** (T28) et du **Pipeline de prospection** (T35) : ici, pas de suivi de prospects ni
de relances ; la matière première est le **projet terminé**. Distinct des **Propositions commerciales** (T72,
idée) : pas de chiffrage ni de planning, seulement la preuve par les réalisations.

## Promesse

Tes réalisations rangées une fois pour toutes, et la bonne sélection de références, mise en page, pour
chaque prospect.

## Base intégrée (ce qui fait la valeur)

1. **9 modèles de fiches par métier** (conseil, développement et web, design et graphisme, communication et
   rédaction, formation, artisanat du bâtiment, architecture et décoration, photo et vidéo, généraliste) :
   types de mission proposés, mots-clés suggérés, résultats chiffrés typiques à mesurer (libellés, sans valeur),
   questions pour rédiger le contexte, la mission et le résultat.
2. **Trame « contexte, mission, résultat »** avec questions d'aide, verbes d'action et formulations
   d'anonymisation (« une PME industrielle de 40 salariés », « un réseau de 12 agences »).
3. **Bibliothèque de 12 secteurs** et **tailles de client** pour décrire un client sans le nommer.
4. **Contrôle de la fiche** : note de complétude (contexte, mission, résultat chiffré, durée, mots-clés,
   visuel, témoignage) et **alertes de confidentialité** : client nommé sans accord noté, témoignage sans
   accord de citation, adresse e-mail ou numéro de téléphone dans un texte, montant affiché.
5. **Message de demande de témoignage** à copier (5 questions courtes), et rappel : demander l'accord écrit
   du client avant de citer son nom, son logo ou ses propos.
6. **Trois mises en page imprimables** (A4, impression ou PDF par le navigateur) : « Plaquette » (couverture,
   présentation, chiffres clés, références deux par page, coordonnées), « Fiches » (une référence par page),
   « Liste » (tableau récapitulatif sur une page).

## Écrans

- **Connexion** (socle) et **premier lancement** en 2 étapes : ton activité (nom affiché, métier → modèle de
  fiches) puis une première référence guidée, ou « commencer vide ».
- **Références** : liste filtrable (recherche, mots-clés, secteur, type de mission, année, « avec résultat
  chiffré », « avec témoignage », « à compléter »), cartes avec visuel, client affiché, résultats chiffrés,
  mots-clés, note de complétude ; mise en avant (étoile). Fiche détaillée (aperçu tel qu'il sera imprimé),
  modification en fenêtre, duplication, suppression avec « Annuler ».
- **Sélections** : une sélection par prospect (nom du prospect, secteur et mots-clés de son projet, message
  d'introduction, mise en page, options d'affichage). Références **suggérées** par pertinence (secteur, mots-
  clés, type de mission, récence, résultat chiffré, témoignage), avec les raisons ; ordre réglable.
- **Plaquette** : aperçu A4 de la sélection choisie (ou de toutes les références mises en avant), bouton
  « Imprimer ou enregistrer en PDF » ; version texte à copier pour un e-mail.
- **Profil** : nom affiché, métier, accroche, présentation courte, chiffres clés (saisis), zone d'intervention,
  coordonnées (texte libre), couleur d'accent parmi les couleurs de la charte.
- **Réglages** (socle) : export JSON, CSV des références, import, déconnexion, « Sur téléphone ».

## Règles métier (fonctions pures, `regles.js`)

- `completude(projet)` : score sur 100 et liste des manques, pondérés (résultat chiffré et mission pèsent le
  plus).
- `alertes(projet)` : confidentialité (client nommé sans accord, témoignage sans accord, coordonnées
  personnelles détectées dans un texte, montant affiché).
- `clientAffiche(projet, options)` : nom du client seulement s'il est nommé avec accord et que la sélection
  l'autorise, sinon description anonymisée (secteur, taille, région), jamais vide.
- `filtrer(projets, filtre)`, `motsCles(E)` (fréquences), comparaisons sans accents ni casse.
- `pertinence(projet, criteres)` et `suggerer(E, criteres, n)` : score et raisons.
- `pagesPlaquette(selection, modele)` : découpage en pages A4 (2 références par page en « Plaquette », 1 en
  « Fiches », 14 lignes en « Liste »).
- `texteReference(projet, options)` : version texte pour un e-mail ; `versCsv(E)`.
- Visuels : image réduite dans le navigateur (JPEG, 960 px de large au plus), refusée au-delà de 160 Ko ;
  12 visuels au plus, pour rester sous la limite de stockage d'un template (900 Ko). Sans visuel : couverture
  géométrique générée (couleur et forme tirées du type de mission).

## Données datées, sources

Aucune donnée réglementaire ou datée intégrée. Les chiffres (résultats, chiffres clés) sont **saisis** par
l'utilisateur. La règle pratique « accord écrit du client avant de le citer » est présentée comme une bonne
pratique, pas comme une règle juridique ; droit à l'image et droits d'auteur sur les photos : rappel de n'utiliser
que des visuels dont on détient les droits (pas de citation d'article de loi, donc rien à dater).

## Risques

- Taille des visuels (stockage JSON des templates) : compression et plafond, message clair.
- Fausse impression d'« obligation légale » : formulations de bonne pratique uniquement.
- Impression : rendu dépendant du navigateur (marges) ; CSS `@page` A4 et test d'impression en PDF.
