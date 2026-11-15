# Reels prioritaires IG-131 à IG-133 (15/11/2026)

Trois Reels verticaux 1080 × 1920, 30 i/s, muets, sans visage ni voix, même chaîne que les Reels IG-37 à IG-61 :
page HTML animée (`IG-13x.html`, animations CSS pilotées par `window.placer(ms)`) rendue par `../video.mjs`
(Playwright + ffmpeg). Captures des démos `?demo` servies en local (`npm run dev:templates`), prises avec
Playwright (viewport 430 px, dpr 2, bandeau démo et barre d'onglets masqués) : `captures/IG-131-*.webp`,
`captures/IG-132-*.webp`, `captures/IG-133-*.webp`. Toutes les données sont fictives et marquées comme telles.

Rendu, depuis la racine du dépôt (copie temporaire de `IG-13x.html` sous le nom final, supprimée ensuite) :

```
node docs/templates/communication/instagram/video.mjs production/IG-131-abonnements.html 26.5 2500
node docs/templates/communication/instagram/video.mjs production/IG-132-impayes.html 28.6 2500
node docs/templates/communication/instagram/video.mjs production/IG-133-pack-argent-du-quotidien.html 25 2500
```

| Reel | Vidéo | Couverture | Durée |
|---|---|---|---|
| IG-131 · Suivi des abonnements (9 €) | `png/IG-131-abonnements.mp4` | `png/IG-131-abonnements-couverture.png` | 26,5 s |
| IG-132 · Relance des impayés (19 €) | `png/IG-132-impayes.mp4` | `png/IG-132-impayes-couverture.png` | 28,6 s |
| IG-133 · Pack Argent du quotidien (43 €) | `png/IG-133-pack-argent-du-quotidien.mp4` | `png/IG-133-pack-argent-du-quotidien-couverture.png` | 25 s |

Vérifiés le 15/11/2026 : 1080 × 1920, H.264 sans piste audio, images extraites à 0,8 s, 9,5 s, 20,5 s et
24,5 s relues (accroche lisible dès la première seconde, texte dans les zones sûres, rien de coupé).
La vidéo ne dit pas « lien en bio » (compte TikTok sans lien) : elle renvoie à qm-engineering.fr.

Vérifications de fond :
- IG-131 : exemple de 7 abonnements génériques (aucune marque), 88,34 € par mois = 1 060,08 € par an.
  Captures : tuiles « Par mois / Par an » et « À décider avant le … » de la démo (`templates/abonnements/`).
- IG-132 : paliers par défaut de `templates/impayes/donnees.js` (J+3, J+15, J+30, J+45, paramétrables) ;
  calcul vérifié avec `regles.js` (`penalites`, `indemnite`) : 2 400 € TTC, 45 jours, BCE 2,40 % du
  2nd semestre 2026 + 10 points = 12,40 %, 36,69 € de pénalités + 40 € d'indemnité (entre professionnels).
  Le Reel rappelle que le taux est paramétrable et daté (à mettre à jour chaque semestre). À republier
  après le 01/01/2027 : vérifier que le taux du 1er semestre 2027 est saisi dans l'application.
- IG-133 : composition et prix de `packs/argent-du-quotidien/` (54 € séparément, 43 € en pack, −20 %,
  une seule clé).

---

## IG-131 · Suivi des abonnements

**Texte alternatif** : Vidéo animée sans son : un exemple fictif de 7 abonnements sans marque, 88 € par mois soit 1 060 € par an, puis des captures de l'application Suivi des abonnements (totaux au mois et à l'année, dates « à décider avant le … »), données fictives, et la fin « Suivi des abonnements, 9 €, démo gratuite sur qm-engineering.fr ».

**Légende Instagram**

Vos abonnements, c'est combien… par an ?

88 € par mois, ça passe. Sur un an, le même exemple fictif fait 1 060 €.

Le Suivi des abonnements :
▪ ramène chaque abonnement à l'année, votre part seulement ;
▪ montre les prochains prélèvements ;
▪ affiche « à décider avant le … » pour chaque fin d'essai, fin d'engagement ou renouvellement, préavis compris.

Aucune connexion à votre banque. Achat unique, 9 €.

Démo gratuite avec un foyer fictif : lien en bio.

#Budget #BudgetFamilial #Organisation #Abonnements #Économies

**Légende TikTok**

Vos abonnements, c'est combien… par an ? 88 € par mois dans cet exemple fictif, 1 060 € sur l'année. Le Suivi des abonnements fait le compte et vous dit quoi décider avant d'être engagé. Démo gratuite sur qm-engineering.fr

#budget #abonnements #economies #argent #organisation

---

## IG-132 · Relance des impayés

**Texte alternatif** : Vidéo animée sans son : une facture fictive de 2 400 € en retard de 45 jours, les quatre paliers de relance par défaut (rappel courtois, relance ferme, mise en demeure, dernier avis), le calcul de 36,69 € de pénalités et 40 € d'indemnité entre professionnels, puis des captures de l'application Relance des impayés, données fictives, et la fin « Relance des impayés, 19 €, démo gratuite sur qm-engineering.fr ».

**Légende Instagram**

Facture en retard de 45 jours : vous relancez comment ?

Quatre paliers par défaut : rappel courtois à J+3, relance ferme à J+15, mise en demeure à J+30, dernier avis à J+45. Délais et messages paramétrables.

Entre professionnels, sur 2 400 € TTC (exemple fictif) : 36,69 € de pénalités pour 45 jours au taux BCE + 10 points, plus 40 € d'indemnité forfaitaire. Le taux est daté et se met à jour chaque semestre dans l'application.

Le message du bon palier se copie, rien n'est envoyé à votre place. Outil d'aide, pas un conseil juridique. Achat unique, 19 €.

Démo gratuite avec une entreprise fictive : lien en bio.

#Freelance #Indépendant #Facturation #PME #MicroEntreprise

**Légende TikTok**

Facture en retard de 45 jours : vous relancez comment ? Les quatre paliers, les pénalités et les 40 € d'indemnité entre pros, calculés par la Relance des impayés. Outil d'aide, pas un conseil juridique. Démo gratuite sur qm-engineering.fr

#freelance #facturation #entrepreneur #independant #pme

---

## IG-133 · Pack Argent du quotidien

**Texte alternatif** : Vidéo animée sans son : quatre captures d'applications avec des données fictives (Budget du foyer, Budget commun, Suivi des abonnements, Tableau de bord annuel et roue de vie), puis le prix du pack, 43 € au lieu de 54 € séparément, et la fin « Pack Argent du quotidien, 43 €, qm-engineering.fr ».

**Légende Instagram**

Votre argent du quotidien en 4 outils.

▪ Budget du foyer : ce qui reste dans vos enveloppes ce mois-ci.
▪ Budget commun : qui doit combien à qui.
▪ Suivi des abonnements : le coût réel, au mois et à l'année.
▪ Tableau de bord annuel et roue de vie : votre année, domaine par domaine.

Séparément, 54 €. En pack, 43 € (−20 %), avec une seule clé pour les 4. Achat unique.

Les 4 démos sont gratuites, avec des données fictives : lien en bio.

#Budget #BudgetFamilial #Organisation #Couple #Maison

**Légende TikTok**

Budget du foyer, budget à deux, abonnements, bilan de l'année : 4 outils, 43 € en pack au lieu de 54 €. Les démos sont gratuites sur qm-engineering.fr

#budget #argent #couple #organisation #finances
