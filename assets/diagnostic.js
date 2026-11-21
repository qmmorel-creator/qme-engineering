// Test « Combien vous coûte votre désorganisation ? » (/diagnostic/, lien court /jeu).
// Calcul pur (DIAG.calculer) testé par outils/templates/diagnostic.test.mjs ; interface en bas du fichier.
// Aucun chiffre inventé : chaque montant vient des réponses saisies, des jours ouvrés du template TJM
// (TJM_CALCUL, templates/tjm/calculs.js) et de l'indemnité légale de 40 € (art. L441-10 et D441-5 C. com.).
(function (racine) {
  'use strict';

  const ANNEE = 2027;
  const INDEMNITE = 40;
  const PRODUITS = {
    abonnements: { nom: 'Suivi des abonnements', prix: '9 €', slug: 'abonnements' },
    tjm: { nom: 'Calculateur de TJM freelance', prix: '12 €', slug: 'tjm' },
    retards: { nom: 'Relance des impayés', prix: '19 €', slug: 'impayes' },
    couple: { nom: 'Gestion Dépenses Communes', prix: '15 €', slug: 'budget-commun' },
  };

  function nombre(saisie) {
    if (saisie === null || saisie === undefined) return null;
    const t = String(saisie).replace(/[\s  €]/g, '').replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  function joursOuvres(annee) {
    const c = racine.TJM_CALCUL;
    return c ? c.joursOuvres(annee).ouvres : null;
  }

  // Jours facturables : ouvrés − congés − jours non facturables par semaine travaillée.
  function joursFacturables(ouvres, conges, nonFactSemaine) {
    const travailles = Math.max(0, ouvres - conges);
    return Math.max(0, travailles - Math.round((travailles / 5) * nonFactSemaine));
  }

  // r : réponses brutes ; passees : ensemble des étapes passées. Renvoie { erreur } ou le résultat.
  function calculer(r, passees = new Set(), ouvres = joursOuvres(ANNEE)) {
    const lignes = [];
    let couple = null;

    if (!passees.has('abonnements')) {
      const m = nombre(r.abonnements);
      if (m === null || Number.isNaN(m) || m < 0) return { erreur: 'Indiquez un montant mensuel (0 si aucun), ou passez la question.', etape: 'abonnements' };
      lignes.push({ cle: 'abonnements', montant: m * 12, detail: `${euros(m)} par mois × 12` });
    }

    if (!passees.has('tjm')) {
      if (!r.methode) return { erreur: 'Choisissez votre méthode, ou passez la question.', etape: 'tjm' };
      const ca = nombre(r.ca), conges = nombre(r.conges), nf = nombre(r.nonfact);
      if (ca === null || Number.isNaN(ca) || ca <= 0) return { erreur: "Indiquez le chiffre d'affaires visé, en euros HT par an.", etape: 'tjm' };
      if (conges === null || Number.isNaN(conges) || conges < 0 || conges > ouvres) return { erreur: 'Indiquez un nombre de jours de congés valide.', etape: 'tjm' };
      if (nf === null || Number.isNaN(nf) || nf < 0 || nf > 5) return { erreur: 'Indiquez entre 0 et 5 jours non facturables par semaine.', etape: 'tjm' };
      const fact = joursFacturables(ouvres, conges, nf);
      const tjmJuste = fact > 0 ? ca / fact : null;
      if (r.methode === 'ouvres') {
        const tjmPratique = ca / ouvres;
        lignes.push({ cle: 'tjm', montant: ca - tjmPratique * fact, detail: `TJM de ${euros(tjmPratique)} (÷ ${ouvres} jours) × ${fact} jours vraiment facturables, au lieu de ${euros(ca)} visés`, tjmJuste, fact });
      } else if (r.methode === 'aucune') {
        lignes.push({ cle: 'tjm', montant: 0, info: true, detail: `Pour atteindre ${euros(ca)}, il faut au moins ${tjmJuste ? euros(tjmJuste) : '–'} par jour sur ${fact} jours facturables.`, tjmJuste, fact });
      } else {
        lignes.push({ cle: 'tjm', montant: 0, detail: `Vous divisez par les bons jours : ${fact} jours facturables, ${tjmJuste ? euros(tjmJuste) : '–'} par jour.`, tjmJuste, fact });
      }
    }

    if (!passees.has('retards')) {
      const n = nombre(r.retards);
      if (n === null || Number.isNaN(n) || n < 0 || !Number.isInteger(n)) return { erreur: 'Indiquez un nombre entier de factures (0 si aucune), ou passez la question.', etape: 'retards' };
      if (n > 0 && !r.indemnite) return { erreur: "Dites si vous réclamez l'indemnité de 40 €.", etape: 'retards' };
      const due = n > 0 && r.indemnite !== 'oui';
      lignes.push({ cle: 'retards', montant: due ? n * INDEMNITE : 0, detail: due ? `${n} facture${n > 1 ? 's' : ''} × ${INDEMNITE} € d'indemnité non réclamée, pénalités de retard en plus` : (n === 0 ? 'Aucune facture payée en retard.' : 'Vous réclamez déjà l\'indemnité : bien joué.') });
    }

    if (!passees.has('couple')) {
      if (!r.regle) return { erreur: 'Choisissez votre façon de partager, ou passez la question.', etape: 'couple' };
      const r1 = nombre(r.revenu1), r2 = nombre(r.revenu2), d = nombre(r.depenses);
      if ([r1, r2, d].some((x) => x === null || Number.isNaN(x) || x < 0) || r1 + r2 <= 0) return { erreur: 'Indiquez les deux revenus et les dépenses communes, par mois.', etape: 'couple' };
      const p1 = (d * r1) / (r1 + r2), p2 = d - p1;
      const bas = Math.min(r1, r2), partBasProrata = (d * bas) / (r1 + r2);
      couple = { regle: r.regle, egale: d / 2, prorata1: p1, prorata2: p2, ecartAn: (d / 2 - partBasProrata) * 12, egaux: r1 === r2 };
    }

    const total = lignes.reduce((s, l) => s + l.montant, 0);
    return { total, lignes, couple, produits: PRODUITS };
  }

  function euros(n) {
    const arrondi = Math.round(n);
    return arrondi.toLocaleString('fr-FR').replace(/ | /g, ' ') + ' €';
  }

  racine.DIAG = { calculer, joursFacturables, nombre, euros, PRODUITS, ANNEE, INDEMNITE };

  // ---------- Interface ----------
  if (typeof document === 'undefined') return;

  function compter(chemin, titre) {
    try { if (racine.goatcounter && racine.goatcounter.count) racine.goatcounter.count({ path: chemin, title: titre, event: true }); } catch (e) { /* mesure facultative */ }
  }

  function demarrer() {
    const form = document.querySelector('[data-diag]');
    if (!form) return;
    const etapes = [...form.querySelectorAll('[data-etape]')];
    const barre = form.querySelector('[data-barre]');
    const compte = form.querySelector('[data-compte]');
    const erreur = form.querySelector('[data-erreur]');
    const actions = form.querySelector('[data-actions]');
    const resultat = form.querySelector('[data-resultat]');
    const btnSuivant = form.querySelector('[data-suivant]');
    const ouvres = joursOuvres(ANNEE);
    if (ouvres) form.querySelector('[data-ouvres]').textContent = ouvres;
    let i = 0, debut = false, dernier = null;
    const passees = new Set();

    function lire() {
      const fd = new FormData(form);
      return Object.fromEntries(fd.entries());
    }

    function afficher() {
      etapes.forEach((e, k) => { e.hidden = k !== i; });
      barre.style.width = `${((i + 1) / etapes.length) * 100}%`;
      compte.textContent = `Question ${i + 1} sur ${etapes.length}`;
      btnSuivant.textContent = i === etapes.length - 1 ? 'Voir mon résultat' : 'Suivant';
      erreur.hidden = true;
    }

    function verifierEtape(cle) {
      // Ne valide que l'étape affichée : les suivantes sont marquées passées le temps du contrôle.
      const tmp = new Set(passees);
      etapes.forEach((e) => { if (e.dataset.etape !== cle) tmp.add(e.dataset.etape); });
      tmp.delete(cle);
      return calculer(lire(), tmp, ouvres);
    }

    function avancer(passer) {
      const cle = etapes[i].dataset.etape;
      if (!debut) { debut = true; compter('diagnostic-debut', 'Diagnostic : début'); }
      if (passer) passees.add(cle);
      else {
        passees.delete(cle);
        const v = verifierEtape(cle);
        if (v.erreur) { erreur.textContent = v.erreur; erreur.hidden = false; return; }
      }
      if (i < etapes.length - 1) { i += 1; afficher(); etapes[i].querySelector('input')?.focus(); return; }
      terminer();
    }

    function lienProduit(p, cle) {
      return `<a href="/essai/?t=${p.slug}" data-goatcounter-click="diagnostic-essai-${cle}" data-goatcounter-title="Diagnostic : essai ${p.nom}">Essayer ${p.nom} 14 jours, sans carte</a> · <a href="/catalogue/${p.slug}/">${p.prix}, achat unique</a>`;
    }

    const titres = { abonnements: 'Abonnements oubliés', tjm: 'TJM calculé sur 254 jours', retards: 'Indemnités de retard non réclamées' };

    function terminer() {
      const res = calculer(lire(), passees, ouvres);
      if (res.erreur) { i = etapes.findIndex((e) => e.dataset.etape === res.etape); afficher(); erreur.textContent = res.erreur; erreur.hidden = false; return; }
      dernier = res;
      etapes.forEach((e) => { e.hidden = true; });
      actions.hidden = true; compte.hidden = true; form.querySelector('.diag-progression').hidden = true;
      form.querySelector('[data-total]').textContent = euros(res.total);
      const ul = form.querySelector('[data-lignes]');
      ul.innerHTML = res.lignes.map((l) => {
        const p = PRODUITS[l.cle];
        const titre = l.cle === 'tjm' && l.info ? 'TJM sans méthode' : (l.cle === 'tjm' && !l.montant ? 'TJM bien calculé' : titres[l.cle]);
        return `<li class="${l.montant ? '' : 'nul'}"><span>${titre}</span><b>${l.info ? 'à calculer' : euros(l.montant) + ' par an'}</b><span>${l.detail}</span><span>${lienProduit(p, l.cle)}</span></li>`;
      }).join('');
      const bloc = form.querySelector('[data-couple]');
      if (res.couple) {
        const c = res.couple, p = PRODUITS.couple;
        let texte;
        if (c.egaux) texte = 'Revenus égaux : 50/50 et prorata donnent la même chose.';
        else if (c.regle === 'egale') texte = `À 50/50, la personne qui gagne le moins verse <b>${euros(c.ecartAn)} de plus par an</b> qu'au prorata des revenus (${euros(c.egale)} par mois chacun, contre ${euros(c.prorata1)} et ${euros(c.prorata2)}). Ce n'est pas une perte pour le foyer, donc ce n'est pas compté dans le total : c'est une question d'équilibre, à décider à deux.`;
        else if (c.regle === 'prorata') texte = `Au prorata, chacun consacre la même part de son revenu : ${euros(c.prorata1)} et ${euros(c.prorata2)} par mois.`;
        else texte = `Pour comparer : 50/50 = ${euros(c.egale)} chacun ; prorata = ${euros(c.prorata1)} et ${euros(c.prorata2)} par mois.`;
        bloc.innerHTML = `<p><b>Budget à deux</b> · ${texte}</p><p>${lienProduit(p, 'couple')}</p>`;
        bloc.hidden = false;
      } else bloc.hidden = true;
      form.querySelector('[data-rien]').hidden = res.total > 0 || res.lignes.some((l) => l.info);
      resultat.hidden = false;
      resultat.scrollIntoView({ block: 'start' });
      compter('diagnostic-resultat', 'Diagnostic : résultat affiché');
    }

    // ---------- Image de partage (story 1080 × 1920, charte Bauhaus) ----------
    async function image() {
      const res = dernier;
      const W = 1080, H = 1920;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      try { await document.fonts.load('800 100px Outfit'); } catch (e) { /* police par défaut */ }
      const C = { papier: '#F0EDE6', encre: '#141414', rouge: '#D9302A', jaune: '#F5B400', bleu: '#1D4E89' };
      g.fillStyle = C.papier; g.fillRect(0, 0, W, H);
      // Formes Bauhaus
      g.fillStyle = C.jaune; g.beginPath(); g.arc(W - 90, 110, 190, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.bleu; g.fillRect(0, H - 420, 300, 300);
      g.fillStyle = C.rouge; g.beginPath(); g.moveTo(W, H - 420); g.lineTo(W, H - 120); g.lineTo(W - 300, H - 120); g.closePath(); g.fill();
      const f = (poids, taille) => `${poids} ${taille}px Outfit, sans-serif`;
      g.fillStyle = C.encre; g.textBaseline = 'alphabetic';
      g.font = f(700, 34); g.fillText('MON TEST QME', 96, 330);
      g.font = f(800, 84);
      ['Ma désorganisation', 'me coûte'].forEach((t, k) => g.fillText(t, 96, 450 + k * 96));
      // Bandeau du total
      const total = euros(res.total);
      g.font = f(800, 190);
      const larg = Math.min(W - 192, g.measureText(total).width + 72);
      g.fillStyle = C.encre; g.fillRect(96, 640, larg, 250);
      g.fillStyle = C.papier; g.fillText(total, 132, 830, W - 264);
      g.fillStyle = C.encre; g.font = f(800, 84); g.fillText('par an.', 96, 1010);
      // Détail
      g.font = f(600, 40);
      let y = 1120;
      res.lignes.filter((l) => l.montant > 0).forEach((l) => { g.fillText(`${titres[l.cle]} : ${euros(l.montant)}`, 96, y, W - 192); y += 62; });
      // Appel
      g.font = f(800, 72); g.fillText('Et vous ?', 96, H - 520);
      g.font = f(700, 40); g.fillText('Le test en 2 minutes : qm-engineering.fr/jeu', 96, H - 460, W - 192);
      return new Promise((ok) => cv.toBlob(ok, 'image/png'));
    }

    async function telecharger() {
      const blob = await image();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'mon-test-qme.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      compter('diagnostic-image', 'Diagnostic : image téléchargée');
    }

    async function partager() {
      const url = 'https://qm-engineering.fr/jeu';
      const texte = `Ma désorganisation me coûte environ ${euros(dernier.total)} par an. Et vous ? Le test en 2 minutes :`;
      compter('diagnostic-partage', 'Diagnostic : partage');
      try {
        const blob = await image();
        const fichier = new File([blob], 'mon-test-qme.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [fichier] })) { await navigator.share({ files: [fichier], text: `${texte} ${url}` }); return; }
        if (navigator.share) { await navigator.share({ text: texte, url }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(`${texte} ${url}`); form.querySelector('[data-copie]').hidden = false; } catch (e) { telecharger(); }
    }

    function recommencer() {
      form.reset(); passees.clear(); i = 0; dernier = null;
      resultat.hidden = true; actions.hidden = false; compte.hidden = false; form.querySelector('.diag-progression').hidden = false;
      form.querySelector('[data-copie]').hidden = true;
      afficher(); form.scrollIntoView({ block: 'start' });
    }

    btnSuivant.addEventListener('click', () => avancer(false));
    form.querySelector('[data-passer]').addEventListener('click', () => avancer(true));
    form.querySelector('[data-image]').addEventListener('click', telecharger);
    form.querySelector('[data-partager]').addEventListener('click', partager);
    form.querySelector('[data-recommencer]').addEventListener('click', recommencer);
    form.addEventListener('submit', (e) => { e.preventDefault(); avancer(false); });
    afficher();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})(typeof window !== 'undefined' ? window : globalThis);
