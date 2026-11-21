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
