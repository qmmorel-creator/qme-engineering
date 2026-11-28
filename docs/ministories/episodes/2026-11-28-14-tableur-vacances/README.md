# Mini-story QME n° 14 · « Le tableur des vacances » · format v2 (28/11/2026)

Produit : **Planificateur de voyage** (`catalogue/voyage/`, lien vérifié 200 le 28/11/2026). Texte dit et accroche :
`script.md`. Texte ElevenLabs : `docs/ministories/elevenlabs/qme_ministory_14-tableur-vacances_elevenlabs.txt`
(flow `tKArjT4Vzqid8GdfXLvu`, 197 crédits, une génération, voix « Caroline - Warm, Sweet and Soft », eleven_v4).

## Fichiers
- `rendu/qme_ministory_14-tableur-vacances_final.mp4` (8 269 507 o, AAC 192k), `_drive.mp4` (2 867 223 o, 2 passes
  1050k + AAC 112k), `_tiktok.mp4` (2 496 828 o, 16,1 s, 1,5 s de carton, fondu audio), `_couverture.png` (image à 0,5 s,
  accroche visible), `_tiktok-legende.txt`.
- Drive « QME - Vidéos Ministories » : vidéo `1zLh0dSa6M6c7KPmnaRiDYaRe2sLv2AsK`, TikTok `1WAipsjfel-Kto-L-Zdzn1BrH1NwOFoOS`,
  légende TikTok `1Fwzb1O8PLp6BwFsVrRySDKaz-Gp8wtYx` ; couverture `16BThidVqEBzQxfQCmLV5Fe_rzbxWD8E-` (dossier couvertures) ;
  Doc légende `1NoUAdHAkW6kVY-jM2wsmuWDFwicKbNSIYCdW8PlNfi8` (un premier Doc à 1re ligne non interrogative, créé puis mis à
  la corbeille le même jour : `1fbBjr5QT9XkpVzn69UyoY7IjfcgcKsoKgZkEhEuzYT0`).
- Non programmée au planning à la production (réserve).

## Provenance
Voix ElevenLabs (ci-dessus) ; musique `alex-morgan-funny-bouncy-cartoon-mischief-578469.mp3` (Drive « QME - Musiques
MiniStories », libre de droits confirmé par Quentin le 27/11/2026) ; bruitages synthétisés (`sources/audio.py`) ; capture
`assets/templates-voyage-comptes.webp` du dépôt (démo, voyageurs fictifs) ; police Outfit (OFL) ; carton officiel (Drive
« QME - Assets MiniStories ») ; Grillon : module `carreau.js` (copie sans `export`), aucun accessoire.

## Contrôle qualité

| # | Contrôle | Méthode | Résultat |
|---|---|---|---|
| 1 | Décodage intégral | `ffmpeg -v error -f null` | OK sur final, drive, tiktok |
| 2 | 1080 × 1920, 30 i/s, H.264 High, yuv420p | ffprobe | OK (trois fichiers) |
| 3 | AAC 48 kHz stéréo ; durée audio = vidéo | ffprobe | OK, 18,600 s (TikTok 16,100 s) |
| 4 | Sonie, crête ≤ -1,5 dB | ebur128 | mix -16,2 LUFS, crête vraie -2,2 dBTP ; voix -15,7 LUFS |
| 5 | Voix présente, dominante | corrélation (décalage 239 éch.) + rapport voix/fond | +9,0 à +26,8 dB selon la réplique (v05 la plus basse, ding sur le début) |
| 6 | Intelligibilité | Vosk small-fr-0.22 sur le final | toutes les répliques au bon moment ; écarts du modèle : « je t'ai avancé » → « j'étais avancer », « nœud » → « ne », « pas un de plus » → « pas en plus » |
| 7 | Visionnage complet | planche toutes les 0,5 s | examinée ; aperçu corrigé avant rendu (en-tête de capture tronqué, étiquettes sur la tête de Grillon, Grillon trop à droite, ticket sous la flèche) |
| 8 | Continuité Grillon | planches | une seule mascotte, module officiel, expressions de la bible ; amis = disques sans visage |
| 9 | Zones sûres, lisibilité mobile | planches | capture recadrée et agrandie ×2 (texte ≈ 34 px) ; rien d'important à droite de 930 en bas |
| 10 | Sous-titres | planches | une réplique par sous-titre, 2 lignes au plus, accents et apostrophes typographiques |
| 11 | Carton exact, 4 s | planches | 14,6–18,6 s, sans surimpression (TikTok 1,5 s) |
| 12 | Faits produit conformes | fiche (FAQ) | qui a payé / pour qui, plus petit nombre de virements ; montants = démo fictive |
| 13 | Écoute humaine sur téléphone | Quentin | à faire |

Format v2 : 18,6 s ; accroche écrite dès la 1re image (« POV : 4 amis. 10 jours de vacances. Zéro compte fait. »,
9 mots) ; 1re réplique = tension ; 39 mots ; produit à 10,35 s (dernier tiers de l'histoire), une réplique de 6 mots ;
chute « Et la glace ? » qui boucle sur la 2e réplique ; aucune pub au milieu.
