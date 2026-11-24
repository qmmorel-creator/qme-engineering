// IG-217 · F8 « Défi chronométré » : le calcul de l'outil fictif du fleuriste, utilisé tel quel par IG-217.html
// et vérifié par verifier.mjs. Outil et données fictifs (défi de démonstration).
(function (g) {
  g.FLEURISTE = {
    samedis: [180, 210, 195, 215], // roses vendues les 4 derniers samedis (tiges)
    reservations: 36,              // tiges déjà réservées pour samedi (bouquets commandés)
    stock: 70,                     // tiges en chambre froide aujourd'hui
    fanees: 0.12,                  // part du stock qui sera fanée d'ici samedi
    casse: 0.08,                   // part de la livraison perdue (casse, tiges abîmées)
    botte: 25,                     // le grossiste livre par bottes de 25 tiges
  };
  g.calculFleuriste = (d) => {
    const prevision = Math.round(d.samedis.reduce((a, b) => a + b, 0) / d.samedis.length);
    const besoin = prevision + d.reservations;
    const utilisable = Math.floor(d.stock * (1 - d.fanees));
    const aCouvrir = Math.max(0, besoin - utilisable);
    const aCommander = Math.ceil(aCouvrir / (1 - d.casse));
    const bottes = Math.ceil(aCommander / d.botte);
    return { prevision, besoin, utilisable, aCouvrir, aCommander, bottes, tiges: bottes * d.botte };
  };
})(typeof window !== 'undefined' ? window : globalThis);
