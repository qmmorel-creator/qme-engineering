"""IG-102 · Carrousel « Méthode » adapté de LI-29 (Une boîte mail qui se vide toute seule, sans IA). Seuls les faits du Google Doc LI-29 sont repris ; aucune
capture d'outil client, aucune donnée réelle. Gabarit sur mesure de construire_ig_06_33.py.

Usage, depuis la racine du dépôt :
  python3 docs/templates/communication/instagram/production/IG-102.py
  node docs/templates/communication/instagram/rendre.mjs production/IG-102.html
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
S = dict(id='IG-102', slug='boite-mail', sourcil='Méthode · sans IA',
  h1="Une boîte mail qui se vide <mark>toute seule</mark>.", sous="Sans intelligence artificielle : avec des règles.",
  p2=("La boîte de réception est souvent la liste de tâches la plus longue de l'entreprise.",
      "Et la plus mal rangée."),
  p2_bas="J'ai exploré dix façons de l'organiser sans IA. Celle que je retiens : la péremption.",
  v3=('La péremption', 'Chaque mail a une durée de vie.', [
      ('carre', '2 jours', "Pour une notification automatique.", None),
      ('rond', '7 jours', "Pour une lettre d'information.", None),
      ('quart', '14 jours', "Pour un message d'une personne.", None)],
      "Ni épinglé ni transformé en tâche : il s'archive tout seul à l'expiration."),
  v4=('Et ensuite', 'Rien ne se perd.', [
      ("Rien n'est supprimé", "Le mail archivé reste trouvable par la recherche. Chaque lundi, un bilan liste ce qui est parti sans action."),
      ('Les tournées', "Le courrier arrive à 8 h, 13 h et 18 h, sauf pour une liste de proches qui passe en direct."),
      ("L'aiguillage", "Des règles dans l'ordre : la première qui correspond l'emporte, et on voit pourquoi.")]),
  v5=('Combien de mails « à lire plus tard » dorment chez vous ?', ['Des règles, pas de magie', 'Une boîte qui ne garde que les décisions']))

ALT = [
    "Titre « Une boîte mail qui se vide toute seule. » Sans intelligence artificielle : avec des règles.",
    "Fond noir : la boîte de réception est souvent la liste de tâches la plus longue de l'entreprise, et la plus mal rangée. Parmi dix façons de l'organiser sans IA, celle retenue : la péremption.",
    "La péremption : chaque mail a une durée de vie, 2 jours pour une notification automatique, 7 jours pour une lettre d'information, 14 jours pour un message d'une personne ; s'il n'est ni épinglé ni transformé en tâche, il s'archive à l'expiration.",
    "Rien ne se perd : le mail archivé reste trouvable et un bilan du lundi liste ce qui est parti sans action ; les tournées à 8 h, 13 h et 18 h ; l'aiguillage par règles dans l'ordre.",
    "Fond rouge : combien de mails « à lire plus tard » dorment chez vous ? Des règles, pas de magie ; une boîte qui ne garde que les décisions. Votre métier a ses règles ? Parlons-en : lien en bio.",
]

if __name__ == '__main__':
    ecrire(S['id'], [f"\n<!-- ============ {S['id']} · Une boîte mail qui se vide toute seule, sans IA (d'après LI-29) ============ -->"]
           + ig.sur_mesure(S, 1))
    print(json.dumps(ALT, ensure_ascii=False))
