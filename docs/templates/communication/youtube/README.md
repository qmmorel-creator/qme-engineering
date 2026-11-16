# Chaîne YouTube QME · Shorts

Décision de Quentin du 16/11/2026 : **TikTok est abandonné** ; tout ce qui est vidéo verticale (vidéos démo
LinkedIn 17:30, reels Instagram) part aussi en **YouTube Shorts**, le même jour. Non publié (dossier `docs/`).

Chaîne : `https://www.youtube.com/channel/UCZTdaekWbJG8_RekBbaecvA`.

## Planning et publication

- Sheet **« Planning publications YouTube »** `1LYdQZabr6B4Z_Ctu0ayYF1tOOtMIPMiqeXa9LTfNTtE`, onglet `Planning`,
  dossier Drive « QME – Publications YouTube » `1RcBIyxd_HvpHp0r-o97Qx1iRqFujtwpX`.
- Colonnes A–O : ID (`YT-nn`) · Date · Heure (Europe/Paris) · Statut · Thème · Titre YouTube (100 caractères
  au plus) · Description (texte complet, rien d'autre à lire) · Fichier vidéo (contrôle du nom) · ID Drive
  vidéo · Instagram associé · LinkedIn associé · Publié le · URL publication · Remarque · Format (`Short`).
- La vidéo est **la même que celle d'Instagram** (colonne P du planning Instagram, premier ID) : rien à copier.
- Créneaux : **12:00** pour les vidéos démo (Instagram 08:30, LinkedIn 17:30) ; **20:00** pour les reels du soir
  (Instagram 18:30). Deux Shorts le même jour sont normaux.
- Statuts : `Prêt` tant que la routine Instinct YouTube n'est pas confirmée (`docs/videos/journal.md`), puis
  `Programmé` → `Publié` / `Erreur` (écrits par Instinct) ; `Annulé`.
- Liens des descriptions : `utm_source=youtube&utm_medium=description&utm_campaign=yt-nn`. Ils ne sont
  **pas cliquables** dans un Short (seulement dans la description complète sur ordinateur) : le lien utile est
  celui de la chaîne (bannière, section Liens).
- État au 16/11/2026 : YT-01 à YT-37 créés au statut `Prêt` à partir des 37 reels Instagram (vidéos démo 001 à
  011 et reels IG-27 à IG-148). Les trois déjà publiés sur Instagram (IG-139, IG-37, IG-27) sont placés les
  17, 18 et 19/11.
- Routine : `PROMPT-INSTINCT-YOUTUBE.md` (à transmettre par Quentin).

## Bannière

`png/banniere-youtube.png` (2048 × 1152, < 6 Mo), source `banniere.html`, rendu
`node docs/templates/communication/youtube/rendre.mjs`. Logo, accroche et adresse sont dans la **zone sûre
1235 × 338** (seule partie visible sur téléphone) ; les formes Bauhaus autour n'apparaissent que sur ordinateur
et télévision. Contrôle : `png/banniere-youtube-zone-sure.png` (cadre magenta = zone sûre, ne pas importer).

## Description de la chaîne (texte à coller, 760 caractères)

```
Des templates prêts à l'emploi et des outils sur mesure, conçus par Quentin Morel, ingénieur et chef de projet.

Chaque Short montre un vrai geste dans un template : un retard qui décale un planning, un devis recalculé au centime, un mois de budget qui tient ou non. Données fictives, aucun écran truqué.

Les templates couvrent le travail (planning Gantt, comptes rendus, tâches, planning d'équipe), les indépendants (devis, TJM, trésorerie, CRM, impayés) et la maison (budget, abonnements, budget à deux, révisions). Chacun a une démo libre, sans inscription, et s'achète une fois.

Votre métier a ses règles ? Je construis aussi l'outil sur mesure.

Démos : qm-engineering.fr/templates
Sur mesure : qm-engineering.fr/sur-mesure
Contact : qm-engineering.fr/contact
```

## Profil (Personnalisation de la chaîne → Profil)

| Champ | Valeur |
|---|---|
| Nom | `QME · Templates et sur mesure` (même nom qu'Instagram) |
| Identifiant | `@qmengineering` si disponible (même que sur Instagram) |
| Photo | symbole QME (déjà en place) |
| Bannière | `png/banniere-youtube.png` |
| Liens (dans cet ordre ; le premier s'affiche sur la bannière) | 1. « Templates et démos » `https://qm-engineering.fr/templates/?utm_source=youtube&utm_medium=bio` · 2. « Outil sur mesure » `https://qm-engineering.fr/sur-mesure/?utm_source=youtube&utm_medium=bio` · 3. « Boutique » `https://qmengineering.gumroad.com` · 4. « Site » `https://qm-engineering.fr` |
| Adresse e-mail | adresse professionnelle (déjà en place) |

## Onglet Accueil (Personnalisation de la chaîne → Onglet « Accueil »)

1. **Vidéo principale pour les visiteurs non abonnés** (« Ajouter » en haut de l'onglet, si YouTube le propose) :
   le premier Short publié qui montre le mieux le principe, YT-01 « Un retard décale-t-il la fin du chantier ? ».
   *(À vérifier dans le Studio : YouTube peut refuser un Short comme bande-annonce ; dans ce cas, laisser vide.)*
2. **Sections, dans cet ordre** :
   1. **Vidéos courtes** (en tête : c'est le contenu de la chaîne) ;
   2. **Playlists par public**, une section « Playlist unique » chacune, à créer quand elles contiennent au
      moins 3 Shorts : « Projets et équipe » (Gantt, planning d'équipe, réserves, comptes rendus, tâches),
      « Indépendants » (devis, TJM, trésorerie, CRM, impayés, micro-entreprise, prospection),
      « Argent du quotidien » (budget, abonnements, budget à deux, pack), « Études » (révisions) ;
   3. **Vidéos** (formats longs, s'il y en a un jour).
3. **Retirer** « Diffusions en direct terminées », « Posts », « Collaborations » et « Pour vous » : vides ou
   inutiles à ce stade (une chaîne de moins de 40 Shorts n'a pas assez de contenu pour « Pour vous »).
4. La vidéo de 0:33 déjà en ligne (section « Vidéos (1) ») : la garder seulement si elle concerne QME ; sinon la
   passer en « Non répertoriée ».

## Réglages utiles (YouTube Studio → Paramètres)

- **Chaîne → Infos générales** : pays France ; mots-clés `templates, planning, budget, freelance, gestion de projet, outils sur mesure`.
- **Valeurs par défaut des mises en ligne** : langue français ; catégorie « Science et technologie » ; public
  « Non, elle n'est pas conçue pour les enfants » ; licence YouTube standard.
- **Image de marque → Filigrane** : symbole QME (150 × 150), « Fin de la vidéo » (visible sur les vidéos longues seulement).

## Risque connu

La musique des vidéos démo (« Corporate », litesaturation, Pixabay) peut déclencher une revendication Content ID
sur YouTube. Ce n'est pas bloquant (la vidéo reste en ligne, la monétisation n'est pas visée). Si YouTube bloque
une vidéo, Instinct passe la ligne en `Erreur` avec la raison en Remarque.
