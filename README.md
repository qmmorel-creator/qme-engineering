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
- `assets/site.js` : interactions du menu et envoi du formulaire (Netlify Forms)
- `assets/*.png` : identité visuelle QME
- `netlify.toml` : configuration de publication Netlify

## Développement local

Le site est statique (pas d'étape de compilation). Pour tester la page seule, ouvrir `index.html`
directement ou lancer un serveur HTTP local. L'envoi du formulaire ne fonctionne que sur un
déploiement Netlify (aperçu de PR ou production).

## Formulaire

Le formulaire de contact est un formulaire **Netlify Forms** nommé `contact`, déclaré à l'identique
sur les deux pages (`data-netlify="true"`), avec un champ caché `langue` (`fr` ou `en`) et un objet de
mail (`subject`). `assets/site.js` l'envoie en AJAX (corps URL-encodé, `POST /`). Les demandes sont
stockées dans Netlify (site `qme-engineering`, menu Forms), filtrées par Akismet, et le champ masqué
`company_website` sert de pot de miel (`netlify-honeypot`). Un lien `mailto:` reste disponible en
repli si l'envoi échoue.

Sur la page anglaise, les libellés sont traduits mais les valeurs du champ `need` restent en
français, comme sur la page française.

Prérequis côté Netlify : détection des formulaires activée (Forms), et une notification par mail
(Forms > Submission notifications > Add notification) pour être prévenu de chaque demande.

Historique : jusqu'au 28/10/2026, le formulaire passait par une fonction relais signée vers un endpoint
Nexora (`/api/nexora/qme-intake`, nexora#279). Cet endpoint a été retiré le 21/10/2026 (nexora#1223) et
les variables du relais n'avaient jamais été posées : le formulaire n'a jamais fonctionné avant Netlify
Forms.

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
pour les fichiers statiques ; aucune fonction Netlify.
Aucune fusion ni publication sans feu vert explicite de Quentin (déploiements Netlify facturés).
