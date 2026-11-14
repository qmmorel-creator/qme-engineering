"""Carrousel Instagram IG-95 (Sur mesure · 11 enfants, 3 adultes : l'arrondi qui compte), 06/01/2027, adapté de LI-44 (Google Doc du planning LinkedIn).

Seuls les faits du post LinkedIn sont repris ; aucune capture d'outil client, aucune donnée réelle.
Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié).
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-95.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-95.html
"""
import importlib.util
import pathlib

ICI = pathlib.Path(__file__).resolve().parent
IG_DIR = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG_DIR / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)


def ecrire(pid, titre, li, sections):
    source = (IG_DIR / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0].replace("'../../../../assets/", "'../../../../../assets/")
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    corps = [f"\n<!-- ============ {pid} · {titre} (d'après {li}) ============ -->"] + sections
    (ICI / f'{pid}.html').write_text(tete + '\n'.join(corps) + '\n\n</body>\n</html>\n', encoding='utf-8')

S = dict(id='IG-95', slug='encadrement', titre="Sur mesure · 11 enfants, 3 adultes : l'arrondi qui compte",
  sourcil='Sur mesure · calcul métier',
  h1="11 enfants, 1 adulte pour 5 : il en faut <mark>3</mark>.", sous="L'arrondi qui compte, dans un outil de crèche.",
  p2=("11 ÷ 5 = 2,2.", "Il ne faut pas 2 adultes. Il en faut 3."),
  p2_bas="Un « =ARRONDI() » tapé au lieu de « =ARRONDI.SUP() », et le compte est faux.",
  v3=("Dans l'outil de crèche", 'Le calcul tourne en continu.', [
      ('barres', 'Groupe par groupe', "Enfants présents ÷ taux d'encadrement, arrondi à l'entier supérieur.", None),
      ('rond', '« Présents / requis »', "L'écran affiche par exemple 2 / 3.", None),
      ('carre', 'Une alerte à temps', "Le compte n'y est pas : le compteur passe en alerte, avant une pause.", None)],
      'Prototype, données fictives'),
  v4=('Les taux', 'Des réglages, pas une règle.', [
      ('1 pour 5, 1 pour 8', 'Les taux du prototype, chez les plus petits et chez les plus grands.'),
      ('Chaque structure pose les siens', "Aucune affirmation réglementaire."),
      ("À chaque heure de la journée", "La question se repose dès qu'un taux s'applique.")]),
  v5=("Un taux d'encadrement s'applique chez vous ?", ['Accueils de loisirs, clubs sportifs', 'Événements, sécurité']))
ecrire(S['id'], S['titre'], 'LI-44', ig.sur_mesure(S, 0))
