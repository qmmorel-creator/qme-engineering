"""IG-39 · Carrousel « Pourquoi mes outils n'ont pas d'abonnement » (18/11/2026), d'après le script J15
de videos-30-jours.md (raisonnement : carrousel plutôt que Reel). Gabarit sur mesure de
construire_ig_06_33.py. Faits : pages Templates du site (achat unique sans renouvellement, tous vos
appareils avec la même clé, démo libre, dès 12 €).

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-39.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-39.html
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


S = dict(id='IG-39', slug='abonnement', sourcil='Templates QME · point de vue',
  h1="Pas d'abonnement. <mark>C'est voulu.</mark>", sous="Pourquoi mes outils s'achètent une seule fois.",
  p2=("Un planning, un budget, un registre : on s'en sert des années.",
      "Payer chaque mois pour un outil qui change peu finit par coûter plus que l'outil."),
  p2_bas=None,
  v3=('Ce que vous achetez', 'Une fois, pour de bon.', [
      ('carre', 'Achat unique', 'Sans renouvellement. Dès 12 €, selon le template.', None),
      ('rond', 'Tous vos appareils', 'Ordinateur, tablette, téléphone : la même clé, les mêmes données.', None),
      ('quart', 'Une démo libre', "Pour essayer avant d'acheter, sans inscription.", None)],
      None),
  v4=('Et si vous avez besoin de plus', "C'est le rôle du sur mesure.", [
      ('Le template', 'Pensé pour les usages les plus courants.'),
      ('Le sur mesure', 'Vos règles, vos utilisateurs, vos outils.')]),
  v5=("Besoin de plus que l'usage courant ?", ['Chaque template a sa démo libre', 'Le sur mesure part de votre métier']))

ALT = [
    "Titre « Pas d'abonnement. C'est voulu. » Pourquoi mes outils s'achètent une seule fois.",
    "Fond noir : un planning, un budget, un registre, on s'en sert des années. Payer chaque mois pour un outil qui change peu finit par coûter plus que l'outil.",
    "Ce que vous achetez : achat unique sans renouvellement, dès 12 € selon le template ; tous vos appareils avec la même clé ; une démo libre sans inscription.",
    "Et si vous avez besoin de plus : le template est pensé pour les usages les plus courants, le sur mesure part de vos règles, vos utilisateurs, vos outils.",
    "Fond rouge : besoin de plus que l'usage courant ? Chaque template a sa démo libre. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Pourquoi pas d'abonnement (script J15) ============ -->"]
           + ig.sur_mesure(S, 0))
    print(json.dumps(ALT, ensure_ascii=False))
