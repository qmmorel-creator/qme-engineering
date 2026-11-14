"""IG-97 · Carrousel « Sur mesure » adapté de LI-25 (Voir où part chaque euro, d'un seul regard). Seuls les faits du Google Doc LI-25 sont
repris ; aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-97.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-97.html
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


S = dict(id='IG-97', slug='flux-budget', sourcil='Sur mesure · visualisation',
  h1="<mark>163 %</mark> pour une catégorie, 38 % pour une autre.", sous="Encore faut-il le voir.",
  p2=("Un tableau de dépenses répond bien à « combien ? ».",
      "Beaucoup moins bien à « d'où vient l'argent, et où part-il ? »."),
  p2_bas=None,
  v3=('Le diagramme de flux', "D'où vient l'argent, où il part.", [
      ('quart', 'À gauche, les revenus', "Puis, au centre, les comptes.", None),
      ('barres', 'À droite, les catégories', "Les dépenses, catégorie par catégorie.", None),
      ('rond', 'Des bandes proportionnelles', "Chaque bande a une épaisseur proportionnelle au montant.", None)],
      'Principe illustré, aucune donnée réelle'),
  v4=('Juste en dessous', 'Deux repères changent la lecture.', [
      ('Le rythme du budget', "Ce qui est dépensé, face à ce qui aurait dû l'être à ce jour du mois."),
      ('« Où vous devriez en être »', "Un trait par catégorie : celle à 163 % saute aux yeux, celle à 38 % aussi."),
      ('« À classer »', "Les opérations pas encore classées forment une catégorie à part, au lieu de disparaître.")]),
  v5=('Une association, un chantier, un événement ?', ['Subventions, cotisations, dons vers les actions', 'Acomptes vers les postes de dépense']))

ALT = [
    "Titre « 163 % pour une catégorie, 38 % pour une autre. » Encore faut-il le voir.",
    "Fond noir : un tableau de dépenses répond bien à « combien ? ». Beaucoup moins bien à « d'où vient l'argent, et où part-il ? ».",
    "Le diagramme de flux : à gauche les revenus, au centre les comptes, à droite les catégories de dépenses ; chaque bande a une épaisseur proportionnelle au montant. Principe illustré, aucune donnée réelle.",
    "Deux repères : le rythme du budget, dépensé face à ce qui aurait dû l'être à ce jour du mois ; un trait « où vous devriez en être » par catégorie ; les opérations non classées regroupées dans « À classer ».",
    "Fond rouge : une association, un chantier, un événement ? Subventions, cotisations, dons vers les actions ; acomptes vers les postes de dépense. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Voir où part chaque euro, d'un seul regard (d'après LI-25) ============ -->"]
           + ig.sur_mesure(S, 1))
    print(json.dumps(ALT, ensure_ascii=False))
