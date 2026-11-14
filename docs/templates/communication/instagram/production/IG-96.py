"""IG-96 · Carrousel « Sur mesure » adapté de LI-23 (Une opération, deux dates). Seuls les faits du Google Doc LI-23 sont repris ; aucune
capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-96.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-96.html
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
S = dict(id='IG-96', slug='deux-dates', sourcil='Sur mesure · bases de données',
  h1="Une opération, <mark>deux dates</mark>.", sous="Le loyer de février, prélevé le 30 janvier.",
  p2=("Le loyer de février est prélevé le 30 janvier. Dans quel mois le compter ?",
      "Pour la banque, c'est janvier. Pour le budget, c'est février."),
  p2_bas="Un outil qui ne connaît qu'une date se trompe forcément dans l'un des deux.",
  v3=("Dans l'outil que j'ai conçu", 'Chaque opération a deux dates.', [
      ('carre', 'La date bancaire', "La vraie. Elle sert à calculer les soldes.", None),
      ('rond', 'La date de rattachement', "Elle sert aux budgets, aux rapports, aux graphiques et aux recherches.", None),
      ('quart', 'Identiques par défaut', "On ne corrige que les exceptions, une par une ou en masse sur une sélection.", None)],
      'Principe présenté sans aucune donnée réelle'),
  v4=('Pourquoi deux dates', 'Le vrai rythme des dépenses.', [
      ('Rien ne se perd', "La date bancaire reste visible au survol : on garde la trace de ce qui s'est passé."),
      ('La distinction des comptables', "La date d'encaissement d'un côté, la période de rattachement de l'autre."),
      ('Sans elle', "Un mois paraît trop cher, le suivant trop léger, et on décide sur un faux rythme.")]),
  v5=('Quelle dépense tombe dans le mauvais mois ?', ['Loyers, abonnements annuels', 'Factures payées en retard, salaires du dernier jour']))

ALT = [
    "Titre « Une opération, deux dates. » Le loyer de février, prélevé le 30 janvier.",
    "Fond noir : le loyer de février est prélevé le 30 janvier. Pour la banque, c'est janvier ; pour le budget, c'est février. Un outil qui ne connaît qu'une date se trompe forcément dans l'un des deux.",
    "Chaque opération a deux dates : la date bancaire, qui calcule les soldes ; la date de rattachement, pour les budgets, rapports, graphiques et recherches ; identiques par défaut, on ne corrige que les exceptions. Aucune donnée réelle.",
    "Pourquoi deux dates : la date bancaire reste visible au survol ; c'est la distinction des comptables entre encaissement et période de rattachement ; sans elle, un mois paraît trop cher et le suivant trop léger.",
    "Fond rouge : quelle dépense tombe dans le mauvais mois ? Loyers, abonnements annuels, factures payées en retard, salaires du dernier jour. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Une opération, deux dates (d'après LI-23) ============ -->"]
           + ig.sur_mesure(S, 0))
    print(json.dumps(ALT, ensure_ascii=False))
