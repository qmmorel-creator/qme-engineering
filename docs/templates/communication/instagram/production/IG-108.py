"""IG-108 · Carrousel « Sur mesure » adapté de LI-33 (Ouvrir son outil à l'extérieur sans tout montrer). Seuls les faits du Google Doc LI-33 sont repris ; aucune
capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-108.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-108.html
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
S = dict(id='IG-108', slug='portails', sourcil='Sur mesure · multi-utilisateur',
  h1="Ouvrir son outil, <mark>sans tout</mark> montrer.", sous="Deux portails pour un atelier de wedding planning.",
  p2=("Quand l'horaire du cocktail change, le traiteur, le DJ et le photographe doivent le savoir.",
      "Tous, et en même temps."),
  p2_bas="Par mail, par téléphone, par messages : chaque échange est une occasion de perdre une information.",
  v3=('Une base, trois accès', 'Chacun voit ce qui le concerne.', [
      ('carre', 'Le portail des mariés', "Rétroplanning, tâches qui leur reviennent, réponses d'invités, paiements à venir, documents à valider.", None),
      ('rond', 'Le portail des prestataires', "Le déroulé du jour J, les horaires qui les concernent, l'adresse et les consignes d'accès.", None),
      ('quart', "L'espace de travail interne", "Celui de l'atelier, complet.", None)],
      'Cas réel, présenté sans aucune donnée du client'),
  v4=('Ce qui ne sort pas', 'Une seule version, filtrée.', [
      ('Jamais visibles de l\'extérieur', "Le budget global, les honoraires, les marges, les notes internes, les autres mariages."),
      ('Une seule base de données', "Tout vient du même endroit ; chaque portail filtre ce qui sort."),
      ('Le vrai bénéfice', "La bonne version de l'information, au même endroit pour tout le monde.")]),
  v5=('Qui vous demande « où en est-on ? »', ['Un cabinet et ses clients, un syndic et ses copropriétaires', 'Un organisme de formation, un club et ses familles']))

ALT = [
    "Titre « Ouvrir son outil, sans tout montrer. » Deux portails pour un atelier de wedding planning.",
    "Fond noir : quand l'horaire du cocktail change, le traiteur, le DJ et le photographe doivent le savoir, tous et en même temps. Chaque échange par mail, téléphone ou message est une occasion de perdre une information.",
    "Une base, trois accès : le portail des mariés (rétroplanning, tâches, réponses d'invités, paiements, documents à valider), le portail des prestataires (déroulé du jour J, horaires, adresse, consignes d'accès) et l'espace interne. Cas réel, sans donnée du client.",
    "Ce qui ne sort pas : budget global, honoraires, marges, notes internes et autres mariages ne sont jamais visibles de l'extérieur ; une seule base de données, chaque portail filtre ; la bonne version de l'information au même endroit pour tous.",
    "Fond rouge : qui vous demande « où en est-on ? » Un cabinet et ses clients, un syndic, un organisme de formation, un club et ses familles. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Ouvrir son outil à l'extérieur sans tout montrer (d'après LI-33) ============ -->"]
           + ig.sur_mesure(S, 2))
    print(json.dumps(ALT, ensure_ascii=False))
