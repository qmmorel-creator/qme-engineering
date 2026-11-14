"""Carrousel Instagram IG-34 (Sur mesure), 26/12/2026, adapté de LI-19 « Brancher ses applis plutôt que
les recopier ». Seuls les faits du Google Doc LI-19 sont repris ; aucune capture d'outil, aucune donnée réelle.

Gabarit sur_mesure de construire_ig_06_33.py (importé, non modifié). Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-34.py
Écrit un HTML temporaire, le rend avec rendre.mjs (png/IG-34-integrations-1..5.png), puis le supprime.
"""
import importlib.util
import pathlib
import subprocess

ICI = pathlib.Path(__file__).resolve().parent
IG = ICI.parent
spec = importlib.util.spec_from_file_location('ig', IG / 'construire_ig_06_33.py')
ig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ig)

S = dict(id='IG-34', slug='integrations', titre='Sur mesure · Brancher ses applis plutôt que les recopier',
  date='26/12/2026', li='LI-19', sourcil='Sur mesure · intégrations',
  h1='Brancher <mark>ses applis</mark>, pas les recopier.',
  sous="Un seul tableau de bord, alimenté par les applications déjà utilisées.",
  p2=("Une montre, une balance, une appli de repas, un agenda, une banque.",
      "Chacune a ses chiffres, son écran, son mot de passe. Et rien ne se croise."),
  p2_bas=None,
  v3=('Trois principes', 'Valables pour toute intégration.', [
      ('quart', "1. L'outil lit, il n'écrit pas", "La saisie reste dans l'application d'origine, là où elle est la plus simple.", None),
      ('rond', '2. Un seul bouton « Synchroniser »', "Il lance toutes les sources et affiche l'état de chacune. Une source en panne : les autres continuent.", None),
      ('barres', "3. Chaque chiffre dit d'où il vient", 'Aucun chiffre affiché sans sa source.', None)],
      None),
  v4=('Ce que ça change', 'Des écarts enfin visibles.', [
      ('Des moyennes, des tendances, des écarts', "Invisibles tant que chaque donnée restait dans son application."),
      ('Sans doublons', "Une même séance arrivée par deux chemins n'est comptée qu'une fois."),
      ('En entreprise, c\'est pareil', "Caisse, paie, agenda partagé, CRM : se parlent-ils, ou faites-vous le lien ?")]),
  v5=('Vos logiciels se parlent-ils ?', ["Ou est-ce vous qui recopiez de l'un à l'autre ?"]),
  alt=["Titre « Brancher ses applis, pas les recopier. » Un seul tableau de bord, alimenté par les applications déjà utilisées.",
       "Fond noir : une montre, une balance, une appli de repas, un agenda, une banque. Chacune a ses chiffres, son écran, son mot de passe, et rien ne se croise.",
       "Trois principes valables pour toute intégration : l'outil lit sans écrire dans les applications d'origine ; un seul bouton « Synchroniser » lance toutes les sources et affiche l'état de chacune ; chaque chiffre dit d'où il vient.",
       "Ce que ça change : des moyennes, des tendances et des écarts enfin visibles, sans doublons. En entreprise : caisse, paie, agenda partagé, CRM se parlent-ils, ou faites-vous le lien ?",
       "Fond rouge : vos logiciels se parlent-ils, ou est-ce vous qui recopiez de l'un à l'autre ? Votre métier a ses règles ? Parlons-en : lien en bio."],
  legende="""Une montre, une balance, une appli de repas, un agenda, une banque. Et rien ne se croise.

Chacune a ses chiffres, son écran, son mot de passe. Dans l'outil de gestion que je conçois et utilise chaque jour, j'ai fait l'inverse : un seul tableau de bord, alimenté par les applications que j'utilise déjà.

Trois principes, valables pour n'importe quelle intégration :
▪ l'outil lit, il n'écrit pas dans les applications d'origine : la saisie reste là où elle est la plus simple ;
▪ un seul bouton « Synchroniser » lance toutes les sources et affiche l'état de chacune ; si l'une tombe en panne, les autres continuent ;
▪ chaque chiffre affiché dit d'où il vient.

Résultat : des moyennes, des tendances et des écarts qui restaient invisibles tant que chaque donnée vivait dans son application.

En entreprise, c'est pareil. Votre caisse, votre logiciel de paie, votre agenda partagé et votre CRM se parlent-ils, ou est-ce vous qui faites le lien ?

Votre métier a ses règles ? Parlons-en : lien en bio.

#OutilsSurMesure #Intégration #Automatisation #PME""")


def rendre(s, i):
    source = (IG / 'publications.html').read_text(encoding='utf-8')
    tete = source.split('<!-- ============ IG-01')[0]
    tete = tete.replace('<title>Publications Instagram IG-01 à IG-03</title>', f"<title>Publication Instagram {s['id']}</title>")
    corps = [f"\n<!-- ============ {s['id']} · {s['titre']} (d'après {s['li']}) ============ -->"] + ig.sur_mesure(s, i)
    page = (tete + '\n'.join(corps) + '\n\n</body>\n</html>\n').replace('../../../../assets/', '../../../../../assets/')
    tmp = ICI / f"_{s['id']}.html"
    tmp.write_text(page, encoding='utf-8')
    try:
        subprocess.run(['node', str(IG / 'rendre.mjs'), f"production/{tmp.name}"], check=True)
    finally:
        tmp.unlink()


if __name__ == '__main__':
    rendre(S, 0)
    print('\n'.join(f'{k + 1}. {a}' for k, a in enumerate(S['alt'])))
