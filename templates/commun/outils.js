// Outils purs communs aux applications QME de la gamme T69–T77 (aucun accès au DOM ni au stockage).
// Chargé par le navigateur (window.QME_OUTILS) et par les tests Node (vm). Ne rien y mettre de métier.
// Conventions : dates locales « AAAA-MM-JJ » (comparables comme des chaînes), montants en centimes entiers.
(function (racine) {
  'use strict';

  // ---------- Dates ----------
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = String(s).split('-').map(Number); return new Date(a, m - 1, j); };
  const estDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(versDate(s)) === s;
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  function ajoutMois(s, n) {
    const [a, m, j] = s.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    const an = Math.floor(total / 12), mo = total - an * 12 + 1;
    return `${an}-${deux(mo)}-${deux(Math.min(j, new Date(an, mo, 0).getDate()))}`;
  }

  // ---------- Nombres ----------
  // Lecture tolérante d'un nombre saisi : « 12,5 », « 12.5 », « 1 234,56 », « 3 m² » → 12.5 / 1234.56 / 3.
  // Renvoie null si vide ou illisible. Négatifs refusés sauf { negatif: true }.
  function lireNombre(saisie, { negatif = false } = {}) {
    if (typeof saisie === 'number') return Number.isFinite(saisie) && (negatif || saisie >= 0) ? saisie : null;
    let s = String(saisie ?? '').trim().replace(/[\s  ]/g, '').replace(/[a-zA-Z²³%€°/]+$/u, '');
    if (!s) return null;
    s = s.replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(s) && !/^-?\d+\.$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || (!negatif && n < 0)) return null;
    return n;
  }
  // Arrondi décimal sûr (évite 0,1 + 0,2 = 0,30000000000000004).
  const arrondi = (n, d = 2) => { const f = 10 ** d; return Math.round((n + Number.EPSILON) * f) / f; };
  // 1234.5 → « 1 234,5 » ; décimales fixes ou maximales.
  function fmtNombre(n, { dec = 2, fixe = false } = {}) {
    if (n === null || n === undefined || Number.isNaN(n)) return '–';
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: fixe ? dec : 0, maximumFractionDigits: dec }).replace(/ | /g, ' ');
  }
  // Centimes : lecture et affichage.
  // « 12,99 », « 12.99 € », « 1 234,5 » → centimes ; null si vide, illisible, négatif ou plus de 2 décimales.
  function lireMontant(saisie) {
    const s = String(saisie ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
  }
  function euros(c, { centimes = true, signe = false } = {}) {
    if (c === null || c === undefined || Number.isNaN(c)) return '–';
    const neg = c < 0;
    const n = Math.abs(Math.round(c));
    const texte = centimes
      ? `${String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${deux(n % 100)}`
      : String(Math.round(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${neg ? '−' : signe && n ? '+' : ''}${texte} €`;
  }
  const saisieMontant = (c) => (c === null || c === undefined ? '' : `${Math.floor(Math.abs(c) / 100)},${deux(Math.abs(c) % 100)}`);
  const saisieNombre = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

  // ---------- Normalisation (restauration tolérante d'une sauvegarde) ----------
  const texte = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
  function entier(v, min, max, defaut) { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : defaut; }
  function nombre(v, min, max, defaut) { const n = typeof v === 'number' ? v : lireNombre(v, { negatif: min < 0 }); return n !== null && Number.isFinite(n) && n >= min && n <= max ? n : defaut; }
  const dateOuNull = (v) => (estDate(v) ? v : null);
  const choix = (v, liste, defaut) => (liste.includes(v) ? v : defaut);
  const tableau = (v) => (Array.isArray(v) ? v : []);
  let compteur = 0;
  const nouvelId = () => `${Date.now().toString(36)}${(compteur++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const idValide = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());

  // ---------- CSV (séparateur « ; », virgule décimale, BOM pour les tableurs français) ----------
  const champCsv = (v) => { const s = String(v ?? ''); return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const nombreCsv = (n, dec = 2) => (n === null || n === undefined || Number.isNaN(n) ? '' : String(arrondi(n, dec)).replace('.', ','));
  const centimesCsv = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const versCsv = (lignes) => '﻿' + lignes.map((l) => l.map(champCsv).join(';')).join('\r\n');
  // Lecture d'un CSV produit par versCsv (tests aller-retour, import éventuel).
  function lireCsv(s) {
    s = String(s).replace(/^﻿/, '');
    const lignes = []; let ligne = [], champ = '', guillemets = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (guillemets) {
        if (c === '"' && s[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c;
      } else if (c === '"') guillemets = true;
      else if (c === ';') { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else champ += c;
    }
    if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes;
  }

  // Taille d'un état sérialisé (octets UTF-8), pour respecter la limite du stockage en ligne.
  const tailleJson = (o) => new TextEncoder().encode(JSON.stringify(o)).length;
  const TAILLE_MAX = 880_000;

  racine.QME_OUTILS = {
    iso, versDate, estDate, ajout, ecart, ajoutMois,
    lireNombre, arrondi, fmtNombre, lireMontant, euros, saisieMontant, saisieNombre,
    texte, entier, nombre, dateOuNull, choix, tableau, nouvelId, idValide,
    champCsv, nombreCsv, centimesCsv, versCsv, lireCsv, tailleJson, TAILLE_MAX,
  };
})(typeof window !== 'undefined' ? window : globalThis);
