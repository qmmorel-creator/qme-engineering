"""IG-226 · F3 · Le calcul que personne ne fait n°2 : la règle de 72.
Un prix (exemple fictif) qui monte de 3 % par an : combien en 10 ans, et quand double-t-il ?
Calcul refait en code : python3 calcul.py (aucune dépendance). Exemples fictifs, ne remplace pas un conseil financier."""
from math import log, ceil

def fr(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")

R = 0.03
PRIX = 100.0  # prix de départ fictif

# Étape 1 : 10 ans à 3 % ne font pas 30 %
print("Étape 1 · 10 ans à 3 % par an, sur 100 € (exemple fictif)")
p = PRIX
for an in range(1, 11):
    hausse = p * R
    p += hausse
    print(f"  an {an:>2} : + {fr(hausse, 2)} € -> {fr(p, 2)} €")
total_10 = (1 + R) ** 10 - 1
print(f"  hausse cumulée sur 10 ans : {fr(total_10 * 100, 2)} % (et non 30 %)")
assert round(total_10 * 100, 1) == 34.4 and round(p, 2) == 134.39

# Étape 2 : temps de doublement exact
exact = log(2) / log(1 + R)
naif = 1 / R  # ce qu'on croit en additionnant : 100 % / 3 % par an
print(f"Étape 2 · doublement exact : ln 2 / ln 1,03 = {exact:.4f} ans -> {fr(exact)} ans")
print(f"  en additionnant 3 % par an, on croirait {fr(naif)} ans")
print(f"  vérification : 1,03^23 = {fr(1.03**23, 4)} (< 2) ; 1,03^24 = {fr(1.03**24, 4)} (> 2) -> doublé au cours de la 24e année")
assert round(exact, 1) == 23.4 and 1.03 ** 23 < 2 < 1.03 ** 24 and round(naif) == 33

# Étape 3 : règle de 72
print(f"Étape 3 · règle de 72 : 72 / 3 = {72 / 3:g} ans (écart avec l'exact : {fr(72 / 3 - exact, 2)} an)")
assert 72 / 3 == 24 and abs(72 / 3 - exact) < 1

# Règle à garder : tableau
attendu = {2: (36, 35.0), 3: (24, 23.4), 4: (18, 17.7), 6: (12, 11.9), 8: (9, 9.0)}
print("Règle à garder · années pour doubler ≈ 72 / taux")
print("  taux | règle de 72 | exact ln 2 / ln(1 + r)")
for t, (r72_att, ex_att) in attendu.items():
    r72 = 72 / t
    ex = log(2) / log(1 + t / 100)
    print(f"  {t} %  | {r72:g} ans      | {ex:.3f} -> {fr(ex)} ans")
    assert r72 == r72_att and round(ex, 1) == ex_att, (t, r72, ex)

# Dans les deux sens (exemples fictifs) : abonnement à +4 %/an, épargne à 2 %/an
for nom, t in (("abonnement fictif +4 %/an", 4), ("épargne fictive à 2 %/an", 2)):
    ex = log(2) / log(1 + t / 100)
    print(f"Dans les deux sens · {nom} : x2 en {fr(ex)} ans (règle de 72 : {72 / t:g} ans)")
print("Toutes les assertions passent.")
