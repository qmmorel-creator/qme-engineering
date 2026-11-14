"""Carrousel Instagram IG-118 · Sur mesure · suivi de l'étalonnage des instruments (5 vues), adapté de LI-59.

Gabarit sur_mesure de construire_ig_06_33.py ; seuls les faits du Google Doc LI-59 sont repris.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-118.py
→ png/IG-118-etalonnage-1..5.png (HTML temporaire rendu par rendre.mjs, puis supprimé).
"""
import importlib.util
import pathlib
import subprocess

PROD = pathlib.Path(__file__).resolve().parent
ICI = PROD.parent
spec = importlib.util.spec_from_file_location('ig', ICI / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-118', slug='etalonnage', titre='Sur mesure · Étalonnage : aucun instrument hors date en production',
  li='LI-59', sourcil='Sur mesure · qualité',
  h1="Aucun instrument <mark>hors date</mark> en production.",
  sous="Le suivi de l'étalonnage, de l'inventaire au certificat.",
  p2=("Un pied à coulisse dont l'étalonnage a expiré il y a trois mois.",
      "Toutes les mesures faites avec depuis deviennent discutables."),
  p2_bas="Le jour de l'audit, c'est la question qui fâche.",
  v3=('Pour un atelier ou un laboratoire', 'Ce que je construirais.', [
      ('carre', 'Un inventaire', "Identifiant, emplacement, utilisateur habituel, périodicité d'étalonnage.", None),
      ('rond', 'Des échéances visibles', "À jour, échéance proche, en retard ; et la liste du mois à envoyer.", None),
      ('quart', 'Un blocage clair', "Hors date : « ne pas utiliser » sur sa fiche et sur l'étiquette scannée au poste.", None)],
      None),
  v4=('Et un historique', 'Celui qui sert le jour du problème.', [
      ('Chaque étalonnage', "avec son certificat et son constat."),
      ('Un retour « hors tolérance » ?', "On sait quelles mesures l'instrument a servi à faire depuis le dernier contrôle."),
      ('Aucun tableur ne le fait bien', "C'est pourtant le point qui compte le jour où un problème arrive.")]),
  v5=('Où se trouve la liste de vos instruments ?', ['Atelier, laboratoire, contrôle', 'Inventaire, échéances, historique']))

ALT = [
    "Titre « Aucun instrument hors date en production. » Le suivi de l'étalonnage, de l'inventaire au certificat.",
    "Fond noir : un pied à coulisse dont l'étalonnage a expiré il y a trois mois. Toutes les mesures faites avec depuis deviennent discutables. Le jour de l'audit, c'est la question qui fâche.",
    "Ce que je construirais : un inventaire des instruments (identifiant, emplacement, utilisateur, périodicité), des échéances visibles avec la liste du mois, et un blocage « ne pas utiliser » sur la fiche et l'étiquette scannée au poste.",
    "Et un historique de chaque étalonnage, avec certificat et constat : si un instrument revient hors tolérance, on sait quelles mesures il a servi à faire depuis le dernier contrôle. Aucun tableur ne le fait bien.",
    "Fond rouge : où se trouve la liste de vos instruments ? Inventaire, échéances, historique. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

LEGENDE = """Un pied à coulisse hors date depuis trois mois : toutes les mesures faites avec depuis deviennent discutables.

Le jour de l'audit, c'est la question qui fâche. Pour un atelier ou un laboratoire, je construirais quatre choses.

Un inventaire des instruments, chacun avec son identifiant, son emplacement, son utilisateur habituel et sa périodicité. Des échéances visibles, avec la liste du mois à envoyer en étalonnage. Un blocage clair : hors date, l'instrument est marqué « ne pas utiliser » sur sa fiche et sur l'étiquette scannée au poste.

Et surtout, un historique de chaque étalonnage avec son certificat. Si un instrument revient « hors tolérance », on sait quelles mesures il a servi à faire depuis le dernier contrôle. C'est le point qui sert le jour où un problème arrive, et celui qu'aucun tableur ne fait bien.

Votre métier a ses règles ? Parlons-en : lien en bio.

#Qualité #Métrologie #ISO9001 #Industrie #OutilsSurMesure"""


def rendre(pid, blocs):
    tete = (ICI / 'publications.html').read_text(encoding='utf-8').split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f'<title>Publication Instagram {pid}</title>')
    tmp = ICI / f'_{pid}.html'
    tmp.write_text(tete + '\n'.join(blocs) + '\n\n</body>\n</html>\n', encoding='utf-8')
    try:
        subprocess.run(['node', str(ICI / 'rendre.mjs'), tmp.name], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S['id'], ig.sur_mesure(S, 0))
