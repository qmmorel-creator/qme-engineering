"""IG-126 · Carrousel « Sur mesure » adapté de LI-67 (Une bibliothèque d'ouvrages plutôt qu'une page blanche). Seuls les faits du Google Doc LI-67 sont repris ; aucune
capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-126.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-126.html
"""
import importlib.util
import json
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)


def ecrire(pid, blocs):
    tete = (IG / 'publications.html').read_text(encoding='utf-8').split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    page = tete + '\n'.join(blocs) + '\n\n</body>\n</html>\n'
    page = page.replace("../../../../assets/", "../../../../../assets/")
    (ICI / f'{pid}.html').write_text(page, encoding='utf-8')
S = dict(id='IG-126', slug='bibliotheque-ouvrages', sourcil='Sur mesure · calcul métier',
  h1="Une bibliothèque plutôt qu'une <mark>page blanche</mark>.", sous="Pour que chaque devis ne reparte pas de zéro.",
  p2=("Chaque devis recommence de zéro.",
      "On retape « Dépose des appareils sanitaires existants », on cherche le prix du dernier chantier, on hésite sur l'unité."),
  p2_bas=None,
  v3=("Dans l'outil de devis que j'ai conçu", 'Des ouvrages rangés par métier.', [
      ('carre', 'Un intitulé clair', "Rangé par métier : plombier, électricien, menuisier, peintre, carreleur.", None),
      ('rond', 'Une nature et une unité', "Main-d'œuvre ou fourniture ; forfait, mètre carré, mètre linéaire, unité.", None),
      ('quart', 'Un prix hors taxes', "À adapter à ses propres tarifs.", None)],
      'Principe présenté sans aucune donnée réelle'),
  v4=('Au moment du devis', 'Quelques lettres, un bouton.', [
      ('Le filtre', "On tape quelques lettres pour retrouver l'ouvrage."),
      ('Un bouton', "Il l'ajoute dans la bonne section du devis."),
      ('Les quantités', "On les saisit, et les calculs suivent.")]),
  v5=('Quelle ligne retapez-vous à chaque devis ?', ['Plombiers, électriciens, menuisiers', 'Peintres, carreleurs']))

ALT = [
    "Titre « Une bibliothèque plutôt qu'une page blanche. » Pour que chaque devis ne reparte pas de zéro.",
    "Fond noir : chaque devis recommence de zéro. On retape « Dépose des appareils sanitaires existants », on cherche le prix du dernier chantier, on hésite sur l'unité.",
    "Des ouvrages rangés par métier (plombier, électricien, menuisier, peintre, carreleur), chacun avec un intitulé clair, une nature et une unité, et un prix hors taxes à adapter à ses tarifs. Aucune donnée réelle.",
    "Au moment du devis : quelques lettres dans le filtre pour retrouver l'ouvrage, un bouton l'ajoute dans la bonne section, on saisit les quantités et les calculs suivent.",
    "Fond rouge : quelle ligne retapez-vous à chaque devis ? Plombiers, électriciens, menuisiers, peintres, carreleurs. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Une bibliothèque d'ouvrages plutôt qu'une page blanche (d'après LI-67) ============ -->"]
           + ig.sur_mesure(S, 2))
    print(json.dumps(ALT, ensure_ascii=False))
