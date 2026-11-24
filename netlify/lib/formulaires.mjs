// Formulaires Netlify du site (idée de template, concours) : chaque envoi reçu est gardé dans le store des essais
// (formulaire/<date>-<id>) pour Nexora Optim › QME, lu par GET /api/essai/essais (jeton de lecture). Le formulaire de
// contact n'est pas repris (décision du retrait #1223 côté Nexora maintenue). Champs techniques et pot de miel retirés.
import { FORMULAIRES_SUIVIS } from './essais.mjs';

const TECHNIQUES = new Set(['ip', 'user_agent', 'referrer', 'site_web', 'bot-field', 'form-name', 'form_name']);
export const CONSERVATION_FORMULAIRES_JOURS = 365;

export function ficheFormulaire(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const form = String(p.form_name || p.data?.['form-name'] || '').trim();
  if (!FORMULAIRES_SUIVIS.includes(form)) return null;
  const champs = {};
  for (const [k, v] of Object.entries(p.data || {})) {
    if (TECHNIQUES.has(k) || v == null || typeof v === 'object' && !v.url) continue;
    const t = typeof v === 'object' ? String(v.url) : String(v);
    if (t.trim()) champs[String(k).slice(0, 60)] = t.trim().slice(0, 2000);
  }
  const date = /^\d{4}-\d{2}-\d{2}T/.test(String(p.created_at)) ? String(p.created_at) : new Date().toISOString();
  const id = String(p.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || Math.random().toString(36).slice(2, 12);
  return { cle: `formulaire/${date.slice(0, 10)}-${id}`, fiche: { id, formulaire: form, date, champs } };
}

export async function enregistrerFormulaire(essais, payload, maintenant = Date.now) {
  const f = ficheFormulaire(payload);
  if (!f) return false;
  await essais.set(f.cle, f.fiche);
  const limite = new Date(maintenant() - CONSERVATION_FORMULAIRES_JOURS * 86_400_000).toISOString().slice(0, 10);
  for (const cle of await essais.lister('formulaire/')) if (cle.slice('formulaire/'.length, 'formulaire/'.length + 10) < limite) await essais.supprimer(cle);
  return true;
}
