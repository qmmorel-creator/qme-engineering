# Signature e-mail QME

Variante **C · Bandeau** validée par Quentin le 21/11/2026 : nom, « Outils sur mesure · templates », logo Q Bauhaus
(avatar Instagram), filet noir / rouge / jaune / bleu, `qm-engineering.fr` en texte, icônes Instagram, LinkedIn
(page entreprise), TikTok, YouTube (adresse de la chaîne).

- **Source unique** : `netlify/lib/signature.mjs` (`SIGNATURE_HTML`). Images : `assets/signature/*.png`, publiques,
  à 3 fois la taille affichée (logo 48 px, icônes 20 px), chacune avec un texte de remplacement.
- **E-mails de l'essai** : la version HTML remplace la signature texte par ce bloc (`habiller`, `netlify/lib/essais.mjs`) ;
  la version texte brut garde la signature texte.
- **Gmail** (signature de la boîte, réglée par Quentin) : ouvrir `signature-gmail.html` dans un navigateur sur ordinateur,
  sélectionner la signature, copier, coller dans Gmail → Paramètres → Général → Signature, pour l'adresse
  `quentin.morel@qm-engineering.fr`. Les images ne s'affichent qu'une fois `assets/signature/` publié sur le site.
- Les messageries qui bloquent les images affichent le texte de remplacement ; le nom et le site restent lisibles.

## Brouillons préparés par l'assistant (règle du 22/11/2026)

Tout e-mail que l'assistant rédige pour Quentin (prospection, réponse à un prospect, affiliation, partenariat, relance,
client) porte cette signature graphique dans sa version HTML, après la formule de politesse et avant la mention
d'opposition. La version texte brut garde la signature texte (« Quentin Morel / QME · Quentin Morel Engineering /
adresse · site »).

- **Contrainte de l'outil Gmail** : `create_draft` supprime toute image distante (`<img src="https://…">`) du
  `htmlBody`, et Gmail n'ajoute aucune signature de boîte (`includeSignature` sans effet : aucune signature réglée
  pour `quentin.morel@qm-engineering.fr`, test du 22/11/2026). Les six images partent donc en **pièces jointes
  intégrées** (`inline: true`), appelées par `cid:att0` à `cid:att5`.
- **Générer le bloc** : `node docs/templates/communication/signature/brouillon-gmail.mjs --json` donne `html` (la
  signature, à coller dans le `htmlBody`) et `attachments` (les six images, par référence `sha256:…:chemin`, à passer
  telles quelles à `create_draft`). D'autres pièces jointes éventuelles se placent après ces six.
- **Modifier un brouillon** : `update_draft` refuse les pièces jointes par référence. Pour changer un brouillon signé,
  en créer un nouveau (`create_draft`, mêmes destinataires, `replyToMessageId` pour rester dans le fil) puis supprimer
  l'ancien.
- **Vérifier** avant de rendre la main : `get_draft` (RAW) montre six images `inline` et six `cid:` dans le HTML.

## Copie à Floriane (décision du 27/11/2026)

Tout brouillon ou envoi **personnalisé** pour Quentin met `floriane.jolliot@qm-engineering.fr` en **Cc** (pas en Cci). Jamais dans les mails de masse (campagnes, file OVH, vagues d'affiliation). Ne plus utiliser
son adresse Gmail personnelle.
