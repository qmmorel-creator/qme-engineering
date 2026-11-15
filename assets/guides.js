// Guides QME (/guides/) : calculateur « budget à deux » et impression de la check-list de réception.
// Le calculateur reprend le moteur de répartition de l'application Budget commun
// (templates/budget-commun/regles.js, window.BCM, chargé avant ce fichier) : montants en centimes entiers,
// méthode du plus fort reste, la somme des parts vaut exactement le montant saisi.
// Aucune donnée n'est envoyée ni enregistrée : tout se calcule dans la page.
(function (racine) {
  'use strict';

  // revenu1, revenu2, depenses : saisies texte (« 2 345,67 ») ; renvoie les parts en centimes ou { erreur }.
  function calculer(BCM, revenu1, revenu2, depenses) {
    const r1 = BCM.versCentimes(revenu1), r2 = BCM.versCentimes(revenu2), d = BCM.versCentimes(depenses);
    if (r1 === null || r2 === null || d === null) return { erreur: 'Saisissez des montants en euros, par exemple 1 850 ou 1 234,56.' };
    if (r1 <= 0 || r2 <= 0) return { erreur: 'Les deux revenus doivent être supérieurs à zéro pour le calcul au prorata.' };
    if (d <= 0) return { erreur: 'Indiquez le montant des dépenses communes.' };
    const personnes = [{ id: 'p1', revenu: r1 }, { id: 'p2', revenu: r2 }];
    const egale = BCM.repartir(d, personnes, 'egale').quotes;
    const prorata = BCM.repartir(d, personnes, 'prorata').quotes;
    return {
      depenses: d,
      egale: [egale.p1, egale.p2],
      prorata: [prorata.p1, prorata.p2],
      // Ce qui reste à chacun une fois sa part payée, et la part de son revenu que cela représente.
      resteEgale: [r1 - egale.p1, r2 - egale.p2],
      resteProrata: [r1 - prorata.p1, r2 - prorata.p2],
      effortEgale: [egale.p1 / r1, egale.p2 / r2],
      effortProrata: [prorata.p1 / r1, prorata.p2 / r2],
    };
  }

  const pourcent = (x) => `${(Math.round(x * 1000) / 10).toString().replace('.', ',')} %`;

  function brancherCalculateur(form) {
    const BCM = racine.BCM;
    const sortie = form.querySelector('[data-resultats]');
    const erreur = form.querySelector('[data-erreur]');
    if (!BCM || !sortie) return;
    const ecrire = (cle, valeur) => { const el = form.querySelector(`[data-${cle}]`); if (el) el.textContent = valeur; };
    function maj() {
      const r = calculer(BCM, form.revenu1.value, form.revenu2.value, form.depenses.value);
      if (r.erreur) {
        sortie.hidden = true;
        // Pas d'erreur affichée tant qu'un champ est vide : la personne est en train de saisir.
        const vide = [form.revenu1, form.revenu2, form.depenses].some((c) => !c.value.trim());
        erreur.textContent = vide ? '' : r.erreur;
        erreur.hidden = vide;
        return;
      }
      erreur.hidden = true;
      sortie.hidden = false;
      ['egale', 'prorata'].forEach((mode) => {
        const reste = mode === 'egale' ? r.resteEgale : r.resteProrata;
        const effort = mode === 'egale' ? r.effortEgale : r.effortProrata;
        r[mode].forEach((c, i) => {
          ecrire(`${mode}-${i + 1}`, BCM.euros(c));
          ecrire(`${mode}-reste-${i + 1}`, BCM.euros(reste[i]));
          ecrire(`${mode}-effort-${i + 1}`, pourcent(effort[i]));
        });
        ecrire(`${mode}-total`, BCM.euros(r[mode][0] + r[mode][1]));
      });
    }
    form.addEventListener('input', maj);
    form.addEventListener('submit', (e) => { e.preventDefault(); maj(); });
    maj();
  }

  function brancherImpression(bouton) {
    bouton.hidden = false;
    bouton.addEventListener('click', () => {
      document.body.classList.add('imprimer-checklist');
      const fin = () => { document.body.classList.remove('imprimer-checklist'); window.removeEventListener('afterprint', fin); };
      window.addEventListener('afterprint', fin);
      window.print();
    });
  }

  racine.QMEGuides = { calculer };

  if (typeof document !== 'undefined') {
    const demarrer = () => {
      document.querySelectorAll('form[data-calculateur]').forEach(brancherCalculateur);
      document.querySelectorAll('[data-imprimer-checklist]').forEach(brancherImpression);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
    else demarrer();
  }
})(typeof window !== 'undefined' ? window : globalThis);
