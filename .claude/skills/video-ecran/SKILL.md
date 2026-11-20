---
name: video-ecran
description: Réaliser une vidéo qui ressemble à un enregistrement d'écran d'une personne qui utilise une application (template QME ou autre), sur téléphone (iPhone) ou sur ordinateur (Windows), sur un sujet donné par Quentin, avec un texte de voix minuté pour ElevenLabs, puis caler la voix reçue sur les actions, la traiter façon micro de téléphone et ajouter une ambiance (bureau, ville). À utiliser quand Quentin demande « une vidéo capture d'écran », « fais comme si c'était moi / une influenceuse qui utilise… », « une story d'utilisation », « un script voix pour ElevenLabs », ou de mixer une voix ElevenLabs sur une vidéo.
---

# Vidéo « écran » : capture d'écran d'une utilisation, avec voix

Format né le 20/11/2026 (story Nexora de Quentin, puis influenceuse sur le Sankey du Budget du foyer). Contrairement à
`video-demo` (habillage QME, caméra, musique), la vidéo doit passer pour un **vrai enregistrement d'écran** : aucun
habillage, aucun curseur sur téléphone, voix à la première personne.

Outils (moteur vidéo unique, `docs/videos/`) :
- `moteur.mjs` + `ecran.mjs` : le scénario déclare `config.ecran` (`'telephone'` ou `'ordinateur'`), le moteur filme
  l'application réelle dans un cadre (iPhone : barre d'état, îlot, clavier AZERTY iOS ; Windows : navigateur générique,
  barre des tâches, horloge, curseur flèche / main), image par image en temps virtuel.
- `voix.mjs texte` : texte minuté et texte ElevenLabs (balises `<break>`) à partir des repères du tournage.
- `voix.mjs mixer` : calage de la voix reçue, micro, ambiance, -14 LUFS, contrôle de la piste audio.
- `ambiances/` : `bureau` (fichier), `ville` (synthétisée), `aucune`.

Explique chaque étape à Quentin en français, sans flatterie ; dis ce qui a été vérifié et ce qui ne l'a pas été.

## Règles

1. **Application réelle, données fictives.** Le mode démo de l'application tourne vraiment ; les gestes sont réels ;
   tout montant dit par la voix est **contrôlé dans l'application** dans `preparer` (le scénario lève une erreur
   sinon). Jamais de vraie donnée personnelle, de client ou de compte réel. Pour Nexora (outil personnel de Quentin) :
   uniquement la démo (`VITE_DEMO=1`), et le scénario reste hors du dépôt public si Quentin ne demande pas le contraire.
