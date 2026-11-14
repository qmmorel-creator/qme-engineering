"""IG-104 · Carrousel « Sur mesure » adapté de LI-47 (47 mises en ligne en 6 jours). Seuls les faits du Google Doc LI-47 sont repris ;
aucune capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-104.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-104.html
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


S = dict(id='IG-104', slug='automatiser-compter', titre='Méthode · Avant d\'automatiser, comptez', li='LI-47',
  sourcil='Automatisation · méthode',
  h1="47 mises en ligne <mark>en 6 jours</mark>.", sous="Avant d'automatiser, comptez les déclenchements.",
  p2=("Chaque modification validée partait en ligne d'elle-même : 51 modifications, 47 publications.",
      "Et l'hébergeur facture chaque publication."),
  p2_bas="Constaté sur l'un de mes propres outils.",
  v3=('La nouvelle règle', 'Publier quand on le décide.', [
      ('carre', 'Plus de départ automatique', "Une modification validée ne part plus en ligne d'elle-même.", None),
      ('rond', 'Une demande explicite', "Un mot-clé dans le titre de la modification déclenche la publication.", None),
      ('barres', 'Seulement ce qui a changé', "Seuls les sites modifiés depuis leur dernière publication sont reconstruits.", "Et un arrêt d'urgence coupe tout d'un seul réglage")],
      None),
  v4=("Pas que dans l'informatique", 'Chaque déclenchement a un coût.', [
      ("Un SMS, un appel d'API", "Une impression, un passage de technicien : tout automatiser a un coût caché."),
      ("Avant d'automatiser", "Comptez combien de fois par mois l'automatisme se déclenchera, et ce que coûte chaque déclenchement.")]),
  v5=('Quel automatisme se déclenche trop souvent ?', ["Des déclenchements regroupés et décidés", "Plutôt que plusieurs fois par jour"]))

ALT = [
 "Titre « 47 mises en ligne en 6 jours. » Avant d'automatiser, comptez les déclenchements.",
 "Fond noir : chaque modification validée partait en ligne d'elle-même : 51 modifications, 47 publications. Et l'hébergeur facture chaque publication. Constaté sur l'un de mes propres outils.",
 "La nouvelle règle : plus de départ automatique, une publication déclenchée par un mot-clé explicite, seuls les sites modifiés reconstruits, et un arrêt d'urgence d'un seul réglage.",
 "Pas que dans l'informatique : un SMS, un appel d'API, une impression, un passage de technicien. Avant d'automatiser, comptez les déclenchements par mois et le coût de chacun.",
 "Fond rouge : quel automatisme se déclenche trop souvent ? Des déclenchements regroupés et décidés. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """51 modifications en 6 jours, 47 mises en ligne du même site. Je l'ai constaté sur l'un de mes propres outils.

Le réglage avait l'air sain : chaque modification validée partait en ligne d'elle-même. Sauf que l'hébergeur facture chaque publication, et que personne n'avait besoin de 47 versions en une semaine.

J'ai changé la règle. Une publication ne part plus que si je la demande, avec un mot-clé dans le titre de la modification. Seuls les sites réellement modifiés sont reconstruits. Et un arrêt d'urgence coupe tout d'un seul réglage.

Ça ne vaut pas que pour l'informatique : un SMS, un appel d'API, une impression, un passage de technicien. Avant d'automatiser, comptez combien de fois par mois l'automatisme va se déclencher, et ce que coûte chaque déclenchement.

Votre métier a ses règles ? Parlons-en : lien en bio.

#Automatisation #OutilsSurMesure #Coûts #PME"""

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · {S['titre']} (d'après {S['li']}) ============ -->"]
           + ig.sur_mesure(S, 1))
    print(json.dumps(dict(alt=ALT, legende=LEGENDE), ensure_ascii=False))
