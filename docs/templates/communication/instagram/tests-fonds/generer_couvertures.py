# Génère couvertures.html : la vue 1 des carrousels du test des fonds (README.md du même dossier).
# Le texte est repris tel quel des sources d'origine ; seuls le fond et la géométrie changent.
# Styles : variantes.css, extrait de variantes.html (règles #test-fond-X renommées .v-X).
# Usage : python3 generer_couvertures.py, puis
#   node docs/templates/communication/instagram/rendre.mjs tests-fonds/couvertures.html
# (les PNG sortent dans instagram/png/ sous le nom IG-nn-<slug>-1.png, celui du planning).
from pathlib import Path
from html import escape

ICI = Path(__file__).parent

# (fichier, variante, sourcil, titre avec [mot] surligné, sous-titre, taille du titre en px)
# A = référence : IG-30 et IG-17 gardent leur couverture actuelle, absentes d'ici.
COUVERTURES = [
    ('IG-29-fiche-arrivee-1', 'B', 'Sur mesure · cas réel', "La fiche d'arrivée qui évite [deux] litiges.", "Un outil d'atelier vélo, dès le dépôt.", 104),
    ('IG-62-abonnements-1', 'C', 'Abonnements', 'Combien vous coûtent vos [abonnements] ?', 'Pas par mois. Par an.', 112),
    ('IG-07-micro-entreprise-1', 'D', 'Indépendants', 'Déclaration URSSAF : [le montant] est prêt.', 'Le livre des recettes, tenu au fil des encaissements.', 104),
    ('IG-151-sans-voiture-1', 'E', 'Budget et mobilité', 'Votre voiture vous coûte [combien], vraiment ?', 'Et sans elle, vous gagneriez combien par an ?', 104),
    ('IG-08-budget-commun-1', 'F', 'Maison', 'Qui doit [combien] à qui ?', 'Partager les dépenses à deux, à trois ou en famille.', 112),
    ('IG-09-gantt-1', 'F', 'Travail', 'Une date bouge. [Tout] se recale.', 'Un planning Gantt qui se tape en une ligne par tâche.', 112),
    ('IG-10-taches-1', 'E', 'Travail', 'Quoi faire [ce matin] ?', 'Noter vite, trier, choisir 3 à 5 tâches.', 112),
    ('IG-12-visa-1', 'D', "BTP · maîtrise d'œuvre", 'Qui relancer [ce matin] ?', 'Le circuit de visa des documents, suivi par lot.', 112),
    ('IG-13-non-conformites-1', 'C', 'Qualité · BTP et industrie', 'Le même écart, [trois fois] ?', "De la non-conformité à la vérification d'efficacité.", 112),
    ('IG-14-crm-1', 'B', 'Indépendants', "Qui relancer [aujourd'hui] ?", 'Un CRM simple pour qui travaille seul.', 112),
]

def titre(t):
    t = escape(t).replace(' ?', '&nbsp;?').replace(' :', '&nbsp;:')
    return t.replace('[', '<mark>').replace(']', '</mark>')

def formes(v):
    if v == 'C':
        return '<div class="frise"><div class="m1"></div><div class="m2"></div><div class="m3"></div><div class="m4"></div></div>'
    if v == 'F':
        return '<div class="plan"></div><div class="f f1"></div><div class="f f2"></div>'
    return '<div class="f f1"></div><div class="f f2"></div>'

sections = []
for fichier, v, sourcil, t, sous, taille in COUVERTURES:
    sections.append(f'''<section class="cadre v-{v}" id="{fichier}">
  {formes(v)}
  <span class="compteur">1 / 5</span>
  <div class="titre"><p class="sourcil">{escape(sourcil)}</p><h1 style="font-size:{taille}px">{titre(t)}</h1><p class="sous">{escape(sous)}</p></div>
  <p class="glisser">Faites glisser <span></span></p>
</section>''')

css = (ICI / 'variantes.css').read_text()
(ICI / 'couvertures.html').write_text(f'''<!doctype html>
<!-- Généré par generer_couvertures.py : ne pas modifier à la main. -->
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Couvertures du test des fonds</title>
<style>{css}</style>
</head>
<body>
{chr(10).join(sections)}
</body>
</html>
''')
print(len(sections), 'couvertures')
