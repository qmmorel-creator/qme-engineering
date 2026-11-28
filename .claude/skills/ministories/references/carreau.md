# Grillon, mascotte QME : bible pour les mini-stories

Source de vérité : `docs/templates/communication/formats-test/mascotte/carreau.js` (dessin) et `fiche-carreau.png`
(fiche du 24/11/2026, **validée par Quentin le 27/11/2026**). Ne jamais le redessiner : toujours appeler `carreau()`.

- **Qui** : une cellule de tableur « A1 » échappée de son tableur. A vu 41 onglets, trois versions « final » et un
  #REF! qui ne partait jamais ; aide maintenant les autres à en sortir. Nom : « se tenir à carreau ». On l'appelle
  aussi Grillon. Pronom utilisé par la fiche : il.
- **Caractère** : nerveux devant un tableur, précis et soulagé dans une vraie application ; humour pince-sans-rire,
  jamais moqueur envers l'utilisateur.
- **Rôle dans une histoire** : il vit le problème (panique, s'emmêle), puis montre la solution du bras.
- **Il ne parle jamais** : pas de voix ; au plus une bulle de 8 mots. La voix des mini-stories est un narrateur hors
  champ. Il n'est ni Quentin ni son porte-parole, ne dit pas « je » au nom de QME.
- **Dessin** : carré 200 × 200 à contour 9 px, ombre pleine décalée de 10 px, étiquette noire « A1 », membres en
  traits droits, mains rondes, pieds rectangulaires. Corps jaune `#F5B400` ; rouge `#D9302A` en panique ; bleu ou papier
  possibles pour varier les fonds.
- **5 expressions** : `neutre` (écoute), `inquiet` (un #REF! apparaît), `panique` (il vire au rouge), `soulage` (le
  calcul tombe juste), `fier` (il montre le résultat). **3 poses** : `debout`, `court`, `montre`.
- **Animation** : mise à l'échelle uniforme, rotation légère, sauts, tremblement en panique, poses tenues (12/s). Pas
  de déformation des membres, pas de nouvelle expression inventée.
- **Jamais** : plus d'une mascotte à l'écran, ressemblance avec une mascotte ou marque existante, marque de tableur
  nommée, moquerie de la personne.

Correspondance utilisée par `mascotte()` dans les épisodes : joie → `soulage`, blasé → `neutre`, choc → `inquiet`,
panique → `panique`, fier → `fier` ; bras levés ou sur la tête → pose `court`, montrer → pose `montre`.

## Accessoires temporaires validés par Quentin

Posés PAR-DESSUS `carreau()` sans jamais modifier le module (accessoire dans le repère 320 × 380, `style="overflow:visible"`
sur le `<svg>` si un élément dépasse), propres à un épisode, sans masquer yeux, bouche ni étiquette « A1 » :
- **Course de nuit** (27/11/2026) : dossard blanc à bandeau bleu (texte choisi par Quentin, ex. « SAINTÉLYON » n° 36) et
  frontale (bandeau bleu, boîtier, faisceau large). Source : `docs/ministories/carreau-chasuble-source.html` et la fonction
  `course()` de l'épisode `2026-11-27-06b-saintelyon` (frontale agrandie). Fond de nuit bleu `#1B2A4A`, jamais noir.
- **Blouse et stéthoscope** (27/11/2026) : fonction `blouse()` de l'épisode `2026-11-27-21-partiels-medecine`.

Tout nouvel accessoire : montrer à Quentin une image de Grillon équipé (plusieurs expressions) avant la vidéo, ou le signaler
comme non validé dans le compte rendu.