2. **Réalisme assumé, sans mensonge sur les résultats.** On peut masquer ce qui trahit la démo à l'écran (bandeau,
   pastille « démo ») avec `css` et `remplacer`, et renommer une donnée de démo gênante (ex. « Alcool » → « Étirements »).
   On ne fait pas dire à la voix des résultats inventés présentés comme réels (« j'ai économisé 800 € grâce à… »).
3. **Tiers (influenceur, partenaire).** Une vidéo publiée par un tiers pour un produit QME est de la publicité : elle
   doit porter la mention « Publicité » ou « Collaboration commerciale » (loi n° 2023-451 du 9 juin 2023 sur
   l'influence commerciale). Le rappeler à Quentin. Jamais la voix clonée d'une personne réelle sans son accord écrit :
   voix de la bibliothèque ElevenLabs, ou celle de la personne avec son accord.
4. **Ton de la voix** : première personne, oral, phrases courtes ; nombres en lettres (« mille cent soixante-quatorze
   euros ») ; 3 à 6 phrases pour 15 à 25 s ; chaque phrase commente ce qui se passe à l'écran à ce moment.
5. **Son** : jamais muette une fois livrée (voix, et ambiance si demandée). Avant tout dépôt : piste audio vérifiée
   (`voix.mjs` le fait) ; < 2,9 Mo pour le connecteur Google Drive (au-delà, l'envoi est refusé : le dire à Quentin).

## 1. Cadrer le sujet

Demander ou déduire : application et écran, **support** (téléphone ou ordinateur Windows ; story Instagram → téléphone
par défaut, sauf demande), qui parle (Quentin, une influenceuse…), 3 ou 4 gestes au plus, la phrase de fin.
Pour un template QME : il doit être en vente (`node docs/videos/catalogue.mjs`).

## 2. Explorer l'application

Template : `npm run dev:templates`, puis `http://localhost:8888/templates/<slug>/?demo`. Autre application : son
serveur de démo (Nexora : `VITE_DEMO=1 npx vite --port 5173` dans `apps/nexora-future-optim`, version téléphone
`/iphone/`). Explorer avec Playwright **à la taille du cadre** (téléphone 393 × 852, `isMobile` ; ordinateur
1536 × 732 utiles) : captures, sélecteurs stables (`data-*`, textes), valeurs, conteneur qui défile.

## 3. Écrire le scénario

`docs/videos/scenarios/ecran-<nnn>-<slug>-<sujet>.mjs`. Modèle : `ecran-001-budget-ou-part-argent.mjs`.

```js
export const config = {
  nom, produit, type: 'écran', titre,
  ecran: 'ordinateur',                 // ou 'telephone'
  app: '/templates/budget/?demo',      // chemin d'un template (serveur lancé par le moteur) ou URL complète
  heure: '2026-11-20T21:14:00+01:00',  // horloge affichée (barre d'état, barre des tâches) ; facultatif
  barre, onglet,                       // ordinateur : adresse et titre d'onglet affichés
  defilement: '.ix-ecran',             // conteneur qui défile, si ce n'est pas la page
  clavierVariable: '--clavier',        // téléphone : variable CSS de l'app pour le clavier (sinon l'iframe raccourcit)
  css: '…',                            // CSS injecté (zones sûres, masquer un bandeau de démo)
  remplacer: [{ url: '**/app.js*', de: '…', vers: '…' }], // texte remplacé dans un fichier servi (dépôt inchangé)
  ambiance: 'bureau', micro: 'telephone', affiche: 6, tailleMaxMo: 2.9,
};
export const voix = [{ a: '<repère>', decalage: 0.3, texte: '…' }, …];  // une ligne par phrase
export async function preparer(v) { /* hors caméra : attendre, fermerDialogues, contrôler les montants */ }
export async function jouer(v) { v.repere('debut'); … }
```

API `v` : `repere(nom)`, `pause(ms)`, `attendre(sel)`, `lire(sel)`, `toucher(sel, { fx, fy, ms })` (doigt sur
téléphone ; sur ordinateur, le curseur y va puis clique), `survoler(sel, { ms })` (ordinateur), `glisser(dy, ms)`,
`glisserVers(sel, { marge, gestes })`, `focus(sel)` puis `clavier(true)` et `taper(texte)` (téléphone),
`fermerDialogues()`, `app` (cadre Playwright de l'application). Poser un **repère avant chaque geste commenté** par
la voix ; laisser 3,5 à 5 s entre deux repères commentés (une phrase).

## 4. Tourner et vérifier

```
node docs/videos/moteur.mjs docs/videos/scenarios/<scenario>.mjs [--brouillon]
```

Sortie : `docs/videos/sortie/<nom>.mp4` (sans son ; téléphone 886 × 1920, ordinateur 1920 × 1080), `<nom>.json`
(repères, durée), couverture. Vérifier une planche (`ffmpeg -i … -vf "fps=1,scale=…,tile=…"`) et des images pleine
taille aux repères : rien qui trahit la démo, pas de fenêtre de premier lancement, infobulles et saisies visibles,
aucun saut de mise en page (clavier, feuille). Pièges connus : guide « Comment ça marche » ouvert après le chargement
(`fermerDialogues` attend 1,5 s) ; transitions de l'app à resynchroniser sur le clavier (`css`) ; espaces
insécables fines (U+202F) dans les montants lus.

## 5. Texte de voix pour ElevenLabs

```
node docs/videos/voix.mjs texte docs/videos/scenarios/<scenario>.mjs
```

Donne le tableau minuté (début, repère, phrase, durée estimée, fenêtre ; ⚠ si trop long) et le texte à coller dans
ElevenLabs (`sortie/<nom>-voix.md`). Le transmettre tel quel à Quentin, avec la vidéo sans son. Réglages conseillés :
stabilité 30 à 40 %, une pause entre chaque phrase.

## 6. Mixer la voix reçue

```
node docs/videos/voix.mjs mixer docs/videos/scenarios/<scenario>.mjs <voix.mp3> [--ambiance bureau|ville|aucune|<fichier>] [--micro telephone|propre] [--ecart 6]
```

La voix est découpée à ses silences, regroupée en autant de morceaux que de phrases, et chaque morceau démarre sur son
repère (ElevenLabs ne respecte pas toutes les pauses : c'est prévu). Le tableau de calage s'affiche : l'associer aux
phrases n'est vérifié que par les durées, le dire à Quentin. Micro `telephone` : bande 200 Hz – 7 kHz, présence,
compression, légère saturation, réflexions. Ambiance `--ecart` LU sous la voix (6 : 10 à 14 dB sous la voix dans
les blancs), baissée quand la voix parle ; `ville` place ses klaxons dans les blancs. Sortie `sortie/<nom>-voix.mp4`.

## 7. Livrer

Envoyer la vidéo à Quentin (SendUserFile). Drive seulement s'il le demande (< 2,9 Mo). Ajouter une ligne au journal
`docs/videos/journal.md` (type `écran`). Pas de programmation automatique sur les réseaux sans demande de Quentin.
