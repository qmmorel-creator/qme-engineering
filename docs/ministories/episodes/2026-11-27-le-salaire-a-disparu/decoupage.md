# « Le salaire a disparu ! » · découpage, continuité, plans audio et sous-titres

Storyboard : `storyboard.png` (14 vignettes tirées de la page d'animation). Source unique des temps : `sources/timeline.json`.
Style : motion design vectoriel, poses tenues à 12 poses/s (stop-motion de la charte MiniStories), coupes franches.

## Découpage plan par plan

| Plan | Temps | Action | Cadrage / mouvement | Intention | Son | Transition |
|---|---|---|---|---|---|---|
| S1 | 0,00–1,30 | Notification « Virement reçu · Salaire +2 100 € » tombe ; pièces qui jaillissent ; Carreau court de joie (soulagé, pose « court »). | Plan large fixe, notification en rebond. | Accroche : euphorie démesurée. | ka-ching, v01 | coupe |
| S2a | 1,30–2,30 | Bouteille de champagne, bouchon qui part, confettis. | Plan large fixe. | Célébration disproportionnée. | pop, v02 | coupe franche |
| S2b | 2,30–4,10 | Même place : petite bouteille « eau pétillante ». Carreau neutre, regard vide. | Identique (même cadre = gag par substitution). | Retour au réel. | pschitt, v03 | coupe |
| S3 | 4,10–9,10 | Carreau assis sur un tas de billets ; compteur SOLDE en haut. Un monstre à la fois entre, mord, repart : Loyer (maison bleue), Factures (triangle rouge), Courses (caddie jaune), puis rafale d'Abonnements (cercles noirs ▶). Le tas fond, le compteur passe au rouge (640 €). | Plan fixe, secousses du compteur à chaque morsure. | Escalade, rythme qui s'accélère. | whoosh, crocs, zap, blips, v04–v07 | coupe |
| S4 | 9,10–10,45 | Calendrier : LUN J+0, MAR J+1, MER J+2, JEU J+3 (pages en coupes franches). | Plan centré sur fond jaune. | Ellipse. | tic-tac, v08 | coupe |
| S5 | 10,45–12,70 | Téléphone « Solde du compte 3,00 € » ; Carreau inquiet puis rouge (panique), tremblement, fond qui clignote (3 Hz, faible contraste). | Léger zoom d'entrée, tremblement. | Gag central. | chute, alarme, v09 | coupe |
| S6 | 12,70–19,10 | Téléphone avec la **vraie capture** de Mon Budget ; quatre enveloppes (Loyer, Factures, Courses, Abonnements) se posent autour ; cadres rouges sur Revenus (prévu) et Dépenses (réel) ; carte « trajet de l'argent » (vraie capture). Carreau « montre ». | Apparition en rebond, plans fixes. | Solution intégrée, bénéfices attestés. | whoosh, poses, v10–v11 | coupe |
| S7 | 19,10–22,70 | Carte « LE PLAN » (barres qui se remplissent) ; les monstres font sagement la queue ; Carreau soulagé puis fier (22,2). | Plan large fixe. | Payoff. | v12–v13, ding | coupe |
| S8 | 22,70–26,70 | Carton final officiel 9:16, exact. | Plein cadre. | Signature. | musique seule, fondu | fin |

## Fiche de continuité

- **Carreau** : uniquement `carreau({expression, pose})` du module officiel (corps 200 px dans un repère 320 × 380,
  jaune `#F5B400`, rouge `#D9302A` en panique, étiquette « A1 », traits 9 px). Mise à l'échelle uniforme seulement.
  Correspondance : joie → `soulage`, blasé → `neutre`, choc → `inquiet` (avec #REF!), panique → `panique`, fier → `fier`.
- **Monstres-dépenses** (accessoires, pas des mascottes) : forme et couleur fixes. Loyer = maison bleue `#23528B`,
  Factures = triangle rouge à éclair jaune, Courses = caddie jaune, Abonnements = cercle noir ▶ à point rouge.
  Même dessin en S3 (taille 0,85–0,95) et S7 (taille 0,48–0,55).
- **Billets** : rectangle crème `#FBEBC2`, contour 7 px, « € » cerclé. **Pièces** : cercle jaune `#FFBE00`, « € ».
- **Décors** : fond crème `#F1EEE6`, sol noir à y = 1300, trois variantes de formes Bauhaus (décor 0, 1, 2).
- **Texte à l'écran** : Outfit 700–800 (police du site, OFL), noir `#141414`. Montants au format français.

## Plan audio

| Piste | Source | Traitement | Niveau |
|---|---|---|---|
| Voix | edge-tts, `fr-FR-HenriNeural`, 13 répliques (`audio/voix/`) | coupe des silences, normalisation par réplique, compresseur 3:1, `loudnorm` | -15,4 LUFS, -2,0 dBTP |
| Musique | « funny bouncy cartoon mischief » (alex-morgan), dossier Drive « QME - Musiques MiniStories » | volume 0,22, ducking `sidechaincompress` par la voix (ratio 10, relâche 350 ms), remontée ×1,6 sur le carton, fondu de sortie 1,6 s | sous la voix |
| Bruitages | synthétisés par `sources/audio.py` (`audio/bruitages/`) | ×0,55 | ponctuels |
| Mix | `audio/mix-final.wav` | `alimiter` 0,78 | -16,0 LUFS intégré, crête -3,4 dBFS |

## Plan de sous-titrage

13 sous-titres, un par réplique, de début − 0,05 s à fin + 0,12 s (fins coupées à 22,70 : rien sur le carton).
Deux lignes au plus (coupes forcées v07, v10, v11, v13). Outfit 800, 56 px, texte `#141414` sur cartouche `#FBEBC2`
arrondie, centré, haut du bloc à y = 1350 (zone sûre : au-dessus de la légende et des boutons des réseaux).
Fichier : `qme_ministory_le-salaire-a-disparu.srt` ; version incrustée dans le MP4.
