"""IG-115 · Carrousel « Sur mesure » adapté de LI-56 (Six mois de réunions sur un seul écran). Seuls les faits du Google Doc LI-56 sont
repris ; aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-115.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-115.html
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


S = dict(id='IG-115', slug='carte-reunions', sourcil='Sur mesure · réunions',
  h1="<mark>Six mois</mark> de réunions sur un seul écran.", sous="Une liste y répond mal. Une carte, beaucoup mieux.",
  p2=("Combien de réunions sur ce projet depuis la rentrée ?",
      "Lesquelles n'ont toujours pas de compte rendu ?"),
  p2_bas=None,
  v3=('La carte de chaleur', 'Une case par jour.', [
      ('carre', "De six mois avant à deux mois après", "Aujourd'hui au milieu, le rythme d'un coup d'œil.", None),
      ('rond', 'La couleur du projet', 'Plusieurs couleurs signalent plusieurs réunions.', None),
      ('quart', 'Un clic filtre la liste', 'Un double-clic crée une réunion ce jour-là.', None)],
      'Principe illustré, aucune donnée réelle'),
  v4=('Juste en dessous', 'Rien ne passe à travers.', [
      ("La liste, autour d'« Aujourd'hui »", "À venir au-dessus, passées en dessous, avec l'état du compte rendu."),
      ('« Comptes rendus à écrire »', 'Un bouton pour ceux qui manquent.'),
      ('Une recherche dans les décisions', "« La réunion où on a parlé du devis plomberie », sans sa date.")]),
  v5=('Rendez-vous, visites, interventions ?', ['Le rythme sur six mois', "montre ce qu'une liste cache"]))

ALT = [
    "Titre « Six mois de réunions sur un seul écran. » Une liste y répond mal, une carte beaucoup mieux.",
    "Fond noir : combien de réunions sur ce projet depuis la rentrée ? Lesquelles n'ont toujours pas de compte rendu ?",
    "La carte de chaleur : une case par jour, de six mois avant à deux mois après aujourd'hui ; la case prend la couleur du projet ; un clic filtre la liste, un double-clic crée une réunion. Principe illustré, aucune donnée réelle.",
    "Juste en dessous : la liste des réunions autour du repère « Aujourd'hui » avec l'état du compte rendu, un bouton « Comptes rendus à écrire », une recherche dans les décisions et les notes.",
    "Fond rouge : rendez-vous clients, visites, interventions ? Le rythme sur six mois montre ce qu'une liste cache. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Six mois de réunions sur un seul écran (d'après LI-56) ============ -->"]
           + ig.sur_mesure(S, 0))
    print(json.dumps(ALT, ensure_ascii=False))
