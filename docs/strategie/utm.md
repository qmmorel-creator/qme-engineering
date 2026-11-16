# Convention de liens tracés (UTM) · 15/11/2026

But : savoir quel canal amène les visites (GoatCounter) et les ventes (Gumroad affiche `utm_source`,
`utm_medium` et `utm_campaign` par vente). Aujourd'hui 100 % des vues Gumroad sont « direct ».

## Règle

`?utm_source=<réseau>&utm_medium=<emplacement>&utm_campaign=<sujet>`, tout en minuscules, sans accent ni espace.

| Paramètre | Valeurs |
|---|---|
| `utm_source` | `linkedin`, `instagram`, `youtube`, `gmail` (affiliation, prospection), `affilie-<nom>` |
| `utm_medium` | `bio`, `commentaire` (premier commentaire LinkedIn), `description` (description d'un Short YouTube), `story`, `post`, `email` |
| `utm_campaign` | identifiant du post (`li-85`, `ig-60`, `tt-01`) ou du thème (`argent`, `revision`, `freelance`, `noel`) |

Exemples :
- Bio Instagram : `https://qm-engineering.fr/templates/?utm_source=instagram&utm_medium=bio`
- Premier commentaire LinkedIn LI-85 : `https://qmengineering.gumroad.com/l/crm-freelance?utm_source=linkedin&utm_medium=commentaire&utm_campaign=li-85`
- Description d'un Short YouTube : `https://qm-engineering.fr/templates/?utm_source=youtube&utm_medium=description&utm_campaign=yt-01`

## Application

| Où | Qui | État |
|---|---|---|
| Bio Instagram (lien 1 « Templates et démos ») | Quentin, dans l'app | à faire |
| Liens d'achat des premiers commentaires LinkedIn (Docs « final ») | Claude, au fil des prochains posts | à faire, par lot |
| Liens des brouillons d'affiliation | Claude, au moment d'ajouter le lien de pack | à faire |
| Page LinkedIn QME (bouton du site) | Quentin | à faire |
| YouTube Shorts (description) | skill video-demo | à appliquer (TikTok abandonné le 16/11) |

Un lien vers le site garde ses paramètres dans GoatCounter ; pour qu'une vente Gumroad soit attribuée, le lien
doit pointer directement vers Gumroad (les paramètres ne passent pas du site à Gumroad, non vérifié : à tester).
