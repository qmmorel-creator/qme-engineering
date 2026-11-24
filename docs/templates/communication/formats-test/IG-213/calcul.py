"""IG-213 · F3 · Le calcul que personne ne fait n°1 : 10 minutes perdues par jour, sur une année de travail.
Calcul refait en code : python3 calcul.py (aucune dépendance)."""
from datetime import date, timedelta

def paques(a):  # algorithme de Meeus/Jones/Butcher (calendrier grégorien)
    b, c = divmod(a, 100); d = a % 19
    e = (19 * d + b - b // 4 - (b - (b + 8) // 25 + 1) // 3 + 15) % 30
    f = (32 + 2 * (b % 4) + 2 * (c // 4) - e - c % 4) % 7
    g = (d + 11 * e + 22 * f) // 451
    m, j = divmod(e + f - 7 * g + 114, 31)
    return date(a, m, j + 1)

AN = 2027
p = paques(AN)
# 11 jours fériés légaux (Code du travail, art. L3133-1)
feries = {date(AN,1,1): "1er janvier", p + timedelta(1): "lundi de Pâques", date(AN,5,1): "1er mai",
          date(AN,5,8): "8 mai", p + timedelta(39): "Ascension", p + timedelta(50): "lundi de Pentecôte",
          date(AN,7,14): "14 juillet", date(AN,8,15): "15 août", date(AN,11,1): "1er novembre",
          date(AN,11,11): "11 novembre", date(AN,12,25): "25 décembre"}
jours = [date(AN,1,1) + timedelta(i) for i in range(365)]
semaine = [j for j in jours if j.weekday() < 5]
feries_semaine = sorted(j for j in feries if j.weekday() < 5)
ouvres = len(semaine) - len(feries_semaine)
CONGES = 25  # 5 semaines de congés payés = 25 jours ouvrés (service-public.fr F2258)
travailles = ouvres - CONGES
print(f"Pâques {AN} : {p}")
print(f"Jours du lundi au vendredi en {AN} : {len(semaine)}")
print(f"Fériés tombant en semaine : {len(feries_semaine)} -> " + ", ".join(feries[j] for j in feries_semaine))
print(f"Jours ouvrés : {ouvres} ; moins {CONGES} jours de congés = {travailles} jours travaillés")
SEMAINE_H = 35  # durée légale hebdomadaire (Code du travail, art. L3121-27)
for m in (1, 5, 10, 15, 30):
    tot = travailles * m
    print(f"{m:>2} min/jour x {travailles} = {tot} min = {tot//60} h {tot%60:02d} min = {tot/60/SEMAINE_H:.2f} semaine(s) de 35 h")
tot = travailles * 10
assert tot == 2290 and tot // 60 == 38 and tot % 60 == 10 and tot / 60 > SEMAINE_H
print(f"10 min/jour : {tot/60/7:.2f} journées de 7 h ; sur 10 ans : {tot*10/60:.0f} h = {tot*10/60/SEMAINE_H:.1f} semaines de 35 h")
