# Quentin Morel Engineering

Site promotionnel de Quentin Morel Engineering (QME).

## Structure

- `index.html` : page principale
- `assets/site.css` : styles
- `assets/site.js` : interactions du menu et du formulaire
- `assets/*.png` : identité visuelle QME
- `netlify.toml` : configuration de publication Netlify

## Développement local

Le site est statique. Ouvrir `index.html` directement ou lancer un serveur HTTP local.

## Formulaire

Le formulaire prépare actuellement un courriel côté navigateur. L’intégration sécurisée avec Nexora est suivie dans l’issue #1. Aucun secret Nexora ne doit être ajouté au code client.

## Déploiement

Le dépôt est destiné au site web QME uniquement. La publication Netlify utilise la racine du dépôt sans étape de compilation.
