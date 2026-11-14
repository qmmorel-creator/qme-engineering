"""IG-122 · Carrousel « Sur mesure » adapté de LI-63 (Partager un compte commun au prorata). Seuls les faits du Google Doc LI-63 sont repris ;
aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-122.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-122.html
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


S = dict(id='IG-122', slug='compte-commun-prorata', titre='Sur mesure · Un compte commun au prorata', li='LI-63',
  sourcil='Sur mesure · cas réel',
  h1="Un compte commun, <mark>au prorata</mark>.", sous="Combien chacun verse ce mois-ci : une règle écrite.",
  p2=("Deux personnes, un compte commun, des revenus différents.",
      "Combien chacun doit-il verser ce mois-ci ?"),
  p2_bas="Une règle écrite, et on ne discute plus de « qui a mis combien ».",
  v3=('La règle, appliquée chaque mois', 'Écrite une fois.', [
      ('carre', '1. Le montant à couvrir', "Charges communes du mois, plus le report, moins ce qui reste déjà sur le compte.", None),
      ('quart', '2. La répartition', "Au prorata des revenus de chacun, ou selon une clé choisie à la main.", None),
      ('rond', '3. Les charges propres', "Chacun y ajoute ses charges fixes payées par le compte.", None)],
      'Cas réel, présenté sans aucune donnée du client'),
  v4=('Exemple fictif', '2 200 € à couvrir.', [
      ('2 400 € de charges', "200 € déjà sur le compte : 2 200 € à couvrir."),
      ('Revenus : 3 000 € et 2 000 €', "Répartition de 60 % et 40 %."),
      ('1 320 € et 880 €', "Plus les charges fixes de chacun.")]),
  v5=('Moitié-moitié, ou au prorata ?', ["Deux personnes, colocation, associés", "Associations qui partagent un local, copropriété"]))

ALT = [
 "Titre « Un compte commun, au prorata. » Combien chacun verse ce mois-ci : une règle écrite.",
 "Fond noir : deux personnes, un compte commun, des revenus différents. Combien chacun doit-il verser ce mois-ci ? Une règle écrite, et on ne discute plus de « qui a mis combien ».",
 "La règle, appliquée chaque mois : le montant à couvrir (charges communes, plus le report, moins le solde du compte), réparti au prorata des revenus ou selon une clé, plus les charges fixes de chacun. Cas réel, sans donnée du client.",
 "Exemple fictif : 2 400 € de charges, 200 € sur le compte, 2 200 € à couvrir ; revenus de 3 000 € et 2 000 €, soit 60 % et 40 % : 1 320 € et 880 €, plus les charges fixes de chacun.",
 "Fond rouge : moitié-moitié, ou au prorata ? Deux personnes, colocation, associés, associations, copropriété. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Deux personnes, un compte commun, des revenus différents. Combien chacun verse-t-il ce mois-ci ?

Dans un outil de budget partagé que j'ai conçu, la règle est écrite une fois et appliquée chaque mois. Le montant à couvrir : les charges communes du mois, plus le report, moins ce qui reste déjà sur le compte. Il se répartit au prorata des revenus, ou selon une clé choisie à la main. Chacun y ajoute ensuite ses propres charges fixes.

Exemple fictif : 2 400 € de charges et 200 € déjà sur le compte, donc 2 200 € à couvrir. Avec des revenus de 3 000 € et 2 000 €, la répartition est de 60 % et 40 % : 1 320 € et 880 €.

Le calcul est simple. Son intérêt : il est visible et identique chaque mois, et on ne discute plus de « qui a mis combien ». Colocation, associés qui financent des frais communs, associations qui partagent un local, copropriété : le principe est le même.

Votre métier a ses règles ? Parlons-en : lien en bio.

#Budget #FinancesPersonnelles #Colocation #OutilsSurMesure"""

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · {S['titre']} (d'après {S['li']}) ============ -->"]
           + ig.sur_mesure(S, 0))
    print(json.dumps(dict(alt=ALT, legende=LEGENDE), ensure_ascii=False))
