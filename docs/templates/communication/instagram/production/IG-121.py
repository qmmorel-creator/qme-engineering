"""IG-121 · Carrousel « Sur mesure » adapté de LI-62 (Une intervention ne commence pas sans sa check-list). Seuls les faits du Google Doc LI-62 sont
repris ; aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-121.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-121.html
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


S = dict(id='IG-121', slug='check-list', sourcil='Sur mesure · sécurité',
  h1="Pas d'intervention <mark>sans check-list</mark>.", sous="Sur papier, elle existe souvent. Mais elle est remplie après coup.",
  p2=("Couper et verrouiller les énergies, vérifier qu'il n'en reste plus, porter les bons équipements, prévenir l'équipe.",
      "Ces étapes ne se sautent pas, même quand l'intervention est « rapide »."),
  p2_bas=None,
  v3=('La check-list', 'Courte, sur téléphone ou tablette.', [
      ('carre', 'Des étapes obligatoires', "Tant qu'elles ne sont pas cochées, l'ordre de travail ne passe pas « en cours ».", None),
      ('rond', 'Chaque étape horodatée', "Avec le nom de la personne qui l'a validée.", None),
      ('quart', 'Une photo si besoin', 'Celle du cadenas posé, par exemple.', None)],
      'Principe illustré, aucune donnée réelle'),
  v4=("Jusqu'au bout", 'Aucun oubli sans décision.', [
      ('La remise en service', 'Tracée elle aussi, à la fin.'),
      ('Ni la formation, ni le jugement', "L'outil ne les remplace pas."),
      ('Une étape sautée ?', "Seulement si quelqu'un l'a décidé.")]),
  v5=('Vos check-lists : avant ou après ?', ["Une check-list par type d'intervention", 'Remplie avant, pas après coup']))

ALT = [
    "Titre « Pas d'intervention sans check-list. » Sur papier, elle existe souvent, mais elle est remplie après coup.",
    "Fond noir : couper et verrouiller les énergies, vérifier qu'il n'en reste plus, porter les bons équipements, prévenir l'équipe. Ces étapes ne se sautent pas, même quand l'intervention est « rapide ».",
    "La check-list, courte, sur téléphone ou tablette : des étapes obligatoires sans lesquelles l'ordre de travail ne passe pas « en cours » ; chaque étape horodatée avec le nom de qui l'a validée ; une photo, par exemple du cadenas posé. Principe illustré.",
    "Jusqu'au bout : la remise en service est tracée elle aussi ; l'outil ne remplace ni la formation ni le jugement ; une étape ne peut être sautée que si quelqu'un l'a décidé.",
    "Fond rouge : vos check-lists, avant ou après ? Une check-list par type d'intervention, remplie avant. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Une intervention ne commence pas sans sa check-list (d'après LI-62) ============ -->"]
           + ig.sur_mesure(S, 1))
    print(json.dumps(ALT, ensure_ascii=False))
