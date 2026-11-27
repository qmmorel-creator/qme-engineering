"""IG-228 · F3 · Le calcul que personne ne fait n°4 : abonnement mensuel ou annuel, à partir de combien de mois l'annuel est rentable.
Calcul refait en code : python3 calcul.py (aucune dépendance). Exemples fictifs (aucune marque, aucun service réel)."""
from decimal import Decimal as D, ROUND_CEILING, ROUND_HALF_UP

def fr(x, d=2):
    q = D(1).scaleb(-d)
    return f"{x.quantize(q, rounding=ROUND_HALF_UP)}".replace(".", ",")

MENSUEL, ANNUEL = D("9.99"), D("99.99")

# Étape 1 : sur 12 mois, l'annuel gagne
douze = MENSUEL * 12
eco = douze - ANNUEL
pct = eco / douze * 100
print("Étape 1 · 9,99 € par mois ou 99,99 € par an (exemple fictif)")
print(f"  12 mois en mensuel : 12 × 9,99 = {fr(douze)} € ; annuel : {fr(ANNUEL)} €")
print(f"  économie sur 12 mois : {fr(eco)} € (− {fr(pct, 1)} %)")
assert douze == D("119.88") and eco == D("19.89") and fr(pct, 1) == "16,6"

# Étape 2 : l'annuel se paie d'avance ; arrêt au bout de 6 mois
six = MENSUEL * 6
perte = ANNUEL - six
print(f"Étape 2 · arrêt au bout de 6 mois : mensuel {fr(six)} € contre annuel {fr(ANNUEL)} € -> {fr(perte)} € perdus")
assert six == D("59.94") and perte == D("40.05")

# Étape 3 : le seuil
seuil = ANNUEL / MENSUEL
print(f"Étape 3 · seuil = 99,99 ÷ 9,99 = {fr(seuil, 4)} mois")
for m in range(1, 13):
    print(f"  {m:2d} mois : mensuel {fr(MENSUEL * m):>6} € · annuel {fr(ANNUEL)} € -> {'annuel gagnant' if MENSUEL * m > ANNUEL else 'mensuel gagnant'}")
assert MENSUEL * 10 == D("99.90") and MENSUEL * 10 < ANNUEL      # 10 mois : le mensuel coûte encore moins
assert MENSUEL * 11 == D("109.89") and MENSUEL * 11 > ANNUEL     # 11 mois : l'annuel devient gagnant
assert fr(seuil, 2) == "10,01"

# Règle à garder : l'annuel est rentable si vous le gardez plus de (annuel ÷ mensuel) mois
def mois_mini(m, a):
    """Plus petit nombre entier de mois où le mensuel cumulé dépasse l'annuel."""
    n = (a / m).to_integral_value(rounding=ROUND_CEILING)
    if m * n == a:
        n += 1  # égalité : il faut dépasser strictement
    assert m * n > a and m * (n - 1) <= a
    return int(n)

print("Règle à garder · seuil = prix annuel ÷ prix mensuel (arrondi au mois entier supérieur)")
exemples = [("4.99", "49.99", 11, "9.89"), ("9.99", "99.99", 11, "19.89"),
            ("14.99", "119.99", 9, "59.89"), ("7.99", "59.99", 8, "35.89")]
for m, a, n_att, eco_att in exemples:
    m, a = D(m), D(a)
    n = mois_mini(m, a)
    e = m * 12 - a
    assert n == n_att and e == D(eco_att), (m, a, n, e)
    print(f"  {fr(m)} €/mois · {fr(a)} €/an : seuil {fr(a / m, 2)} -> au moins {n} mois ; économie sur 12 mois {fr(e)} € (− {fr(e / (m * 12) * 100, 1)} %)")
print("Toutes les assertions passent.")
