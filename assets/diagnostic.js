// Test « Combien te coûte ta désorganisation ? » (/diagnostic/, lien court /jeu), pour Instagram et TikTok
// (étudiants et jeunes adultes, en tutoiement ; décisions de Quentin du 21/11/2026). Quatre thèmes universels : budget
// (avec conversion facultative en heures de travail, méthode du template Temps de vie), tâches, papiers, habitudes.
// Calcul pur (DIAG.calculer) testé par outils/templates/diagnostic.test.mjs ; interface en bas du fichier.
// Aucun chiffre extérieur : chaque résultat est une réponse saisie multipliée sur un an.
(function (racine) {
  'use strict';

  const PRODUITS = {
    papiers: { nom: 'Papiers du foyer', prix: '15 €', slug: 'papiers' },
    tempsDeVie: { nom: 'Temps de vie', prix: '19 €', slug: 'temps-de-vie' },
    budget: { nom: 'Mon Budget', prix: '15 €', slug: 'budget' },
    taches: { nom: 'Gestionnaire de tâches', prix: '19 €', slug: 'taches' },
    habitudes: { nom: "Suivi d'habitudes", prix: '12 €', slug: 'habitudes' },
  };

  function nombre(saisie) {
    if (saisie === null || saisie === undefined) return null;
    const t = String(saisie).replace(/[\s  €]/g, '').replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  const invalide = (n) => n === null || Number.isNaN(n) || n < 0;

  // Taux horaire net, méthode du template Temps de vie (templates/temps-de-vie/calculs.js, TDV_CALCUL.taux),
  // convention « temps contractuel » : revenu net annuel / (heures par semaine × 52). Défauts du template (35 h).
  function tauxHoraire(revenuMensuel, heuresSemaine) {
    const c = racine.TDV_CALCUL, base = racine.BASE;
    if (!c || !base || !base.defauts) return null;
    const t = c.taux({ revenuMensuel, heuresSemaine }, 'contrat', base.defauts);
    return t.horaire;
  }

  // r : réponses brutes ; passees : étapes passées. Renvoie { erreur, etape } ou le résultat.
  function calculer(r, passees = new Set()) {
    const res = { euros: 0, heures: 0, seances: 0, lignes: [], produits: PRODUITS };

    if (!passees.has('budget')) {
      const p = nombre(r.petits), a = nombre(r.abonnements);
      if (p === null && a === null) return { erreur: 'Indique au moins un montant (0 si rien), ou passe la question.', etape: 'budget' };
      if ((p !== null && invalide(p)) || (a !== null && invalide(a))) return { erreur: 'Indique des montants en euros, positifs.', etape: 'budget' };
      const an = (p || 0) * 52 + (a || 0) * 12;
      const parts = [];
      if (p) parts.push(`${euros(p)} par semaine × 52`);
      if (a) parts.push(`${euros(a)} d'abonnements par mois × 12`);
      res.euros = an;
      const rev = nombre(r.revenu);
      if (rev !== null && (Number.isNaN(rev) || rev < 0)) return { erreur: 'Indique ton revenu net par mois en euros, ou laisse le champ vide.', etape: 'budget' };
      const horaire = rev ? tauxHoraire(rev, 35) : null;
      if (horaire && an > 0) res.heuresTravail = an / horaire;
      res.lignes.push({ cle: 'budget', valeur: an, texte: `${euros(an)} par an`, detail: (parts.join(' + ') || 'Rien ne s\'envole : bravo.') + (res.heuresTravail ? `, soit ${heures(res.heuresTravail)} de travail (${euros(horaire)} net de l'heure, base 35 h par semaine)` : '') });
    }

    if (!passees.has('taches')) {
      const m = nombre(r.minutes);
      if (invalide(m) || m > 600) return { erreur: 'Indique un nombre de minutes par jour (0 si aucune), ou passe la question.', etape: 'taches' };
      const h = (m * 365) / 60;
      res.heures += h;
      res.lignes.push({ cle: 'taches', valeur: h, texte: `${heures(h)} par an`, detail: m ? `${m} min par jour × 365, soit ${jours(h)}` : 'Aucune minute perdue : bravo.' });
    }

    if (!passees.has('papiers')) {
      const f = nombre(r.recherches), m = nombre(r.minutesPapier);
      if (invalide(f) || !Number.isInteger(f) || f > 365) return { erreur: 'Indique un nombre de recherches par an (0 si jamais), ou passe la question.', etape: 'papiers' };
      if (f > 0 && (invalide(m) || m > 600)) return { erreur: 'Indique combien de minutes dure une recherche, à peu près.', etape: 'papiers' };
      const h = f > 0 ? (f * m) / 60 : 0;
      res.heures += h;
      res.lignes.push({ cle: 'papiers', valeur: h, texte: `${heures(h)} par an`, detail: f > 0 ? `${f} recherche${f > 1 ? 's' : ''} × ${m} min` : 'Tu retrouves tout du premier coup : bravo.' });
    }

    if (!passees.has('habitudes')) {
      const o = nombre(r.objectif), v = nombre(r.reel);
      if (invalide(o) || o > 7 || o === 0) return { erreur: 'Indique un objectif entre 1 et 7 fois par semaine, ou passe la question.', etape: 'habitudes' };
      if (invalide(v) || v > 7) return { erreur: 'Indique combien de fois tu la tiens vraiment (entre 0 et 7).', etape: 'habitudes' };
      const nomHab = String(r.habitude || '').trim().slice(0, 24) || 'ton habitude';
      const manquees = Math.max(0, o - v) * 52;
      res.seances = manquees;
      res.habitude = nomHab;
      res.lignes.push({ cle: 'habitudes', valeur: manquees, texte: `${entier(manquees)} séance${manquees > 1 ? 's' : ''} ratée${manquees > 1 ? 's' : ''} par an`, detail: manquees ? `${nomHab} : ${entier(o - v)} de moins que prévu chaque semaine × 52` : `${nomHab} : objectif tenu, bravo.` });
    }

    return res;
  }

  const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  function euros(n) { return `${fmt(n)} €`; }
  function entier(n) { return fmt(n); }
  function dec(n) { return (Math.round(n * 10) / 10).toLocaleString('fr-FR'); }
  function heures(h) { return `${fmt(h)} h`; }
  function jours(h) { const j = h / 8; return j >= 1 ? `${fmt(j)} journée${Math.round(j) > 1 ? 's' : ''} de 8 h` : 'moins d\'une journée de 8 h'; }

  // Phrase de synthèse du résultat (page et image de partage).
  function synthese(res) {
    const morceaux = [];
    if (res.euros > 0) morceaux.push(euros(res.euros));
    if (res.heures > 0) morceaux.push(`${heures(res.heures)} perdues`);
    if (res.seances > 0) morceaux.push(`${entier(res.seances)} séance${res.seances > 1 ? 's' : ''} ratée${res.seances > 1 ? 's' : ''}`);
    return morceaux;
  }

  racine.DIAG = { calculer, nombre, euros, heures, synthese, tauxHoraire, PRODUITS };

  // ---------- Interface ----------
  if (typeof document === 'undefined') return;

  function compter(chemin, titre) {
    try { if (racine.goatcounter && racine.goatcounter.count) racine.goatcounter.count({ path: chemin, title: titre, event: true }); } catch (e) { /* mesure facultative */ }
  }
  const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    let i = 0, debut = false, dernier = null;
    const passees = new Set();
    const lire = () => Object.fromEntries(new FormData(form).entries());

    function afficher() {
      etapes.forEach((e, k) => { e.hidden = k !== i; });
      barre.style.width = `${((i + 1) / etapes.length) * 100}%`;
      compte.textContent = `Question ${i + 1} sur ${etapes.length}`;
      btnSuivant.textContent = i === etapes.length - 1 ? 'Voir mon résultat' : 'Suivant';
      erreur.hidden = true;
    }

    function avancer(passer) {
      const cle = etapes[i].dataset.etape;
      if (!debut) { debut = true; compter('diagnostic-debut', 'Diagnostic : début'); }
      if (passer) passees.add(cle);
      else {
        passees.delete(cle);
        const autres = new Set(etapes.map((e) => e.dataset.etape).filter((c) => c !== cle));
        const v = calculer(lire(), autres);
        if (v.erreur) { erreur.textContent = v.erreur; erreur.hidden = false; return; }
      }
      if (i < etapes.length - 1) { i += 1; afficher(); etapes[i].querySelector('input')?.focus(); return; }
      terminer();
    }

    const titres = { papiers: 'Papiers : le temps à chercher', budget: 'Budget : ce qui s\'envole', taches: 'Tâches : le temps perdu', habitudes: 'Habitudes : les séances ratées' };
    const lienProduit = (p, cle) => `<a href="/essai/?t=${p.slug}" data-goatcounter-click="diagnostic-essai-${cle}" data-goatcounter-title="Diagnostic : essai ${p.nom}">Essayer ${p.nom} 14 jours, sans carte</a> · <a href="/catalogue/${p.slug}/">${p.prix}, achat unique</a>`;

    function terminer() {
      const res = calculer(lire(), passees);
      if (res.erreur) { i = etapes.findIndex((e) => e.dataset.etape === res.etape); afficher(); erreur.textContent = res.erreur; erreur.hidden = false; return; }
      dernier = res;
      etapes.forEach((e) => { e.hidden = true; });
      actions.hidden = true; compte.hidden = true; form.querySelector('.diag-progression').hidden = true;
      const m = synthese(res);
      form.querySelector('[data-total]').textContent = m.length ? m[0] : '0 €';
      const sous = [];
      if (res.heuresTravail && res.euros > 0) sous.push(`soit ${heures(res.heuresTravail)} de travail`);
      if (m.length > 1) sous.push(`et ${m.slice(1).join(' et ')}`);
      form.querySelector('[data-total-sous]').textContent = `${sous.length ? sous.join(', ') + ' ' : ''}par an, d'après tes réponses`;
      form.querySelector('[data-lignes]').innerHTML = res.lignes.map((l) => `<li class="${l.info ? 'info' : (l.valeur ? '' : 'nul')}"><span>${titres[l.cle]}</span><b>${echapper(l.texte)}</b><span>${echapper(l.detail)}</span><span>${lienProduit(PRODUITS[l.cle], l.cle)}</span>${l.cle === 'budget' && res.heuresTravail ? `<span>${lienProduit(PRODUITS.tempsDeVie, 'temps-de-vie')}</span>` : ''}</li>`).join('');
      form.querySelector('[data-rien]').hidden = m.length > 0;
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
      const f = (poids, taille) => `${poids} ${taille}px Outfit, sans-serif`;
      g.fillStyle = C.papier; g.fillRect(0, 0, W, H);
      g.fillStyle = C.jaune; g.beginPath(); g.arc(W - 90, 110, 190, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.bleu; g.fillRect(0, H - 420, 300, 300);
      g.fillStyle = C.rouge; g.beginPath(); g.moveTo(W, H - 420); g.lineTo(W, H - 120); g.lineTo(W - 300, H - 120); g.closePath(); g.fill();
      g.fillStyle = C.encre;
      g.font = f(700, 34); g.fillText('MON TEST QME', 96, 330);
      g.font = f(800, 84);
      ['Ma désorganisation', 'me coûte, par an :'].forEach((t, k) => g.fillText(t, 96, 450 + k * 96));
      const m = synthese(res);
      let y = 640;
      const couleurs = [C.encre, C.rouge, C.bleu];
      (m.length ? m : ['0 €']).forEach((txt, k) => {
        g.font = f(800, txt.length > 12 ? 104 : 130);
        const larg = Math.min(W - 192, g.measureText(txt).width + 64);
        g.fillStyle = couleurs[k]; g.fillRect(96, y, larg, 170);
        g.fillStyle = C.papier; g.fillText(txt, 128, y + 132, W - 256);
        y += 200;
      });
      g.fillStyle = C.encre; g.font = f(600, 40);
      if (res.heuresTravail && res.euros > 0) { g.fillText(`Mes ${euros(res.euros)} = ${heures(res.heuresTravail)} de travail`, 96, y + 20, W - 192); y += 60; }
      if (res.seances > 0) { g.fillText(`de ${res.habitude}`, 96, y + 20, W - 192); y += 60; }
      g.font = f(800, 72); g.fillText('Et toi ?', 96, H - 520);
      g.font = f(700, 40); g.fillText('Le test en 1 minute : qm-engineering.fr/jeu', 96, H - 460, W - 192);
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
      const m = synthese(dernier);
      const texte = `Ma désorganisation me coûte ${m.length ? m.join(', ') : 'presque rien'} par an. Et toi ? Le test en 1 minute :`;
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
