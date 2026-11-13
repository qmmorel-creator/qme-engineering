# Kit de marque Instagram · @qmengineering

Compte Instagram de QME, centré sur les templates. Non publié (dossier `docs/`). Visuels générés par
`gabarits.html` → `node docs/templates/communication/instagram/rendre.mjs` → `png/`. Copie des images
du profil dans Drive : « QME – Publications Instagram / Kit de marque ».

Les points marqués *(à vérifier)* dépendent de l'application Instagram, qui change souvent : les
contrôler dans l'app au moment de les appliquer.

## Profil

| Champ | Valeur |
|---|---|
| Nom d'utilisateur | `@qmengineering` (existant) |
| Nom affiché | `QME · Templates et sur mesure` (29 caractères ; le nom est cherchable dans Instagram) |
| Photo | `png/ig-avatar.png` : symbole Bauhaus du site (même logo que LinkedIn), 1080 × 1080, marge prévue pour la découpe ronde |
| Catégorie | à choisir dans la liste d'Instagram (par exemple « Logiciel » ou « Entreprise de logiciels ») *(à vérifier)* |
| Type de compte | professionnel (Créateur ou Entreprise) |
| Liens | 1. `https://qm-engineering.fr/templates/` (« Templates et démos ») · 2. `https://qm-engineering.fr/sur-mesure/` (« Outil sur mesure ») · 3. `https://qm-engineering.fr/contact/` (« Parler de votre projet ») · 4. `https://qmengineering.gumroad.com` (« Boutique ») |

**Bio** (132 caractères sur 150) :

```
Templates prêts à l'emploi : travail, indépendants, maison.
Et des outils sur mesure pour votre métier.
Démos libres, achat unique ↓
```

**Stories à la une** (couvertures `png/ig-une-*.png`, 1080 × 1920, motif dans le rond central) :
Templates (grille) · Démos (lecture) · Travail (barres) · Indépendants (quart de cercle) · Maison (toit) ·
**Sur mesure** (équerre et quart de cercle, `ig-une-sur-mesure.png`, remplace « Coulisses » depuis le 13/11). Création (faite par Quentin le 13/11/2026) : publier l'image en story →
« À la une » → « Nouveau » → nom → « Modifier la couverture » pour recentrer. Y ajouter ensuite les
vraies stories du thème ; la story-couverture peut alors être retirée, la couverture reste.

## Ligne éditoriale (décision de Quentin, 13/11/2026)

Le compte parle **des templates et du sur mesure, rien d'autre** (pas de coulisses ni de méthode
générale).
- **Templates** (environ 3 posts sur 4) : un carrousel par template, le lendemain de son post LinkedIn.
- **Sur mesure** (environ 1 post par semaine) : un cas concret tiré des posts LinkedIn (rôles,
  atelier, maintenance, intégrations…), données fictives, dernière vue « Votre métier a ses règles ?
  Parlons-en : lien en bio ».
- **Pont entre les deux** dans chaque post template : vue 5 du carrousel et légende rappellent « Besoin
  de plus ? Vos règles, vos utilisateurs, vos outils : je le construis sur mesure. »
- Offre et durées du sur mesure : reprendre uniquement les pages Sur mesure et Méthode du site
  (applications web, sites, no-code, automatisations et IA ; 2 à 3 jours pour une automatisation
  ciblée, 5 à 10 jours pour un outil sur mesure ; échange de 30 minutes au départ).

## Charte

Celle du site, sans exception (`assets/site.css`) :

| Jeton | Valeur | Usage |
|---|---|---|
| papier | `#F0EDE6` | fond clair par défaut |
| surface | `#FBFAF6` | cartes, étiquettes |
| encre | `#141414` | texte, fond sombre, cadres |
| texte-2 | `#45413A` | texte secondaire sur papier |
| rouge | `#D9302A` | formes, accents ; texte blanc dessus |
| jaune | `#F5B400` | surlignage, pastilles ; texte encre dessus, jamais blanc |
| bleu | `#1D4E89` | bandeaux, formes ; texte blanc dessus |

- Police **Outfit** (fichiers dans `assets/fonts/`, licence OFL) : titres 800, interlettrage −0,025em ;
  surtitres 700 en capitales espacées (0,14em).
- Angles droits, cadres pleins, ombres pleines décalées (jamais floues), formes Bauhaus (cercle, carré,
  quart de cercle, triangle). Pas de dégradé, pas d'emoji dans les visuels.
- Marque en pied de visuel : symbole + « QME » (Q encre ou papier, M bleu, E jaune).
- Toute capture d'un template porte la mention **« Données fictives »** (règle de confidentialité de
  `IDEES.md`).

## Formats

| Usage | Taille | Gabarit | Règle |
|---|---|---|---|
| Post et carrousel | 1080 × 1350 (4:5) | `ig-post-annonce`, `ig-car-1/2/3`, `ig-post-coulisses` | la grille du profil recadre en 3:4 : rien d'important à moins de 40 px des bords gauche et droit *(à vérifier)* |
| Story | 1080 × 1920 | `ig-story` | rien d'important dans les 250 px du haut ni les 340 px du bas (barres de l'app ; marge prudente, non officielle) |
| Couverture de reel | 1080 × 1920 | `ig-reel` | texte dans la zone centrale 1080 × 1440 (vue dans la grille) |
| Photo de profil | 1080 × 1080 | `ig-avatar` | affichée en rond |

Carrousel type d'un template (5 vues) : 1. couverture-question (papier) · 2. le problème · 3. ce que fait
le template (bandeau bleu + capture téléphone + 3 points) · 4. une vue clé ou un avant/après · 5. appel à
l'action (fond jaune : « Lien en bio », prix, « Démo libre »). Compteur « n / 5 » en haut à droite.

## Rédaction

- **Vouvoiement** dans les légendes, comme sur le site et LinkedIn. Les titres repris des couvertures des
  templates gardent leur tutoiement (voix de l'application).
- Légende : accroche dans la **première ligne** (le reste est replié dans le fil) ; 3 à 6 phrases courtes ;
  « Démo libre et achat : lien en bio » ; **5 hashtags au plus**. Les liens ne sont pas cliquables dans
  une légende : renvoyer au lien en bio (ou à l'autocollant lien d'une story).
- Sobre, sans superlatifs ni promesses chiffrées non vérifiées (mêmes règles que `linkedin.md`).
- Texte alternatif rempli à chaque publication (Paramètres avancés → Accessibilité), avec « données
  fictives ».

**Jeux de hashtags** (en choisir 3 à 5) :
- Travail : `#GestionDeProjet #Productivité #Organisation #PME #OutilsNumériques`
- Indépendants : `#Freelance #Indépendant #MicroEntreprise #Entrepreneur #TJM`
- Maison : `#BudgetFamilial #Organisation #Budget #Colocation #Maison`
- BTP : `#BTP #Chantier #ConducteurDeTravaux #MaîtriseDŒuvre #Qualité`

## Rythme

Un post template **le lendemain de sa publication LinkedIn**, à 18:30, plus des stories le jour même
(autocollant lien vers la démo). Lancement : 3 posts le même jour pour que la grille ne soit pas vide.
Planning : Google Sheet « Planning publications Instagram » (`reference.md` du skill, § Planning Instagram).
Publication : routine Instinct « Publications Instagram depuis Drive » (`PROMPT-INSTINCT.md`), lignes
« Programmé » uniquement. Motion design : `reel-lancement.html` + `video.mjs` (MP4 1080 × 1920, 30 i/s).
