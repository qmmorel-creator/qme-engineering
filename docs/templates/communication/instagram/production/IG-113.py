"""Carrousel Instagram IG-113 (Sur mesure · 180 coureurs suivis en direct), 26/01/2027, adapté de LI-54 (Google Doc du planning LinkedIn).

Seuls les faits du post LinkedIn sont repris ; aucune capture d'outil client, aucune donnée réelle.
Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié).
Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-113.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-113.html
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

S = dict(id='IG-113', slug='pc-course', titre='Sur mesure · 180 coureurs suivis en direct sur une carte',
  sourcil='Sur mesure · événementiel',
  h1="180 coureurs, <mark>un seul</mark> écran.", sous="Une console de PC course, pour une course fictive.",
  p2=("Un ultra-trail de 112 km, 180 partants, 7 ravitaillements.",
      "Au PC course : où sont-ils, et qui est en difficulté ?"),
  p2_bas="La course, les coureurs, les temps : tout est fictif.",
  v3=('Sur un seul écran', 'La console du PC course.', [
      ('quart', 'Au centre, la carte', 'Chaque coureur positionné, la tête de course, le coureur suivi.', None),
      ('barres', 'En haut, les compteurs', 'En course, arrivés, abandons, tête et serre-file, alertes à traiter.', None),
      ('carre', 'À droite, le classement', 'En direct, filtrable par sexe, catégorie et statut.', None)],
      'Démonstration, données fictives'),
  v4=('Et autour', 'Revoir la course après coup.', [
      ('Un statut par coureur', 'En course, au ravito, arrivé, abandon, hors barrière.'),
      ('Les autres onglets', 'Fiche coureur, ravitaillements et stocks, barrières horaires, alertes.'),
      ('« Rejouer la course »', 'Pour le débriefing des bénévoles ou la prochaine édition.')]),
  v5=("Un événement étalé dans l'espace ?", ['Trail, course cycliste, raid', 'Randonnée encadrée']))
ecrire(S['id'], S['titre'], 'LI-54', ig.sur_mesure(S, 2))
