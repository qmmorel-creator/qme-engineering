"""IG-25 · Carrousel template T57 · Gestion d'auto-école (19/02/2027), lendemain de LI-96.

Gabarits template de construire_ig_06_33.py (couverture, problème, écrans, appel à l'action). Faits :
docs/templates/communication/auto-ecole/linkedin.md. Captures : démo du template (assets/templates-
auto-ecole-*.webp), données fictives. Le template n'est PAS dans la liste Gumroad du 15/11/2026 : vue 5
sans prix ni achat (« bientôt en vente »). Ne publier que si la fiche Gumroad est en ligne, sinon décaler.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-25.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-25.html
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


T = dict(id='IG-25', slug='auto-ecole', dossier='auto-ecole', nom="Gestion d'auto-école",
  titre="T57 · Gestion de flotte auto-école", couleur='Auto-écoles', prix=45,
  h1="<mark>« Il me reste</mark> combien d'heures\u00a0?\u00a0»", sous='Moniteurs, voitures, élèves : un seul planning.',
  p2=("Deux leçons sur la même voiture à 14 h.",
      "L'erreur se découvre sur le parking, avec deux élèves et un seul véhicule."),
  v3=("Gestion d'auto-école", 'Un planning sans double réservation.', 'auto-ecole-planning', [
      "<b>Par moniteur et par véhicule</b> : la semaine sur ordinateur, la journée sur téléphone.",
      "<b>Leçon refusée</b> si elle chevauche une autre : même moniteur, même voiture ou même élève.",
      "<b>Véhicules suivis</b> : kilométrage, entretien, contrôle technique, coût par heure."], 'Données fictives'),
  v4=('Élèves', 'Les heures, sans recompter.', 'auto-ecole-eleves', [
      "<b>Heures achetées, faites, planifiées et restantes</b>, le reste à payer.",
      "<b>Compétences cochées</b>, bilan des heures et export CSV."], 'Données fictives'),
  demo='une auto-école fictive', plus="Votre auto-école a ses propres règles",
  prix_txt='Démo libre · bientôt en vente')

ALT = [
    "Titre « Il me reste combien d'heures ? » Moniteurs, voitures, élèves : un seul planning.",
    "Fond noir : deux leçons sur la même voiture à 14 h. L'erreur se découvre sur le parking, avec deux élèves et un seul véhicule.",
    "Capture du planning de la semaine par moniteur : une leçon qui chevauche une autre (même moniteur, voiture ou élève) est refusée ; les véhicules sont suivis (kilométrage, entretien, contrôle technique, coût par heure). Données fictives.",
    "Capture de la liste des élèves : heures restantes, reste dû et compétences pour chacun, barre des heures faites et planifiées. Données fictives.",
    "Fond jaune : essayez-le avec une auto-école fictive, démo libre sans inscription, bientôt en vente. Besoin de plus ? Version sur mesure. Lien en bio.",
]


def cta(t):
    h = ig.cta_template(t)
    a = '<div><i></i>Achat unique, sans abonnement</div>'
    assert a in h
    return h.replace(a, '<div><i></i>Bientôt en vente</div>')

if __name__ == '__main__':
    ecrire(T['id'], [f"\n<!-- ============ IG-25 · {T['titre']} (d'après LI-96) ============ -->",
                     ig.couv('IG-25', 'auto-ecole', T['couleur'], 'bleu', T['h1'], T['sous'], 3),
                     ig.probleme('IG-25', 'auto-ecole', T['p2'], None, 'rouge'),
                     ig.ecran('IG-25', 'auto-ecole', 3, 'bleu', *T['v3']),
                     ig.ecran('IG-25', 'auto-ecole', 4, 'jaune', *T['v4']),
                     cta(T)])
    print(json.dumps(ALT, ensure_ascii=False))
