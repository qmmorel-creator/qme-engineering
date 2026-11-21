// Défi QME à envoyer à un pote (/defi/) : 8 questions tirées de assets/quiz-qme.js, un score, un lien à envoyer.
// Le lien ne porte que le prénom (facultatif) et le score : rien n'est envoyé au serveur ni stocké.
// Logique pure (DEFI.*) testée par outils/templates/defi.test.mjs ; interface en bas du fichier.
(function (racine) {
  'use strict';

  const SITE = 'https://qm-engineering.fr/defi/';
  const UTM = 'utm_source=defi&utm_medium=partage&utm_campaign=defi';

  // Questions du défi : celles du quiz qui ont une bonne réponse (le sondage est exclu).
  const questions = (quiz) => (quiz || []).filter((q) => Number.isInteger(q.bonne));

  // Prénom affichable : lettres (accents compris), espaces, tirets et apostrophes, 20 caractères au plus.
  function nettoyerPrenom(p) {
    return String(p || '').normalize('NFC').replace(/[^\p{L}\p{M}' -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  }

  // Lit un défi reçu dans l'adresse (?de=Léa&s=6). Renvoie null si absent ou invalide.
  function lireDefi(recherche, total) {
    const prm = new URLSearchParams(recherche || '');
    if (!prm.has('s')) return null;
    const brut = prm.get('s');
    if (!/^\d{1,2}$/.test(brut)) return null;
    const score = Number(brut);
    if (score > total) return null;
    return { prenom: nettoyerPrenom(prm.get('de')), score };
  }

  function lienDefi(prenom, score) {
    const p = nettoyerPrenom(prenom);
    return `${SITE}?${p ? `de=${encodeURIComponent(p)}&` : ''}s=${score}&${UTM}`;
  }

  function verdict(score, total) {
    const r = total ? score / total : 0;
    if (r === 1) return 'Sans faute. Tu pourrais donner des cours.';
    if (r >= 0.75) return 'Très bien. Tu tiens la route.';
    if (r >= 0.5) return 'Pas mal, mais il y a des trous dans la raquette.';
    return 'Aïe. Heureusement, il y a des outils pour ça.';
  }

  // Compare ton score à celui du pote qui t'a défié.
  function comparer(moi, defi) {
    const nom = defi.prenom || 'Ton pote';
    if (moi > defi.score) return { issue: 'gagne', texte: `Tu bats ${nom} : ${moi} contre ${defi.score}.` };
    if (moi < defi.score) return { issue: 'perdu', texte: `${nom} gagne : ${defi.score} contre ${moi}. Revanche ?` };
    return { issue: 'egalite', texte: `Égalité avec ${nom} : ${moi} partout.` };
  }

  racine.DEFI = { questions, nettoyerPrenom, lireDefi, lienDefi, verdict, comparer, SITE };

  // ---------- Interface ----------
  if (typeof document === 'undefined') return;

  function compter(chemin, titre) {
    try { if (racine.goatcounter && racine.goatcounter.count) racine.goatcounter.count({ path: chemin, title: titre, event: true }); } catch (e) { /* mesure facultative */ }
  }
  const $ = (s, el = document) => el.querySelector(s);
  const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function demarrer() {
    const zone = $('[data-defi]');
    if (!zone) return;
    const Q = questions(racine.QUIZ_QME);
    const recu = lireDefi(location.search, Q.length);
    let i = 0, score = 0, prenom = '';

    const accueil = $('[data-accueil]', zone), jeu = $('[data-jeu]', zone), fin = $('[data-fin]', zone);
    if (recu) {
      $('[data-recu]', zone).hidden = false;
      $('[data-recu-texte]', zone).textContent = `${recu.prenom || 'Ton pote'} a fait ${recu.score}/${Q.length}. À toi de faire mieux.`;
      compter('defi-recu', 'Défi : lien reçu ouvert');
    }

    function poser() {
      const q = Q[i];
      $('[data-compte]', jeu).textContent = `Question ${i + 1} sur ${Q.length} · ${q.theme}`;
      $('[data-barre]', jeu).style.width = `${(i / Q.length) * 100}%`;
      $('[data-question]', jeu).textContent = q.question;
      const choix = $('[data-choix]', jeu);
      choix.innerHTML = q.choix.map((c, k) => `<button type="button" class="defi-choix" data-k="${k}"><b>${'ABCD'[k]}</b><span>${echapper(c)}</span></button>`).join('');
      $('[data-correction]', jeu).hidden = true;
      choix.querySelector('button')?.focus();
    }

    function repondre(k) {
      const q = Q[i];
      const boutons = [...jeu.querySelectorAll('.defi-choix')];
      if (boutons.some((b) => b.disabled)) return;
      boutons.forEach((b, n) => { b.disabled = true; if (n === q.bonne) b.classList.add('bon'); else if (n === k) b.classList.add('faux'); });
      const juste = k === q.bonne;
      if (juste) score += 1;
      const corr = $('[data-correction]', jeu);
      $('[data-verdict]', corr).textContent = juste ? 'Bonne réponse' : `Raté : ${q.choix[q.bonne]}`;
      corr.classList.toggle('juste', juste);
      $('[data-grand]', corr).textContent = q.grand;
      $('[data-explication]', corr).textContent = q.texte;
      $('[data-suivante]', corr).textContent = i === Q.length - 1 ? 'Voir mon score' : 'Question suivante';
      corr.hidden = false;
      $('[data-suivante]', corr).focus();
    }

    function terminer() {
      jeu.hidden = true; fin.hidden = false;
      $('[data-score]', fin).textContent = `${score}/${Q.length}`;
      $('[data-score-verdict]', fin).textContent = verdict(score, Q.length);
      const duel = $('[data-duel]', fin);
      if (recu) { const c = comparer(score, recu); duel.textContent = c.texte; duel.dataset.issue = c.issue; duel.hidden = false; } else duel.hidden = true;
      const produits = [];
      for (const q of Q) if (q.slugProduit && !produits.some((p) => p.slug === q.slugProduit)) produits.push({ slug: q.slugProduit, nom: q.produit });
      $('[data-produits]', fin).innerHTML = produits.map((p) => `<li><a href="/essai/?t=${p.slug}" data-goatcounter-click="defi-essai-${p.slug}" data-goatcounter-title="Défi : essai ${echapper(p.nom)}">${echapper(p.nom)}</a> · 14 jours d'essai, sans carte</li>`).join('');
      fin.scrollIntoView({ block: 'start' });
      $('[data-envoyer]', fin).focus();
      compter('defi-fin', `Défi : terminé (${score}/${Q.length})`);
    }

    async function envoyer() {
      const url = lienDefi(prenom, score);
      const texte = `J'ai fait ${score}/${Q.length} au défi QME. T'es capable de faire mieux ?`;
      compter('defi-partage', 'Défi : envoi à un pote');
      try { if (navigator.share) { await navigator.share({ text: texte, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      const note = $('[data-copie]', fin);
      try { await navigator.clipboard.writeText(`${texte} ${url}`); note.textContent = 'Lien copié : colle-le à ton pote.'; } catch (e) { note.textContent = url; }
      note.hidden = false;
    }

    $('[data-commencer]', zone).addEventListener('click', () => {
      prenom = nettoyerPrenom($('[name=prenom]', zone).value);
      accueil.hidden = true; jeu.hidden = false; i = 0; score = 0; poser();
      compter('defi-debut', 'Défi : début');
    });
    $('[data-choix]', jeu).addEventListener('click', (e) => { const b = e.target.closest('.defi-choix'); if (b) repondre(Number(b.dataset.k)); });
    $('[data-suivante]', jeu).addEventListener('click', () => { if (i < Q.length - 1) { i += 1; poser(); } else terminer(); });
    $('[data-envoyer]', fin).addEventListener('click', envoyer);
    $('[data-rejouer]', fin).addEventListener('click', () => { fin.hidden = true; jeu.hidden = false; i = 0; score = 0; $('[data-copie]', fin).hidden = true; poser(); zone.scrollIntoView({ block: 'start' }); });
    $('[data-prenom-form]', zone).addEventListener('submit', (e) => { e.preventDefault(); $('[data-commencer]', zone).click(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})(typeof window !== 'undefined' ? window : globalThis);
