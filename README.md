# Quentin Morel Engineering

Site promotionnel de Quentin Morel Engineering (QME).

## Structure

- `index.html` : page principale
- `assets/site.css` : styles
- `assets/site.js` : interactions du menu et soumission du formulaire (fetch vers `/api/contact`)
- `assets/*.png` : identité visuelle QME
- `netlify/functions/contact.mts` : fonction Netlify (BFF) qui relaie le formulaire vers Nexora
- `netlify.toml` : configuration de publication Netlify
- `.env.example` : squelette des variables d'environnement Netlify (aucune valeur réelle)

## Développement local

Le site est statique (pas d'étape de compilation). Pour tester la page seule, ouvrir `index.html`
directement ou lancer un serveur HTTP local. Pour tester le formulaire de bout en bout (fonction
Netlify comprise), utiliser `netlify dev` avec les variables de `.env.example` renseignées
localement.

## Formulaire

Le formulaire envoie les données à la fonction Netlify `netlify/functions/contact.mts`, qui signe
la requête (HMAC-SHA256, anti-rejeu, honeypot) et la relaie vers l'endpoint d'ingestion prospect de
Nexora — voir [nexora#279](https://github.com/qmmorel-creator/nexora/issues/279) et le contrat complet
dans [`docs/qme-intake/CONTRAT.md`](https://github.com/qmmorel-creator/nexora/blob/main/docs/qme-intake/CONTRAT.md)
du dépôt Nexora. Le navigateur n'appelle jamais Nexora directement et ne reçoit jamais le secret de
signature. Un lien `mailto:` reste disponible en repli si l'envoi échoue.

Toute la logique métier (validation stricte, idempotence, création de tâche) reste côté Nexora :
ce dépôt ne contient que le relais signé, sans accès direct à Firestore ni au MCP.

## Variables d'environnement (Netlify)

À configurer sur le site Netlify `qme-engineering`, jamais commitées :

| Variable | Rôle |
|---|---|
| `QME_INTAKE_SIGNING_KEY` | Secret HMAC, même valeur que côté `nexora-project` |
| `NEXORA_INTAKE_URL` | URL de l'endpoint Nexora (`https://nexora-project.org/api/nexora/qme-intake`) |

## Déploiement

Le dépôt est destiné au site web QME uniquement. La publication Netlify utilise la racine du dépôt
pour les fichiers statiques, avec la fonction `netlify/functions/contact.mts` publiée en parallèle.
Aucune fusion ni publication sans feu vert explicite de Quentin (déploiements Netlify facturés).
