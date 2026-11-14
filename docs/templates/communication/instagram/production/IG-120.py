"""IG-120 · Carrousel « Sur mesure » adapté de LI-61 (Le jour J, minute par minute). Seuls les faits du Google Doc LI-61 sont repris ; aucune
capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-120.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-120.html
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
S = dict(id='IG-120', slug='jour-j', sourcil='Sur mesure · événementiel',
  h1="Le jour J, <mark>minute</mark> par minute.", sous="Ce qui se passe maintenant, et ce qui vient ensuite.",
  p2=("Le jour d'un mariage, la wedding planner ne regarde pas un planning.",
      "Elle regarde l'heure."),
  p2_bas="Qu'est-ce qui se passe maintenant, et qu'est-ce qui vient ensuite ?",
  v3=('Le déroulé du jour J', 'Toute la journée sur un cadran.', [
      ('rond', 'Un cadran de 24 heures', "De l'installation du matin au départ des dernières navettes dans la nuit.", None),
      ('carre', "L'étape en cours", "Mise en avant, avec la suivante et le nombre de minutes qui l'en sépare.", None),
      ('quart', 'Qui doit être sur place', "La wedding planner, le photographe, le traiteur, le DJ, les navettes.", None)],
      'Cas réel, présenté sans aucune donnée du client'),
  v4=('La veille', "Simuler l'heure.", [
      ('Un curseur', "« À 17 h 40, où en sera-t-on ? » La journée se vérifie avant de la vivre."),
      ('Quatre lectures', "Le même déroulé en cadran, en Gantt, en liste ou sur téléphone."),
      ('Le programme détaillé', "Heure par heure, sous le cadran.")]),
  v5=('Chaque événement a son jour J.', ['Salon professionnel, séminaire', 'Tournage, inauguration']))

ALT = [
    "Titre « Le jour J, minute par minute. » Ce qui se passe maintenant, et ce qui vient ensuite.",
    "Fond noir : le jour d'un mariage, la wedding planner ne regarde pas un planning, elle regarde l'heure. Qu'est-ce qui se passe maintenant, et qu'est-ce qui vient ensuite ?",
    "Le déroulé du jour J : un cadran de 24 heures, de l'installation du matin aux dernières navettes ; l'étape en cours mise en avant avec la suivante et les minutes qui l'en séparent ; qui doit être sur place. Cas réel, sans donnée du client.",
    "La veille, simuler l'heure : un curseur pour vérifier la journée (« à 17 h 40, où en sera-t-on ? ») ; le même déroulé en cadran, Gantt, liste ou téléphone ; le programme détaillé heure par heure.",
    "Fond rouge : chaque événement a son jour J. Salon professionnel, séminaire, tournage, inauguration. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Le jour J, minute par minute (d'après LI-61) ============ -->"]
           + ig.sur_mesure(S, 1))
    print(json.dumps(ALT, ensure_ascii=False))
