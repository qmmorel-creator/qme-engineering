# Quentin Morel Engineering

Site promotionnel de Quentin Morel Engineering (QME).

## Structure

- `index.html` : page principale (français)
- `en/index.html` : version anglaise (`/en/`), mêmes sections ; drapeaux français / anglais en tête de
  page pour passer de l'une à l'autre, balises `hreflang` sur les deux pages
- `assets/QME-brochure-en.pdf`, `assets/QME-references-en.pdf`, `assets/qme-presentation-en.mp4` (et son
  affiche) : plaquette, références et vidéo en anglais. Sources et scripts de génération dans le dépôt
  Nexora, `docs/qme/en/`
- `assets/site.css` : styles
- `assets/site.js` : interactions du menu et soumission du formulaire (Netlify Forms)
- `assets/*.png` : identité visuelle QME
- `netlify.toml` : configuration de publication Netlify

## Développement local

Le site est statique (pas d'étape de compilation). Pour tester la page seule, ouvrir `index.html`
directement ou lancer un serveur HTTP local. L'envoi du formulaire ne fonctionne qu'une fois
le site publié sur Netlify (Netlify Forms).

## Formulaire

Le formulaire de contact (pages française et anglaise) utilise **Netlify Forms** : formulaire
`contact`, déclaré par `data-netlify="true"` dans le HTML et envoyé en `fetch` (encodage
`application/x-www-form-urlencoded`) vers la racine du site par `assets/site.js`. Le champ caché
`company_website` sert de pot de miel (`netlify-honeypot`) ; le champ caché `langue` indique la page
d'origine (`fr` ou `en`).

Sur la page anglaise, les libellés sont traduits mais les valeurs envoyées (`need`) restent en français.

Prérequis côté Netlify (site `qme-engineering`) :

- détection des formulaires activée (Site configuration → Forms → Enable form detection) ;
- notification par email de chaque demande vers `quentin.morel@qm-engineering.fr`
  (Forms → Form notifications).

Les demandes sont aussi consultables dans l'interface Netlify (Forms → `contact`). Un lien `mailto:`
reste disponible en repli si l'envoi échoue.

L'ancien relais signé vers Nexora (`netlify/functions/contact.mts`) a été retiré : l'endpoint
d'ingestion côté Nexora a été supprimé le 21/10/2026 (nexora#1223).

## Domaines

- Domaine principal : **https://qm-engineering.fr** (adresse de contact `quentin.morel@qm-engineering.fr`).
- `www.qm-engineering.fr`, `qm-engineering.cloud`, `www.qm-engineering.cloud` et l'ancien sous-domaine
  Netlify du site redirigent en 301 vers le domaine principal, chemin conservé (règles `[[redirects]]`
  de `netlify.toml`, seul endroit où l'ancien sous-domaine reste écrit, pour pouvoir le rediriger).
- Côté Netlify (site `qme-engineering`) : `qm-engineering.fr` en domaine principal, les trois autres
  en alias. Côté registrar : faire pointer les deux domaines vers Netlify (serveurs de noms Netlify DNS,
  ou enregistrements `A`/`CNAME` indiqués par Netlify), sans toucher aux enregistrements `MX` de la
  messagerie de `qm-engineering.fr`.

## Déploiement

Le dépôt est destiné au site web QME uniquement. La publication Netlify utilise la racine du dépôt
pour les fichiers statiques.
Aucune fusion ni publication sans feu vert explicite de Quentin (déploiements Netlify facturés).
