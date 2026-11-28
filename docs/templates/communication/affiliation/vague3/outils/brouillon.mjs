// Vague 3 d'affiliation : construit un brouillon conforme (HTML + texte + signature Bandeau + opposition).
// Usage : node brouillon.mjs <createurs.json> <index|email> [ouverture] > out.json
// Le créateur doit porter `ouverture` (1re phrase du mail, à la 2e personne, vouvoiement) sauf si passée en argument.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const CATALOGUE = {
  voyage: { nom: 'Planificateur de voyage', desc: "itinéraire par étapes, hébergement de chaque nuit, transports, activités jour par jour, budget prévu et réel, dépenses partagées et qui doit quoi, bagages et documents à prévoir" },
  voiture: { nom: 'Carnet de voiture', desc: "entretiens faits et à venir (à la date ou au kilométrage, la première atteinte), contrôle technique, dépenses, consommation plein à plein, coût au kilomètre et historique imprimable pour la revente" },
  animal: { nom: "Suivi d'un animal de compagnie", desc: "soins récurrents aux intervalles fixés avec le vétérinaire, prochaines échéances et retards, courbe de poids, visites et traitements, frais par mois et par an, carnet imprimable" },
  travaux: { nom: 'Pilote de travaux maison', desc: "devis d'artisans comparés par poste, budget prévu, engagé et payé, planning des interventions et réserves de fin de travaux" },
  entretien: { nom: 'Entretien de la maison', desc: "échéances calculées (chaudière, ramonage, VMC, toiture), obligations sourcées, historique et coûts" },
  demenagement: { nom: 'Déménagement', desc: "rétroplanning jusqu'au jour J, démarches et changements d'adresse, cartons numérotés et retrouvés pièce par pièce" },
  'garde-manger': { nom: 'Garde-manger et dates de péremption', desc: "DLC et DDM de ce que vous avez en stock, ce qu'il faut consommer en priorité, gaspillage suivi" },
  repas: { nom: 'Repas de la semaine et liste de courses', desc: "menus de la semaine, liste rangée par rayon, quantités additionnées selon les portions, placard et restes déduits, 100 recettes de base" },
  'course-a-pied': { nom: "Plan d'entraînement course à pied", desc: "allures calculées depuis un chrono de référence, plan par semaines placé sur vos jours, séances cochées avec ressenti et distance réelle, semaine allégée, volume hebdomadaire, export vers l'agenda" },
  bebe: { nom: 'Suivi du bébé', desc: "tétées et biberons, sommeil avec minuteur, couches, mesures, résumés par jour et par semaine, à deux parents, récapitulatif imprimable pour le rendez-vous (outil de notes, ne remplace pas l'avis du médecin)" },
  potager: { nom: 'Calendrier du potager', desc: "vos cultures avec leurs fenêtres de semis, de plantation et de récolte, ce qu'il y a à faire cette semaine, la frise des 12 mois, la rotation des familles sur vos parcelles, le journal et le bilan des récoltes" },
  'gestion-classe': { nom: 'Gestion de classe', desc: "notes et moyennes pondérées, compétences, appréciations et bulletins imprimables, par classe et par période" },
  progression: { nom: 'Progression pédagogique', desc: "calendrier de l'année (vacances saisies, jours fériés calculés), créneaux de chaque classe, séquences et séances faites ou reportées, avancement réel face au prévu, date de fin projetée, cahier de textes imprimable" },
  quiz: { nom: 'Banque de questions et quiz', desc: "questions étiquetées (QCM, vrai ou faux, réponse courte) avec difficulté et explication, quiz tirés par étiquette, sujet imprimable et corrigé séparé, correction automatique, statistiques par question" },
  'assemblee-generale': { nom: 'Assemblée générale et vie statutaire', desc: "membres votants à jour de cotisation, rétroplanning depuis le délai de convocation, convocation et ordre du jour, feuille de présence et pouvoirs, quorum et majorités calculés, procès-verbal imprimable, mandats du bureau" },
  benevoles: { nom: 'Bénévoles et planning des créneaux', desc: "qui tient quel créneau, sans trou ni doublon : postes, disponibilités, inscriptions, relances et planning imprimable" },
  subventions: { nom: 'Subventions', desc: "dossiers par financeur et par projet, pièces à fournir, échéances de dépôt, de réponse, de versement et de bilan, reste à percevoir, dépenses justificatives et trame du bilan" },
  'location-saisonniere': { nom: 'Location saisonnière', desc: "calendrier des réservations par canal, ménage et linge entre deux séjours, taxe de séjour, revenus nets par canal et par mois" },
  'gestion-locative': { nom: 'Gestion locative', desc: "biens, baux et locataires, loyers encaissés mois par mois avec retards calculés, quittances, relances, révision du loyer selon l'IRL saisi, régularisation des charges" },
  copropriete: { nom: 'Charges et AG de copropriété', desc: "appels de fonds, charges par lot, régularisation annuelle, travaux votés et votes en assemblée générale" },
  musculation: { nom: 'Carnet de musculation et cross-training', desc: "séances et WOD avec leur score, volume par semaine et par groupe musculaire, records détectés automatiquement, courbes de progression, minuteur AMRAP, EMOM, For Time et intervalles hors ligne" },
  nutrition: { nom: 'Nutrition et dépense énergétique', desc: "journal des repas avec la table Ciqual de l'Anses, calories et macros, dépense énergétique du jour, menus types et liste de courses" },
  lecture: { nom: 'Suivi culturel', desc: "livres, livres audio, films, séries et podcasts au même endroit, recherche des titres intégrée, progression, rythme et date de fin estimée, objectifs de l'année au jour près" },
};
// Packs publiés sur Gumroad au 27/11/2026 (Pack Voyage dépublié : jamais cité).
export const PACKS = {
  'Pack Maison et famille': 'Pack Maison et famille', 'pack-forme': 'Pack Forme', 'Pack Forme': 'Pack Forme',
  'Pack Propriétaire': 'Pack Propriétaire', 'Pack Ma voiture': 'Pack Ma voiture',
};

// Appartenance aux packs publiés (outils/packs/donnees.mjs, Gumroad au 27/11/2026).
const DANS = {
  'Pack Maison et famille': ['entretien', 'repas', 'garde-manger', 'bebe', 'animal', 'potager'],
  'Pack Forme': ['course-a-pied', 'repas', 'musculation', 'nutrition'],
  'Pack Propriétaire': ['travaux', 'entretien', 'location-saisonniere', 'gestion-locative', 'copropriete'],
  'Pack Ma voiture': ['voiture'],
  'Pack Écoles et formateurs': ['gestion-classe', 'progression', 'quiz'],
  'Pack Associations et clubs': ['assemblee-generale', 'benevoles', 'subventions'],
};
export function phrasePack(ordre) {
  let best = null;
  for (const [pack, ids] of Object.entries(DANS)) {
    const n = ordre.filter((p) => ids.includes(p));
    if (n.includes(ordre[0]) && (!best || n.length > best.n.length)) best = { pack, n };
  }
  if (!best) return '';
  if (best.n.length === ordre.length) return ordre.length > 1 ? `Ces outils font aussi partie du ${best.pack}, disponible sur le site.` : `Il fait aussi partie du ${best.pack}, disponible sur le site.`;
  const noms = best.n.map((p) => CATALOGUE[p].nom);
  return noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)} font aussi partie du ${best.pack}, disponible sur le site.` : `${noms[0]} fait aussi partie du ${best.pack}, disponible sur le site.`;
}
// Objet court centré sur le créateur (décision de Quentin du 27/11/2026), 70 caractères au plus.
export const BENEFICE = {
  voyage: ['préparer vos voyages', 'vos voyages'], voiture: ["suivre l'entretien de votre véhicule", 'votre véhicule'],
  animal: ['suivre la santé de votre animal', 'votre animal'], travaux: ['piloter votre chantier', 'votre chantier'],
  entretien: ["l'entretien de votre maison", 'votre maison'], demenagement: ['réussir votre déménagement', 'votre déménagement'],
  'garde-manger': ['ne plus rien perdre au frigo', 'votre garde-manger'], repas: ['vos menus et vos courses', 'vos menus'],
  'course-a-pied': ['préparer votre prochaine course', 'votre prochaine course'], bebe: ['le suivi de bébé', 'bébé'],
  potager: ['planifier votre potager', 'votre potager'], musculation: ['suivre vos séances et vos records', 'vos séances'],
  nutrition: ['suivre votre nutrition', 'votre nutrition'], lecture: ['suivre vos lectures', 'vos lectures'], 'gestion-classe': ['vos notes et vos bulletins', 'votre classe'],
  progression: ['suivre votre progression de l\'année', 'votre progression'], quiz: ['créer vos quiz', 'vos quiz'],
  'assemblee-generale': ['préparer votre assemblée générale', 'votre AG'], benevoles: ['planifier vos bénévoles', 'vos bénévoles'],
  subventions: ['suivre vos subventions', 'vos subventions'], 'location-saisonniere': ['gérer votre location saisonnière', 'votre location'],
  'gestion-locative': ['gérer vos locations', 'vos locations'], copropriete: ['suivre votre copropriété', 'votre copropriété'],
};
export function objet(c, demo) {
  const nom = (c.nomObjet || '').trim();
  if (!nom) throw new Error(`nomObjet manquant : ${c.nom}`);
  const essais = c.niche === 'agence'
    ? [`${nom} × QME : partenariat à la commission pour vos créateurs`, `${nom} × QME : partenariat à la commission`]
    : [`${nom} × QME : un outil pour ${c.benefice || BENEFICE[demo][0]}`, `${nom} × QME : un outil pour ${BENEFICE[demo][1]}`];
  const o = essais.find((x) => [...x].length <= 70);
  if (!o) throw new Error(`objet trop long : ${essais.at(-1)}`);
  return o;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

export function construire(c, sig) {
  const ouverture = c.ouverture;
  if (!ouverture) throw new Error(`ouverture manquante : ${c.nom}`);
  const outils = c.produits.filter((p) => CATALOGUE[p]);
  const demo = CATALOGUE[c.demo] ? c.demo : outils[0];
  if (!outils.length || !demo) throw new Error(`aucun outil connu : ${c.nom}`);
  const ordre = [demo, ...outils.filter((p) => p !== demo)].slice(0, 3);
  const src = (c.compte || c.nom).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'createur';
  const lienDemo = `https://qm-engineering.fr/templates/${demo}/?demo&utm_source=${src}&utm_medium=email&utm_campaign=affiliation-vague3`;
  const agence = c.niche === 'agence';
  const dest = c.email.trim();
  const enc = encodeURIComponent(dest);
  const P = (t) => `<p>${t}</p>`;
  const li = ordre.map((p) => `<li style="margin-bottom:8px"><b>${esc(CATALOGUE[p].nom)}</b> : ${esc(CATALOGUE[p].desc)}.</li>`).join('');
  const blocs = [
    P('Bonjour,'),
    P(esc(ouverture)),
    P("Je suis Quentin Morel, ingénieur : je conçois des outils en ligne prêts à l&#39;emploi (QME)."),
    P(agence
      ? "J&#39;ai conçu des outils du quotidien qui peuvent intéresser l&#39;audience de vos créateurs. Ils s&#39;ouvrent dans le navigateur, sur téléphone comme sur ordinateur, sans abonnement, entièrement en français et avec des prix en euros :"
      : "J&#39;ai conçu plusieurs outils qui pourraient servir à votre audience. Ils s&#39;ouvrent dans le navigateur, sur téléphone comme sur ordinateur, sans abonnement, entièrement en français et avec des prix en euros :"),
    `<ul style="padding-left:20px">${li}</ul>`,
    P(`Pour vous faire une idée en une minute, sans inscription : <a href="${lienDemo.replace(/&/g, '&amp;')}" style="color:#1a4fd6">essayer la démo ${esc(CATALOGUE[demo].nom)}</a>.`),
    phrasePack(ordre) ? P(esc(phrasePack(ordre))) : '',
    P(agence
      ? "QME est une jeune activité : nous cherchons des partenaires pour nous soutenir dans notre évolution, tout en y trouvant leur compte. Le partenariat fonctionne uniquement à la commission sur chaque vente faite par le lien personnel du créateur, sans budget fixe, sans obligation de publication ni texte imposé."
      : "Je vous propose un partenariat simple : un accès gratuit pour juger sur pièce, puis votre lien personnel, avec une commission sur chaque vente. Aucune obligation de publication, aucun texte imposé."),
    P('<b>Tout le fonctionnement du partenariat tient en une page : <a href="https://qm-engineering.fr/partenariat/" style="color:#1a4fd6">qm-engineering.fr/partenariat</a>.</b>'),
    P(agence
      ? "Auriez-vous, dans votre réseau, des créateurs à qui cela pourrait convenir ? Une réponse à ce message suffit. Sinon, merci de m&#39;avoir lu."
      : "Si l&#39;idée vous intéresse, répondez simplement à ce message. Sinon, merci de m&#39;avoir lu."),
    P('Bonne journée,<br>Quentin'),
  ].filter(Boolean).join('');
  const corpsHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">${blocs}</div>`;
  const opposition = `<p style="margin:24px 0 0;font-size:12px;color:#6b6660">Vous ne souhaitez plus recevoir d'informations de QME&nbsp;? <a href="https://qm-engineering.fr/ne-plus-recevoir/?email=${enc}" style="color:#6b6660">Ne plus recevoir les informations</a> (ou répondez simplement «&nbsp;stop&nbsp;»).</p>`;
  const htmlBody = `${corpsHtml}\n${sig.html}\n${opposition}`;
  const texte = corpsHtml
    .replace(/<li[^>]*>/g, '- ').replace(/<\/li>/g, '\n').replace(/<\/ul>/g, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, (_, u, t) => `${t} (${u.replace(/&amp;/g, '&')})`)
    .replace(/<br>/g, '\n').replace(/<\/p>/g, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    + `\n\nQuentin Morel\nQME · Quentin Morel Engineering\nqm-engineering.fr\n\nNe plus recevoir les informations : https://qm-engineering.fr/ne-plus-recevoir/?email=${enc} (ou répondez simplement « stop »).`;
  const subject = objet(c, demo);
  for (const t of ['https://qm-engineering.fr/partenariat/', `ne-plus-recevoir/?email=${enc}`, 'cid:att5', 'affiliation-vague3']) if (!htmlBody.includes(t)) throw new Error(`contrôle : ${t} absent (${c.nom})`);
  if (/\d+\s?%/.test(corpsHtml)) throw new Error(`taux dans le mail (${c.nom})`);
  return { to: [dest], subject, htmlBody, body: texte, attachments: sig.attachments };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [f, cle, ouv] = process.argv.slice(2);
  const liste = JSON.parse(readFileSync(f, 'utf8'));
  const c = /^\d+$/.test(cle) ? liste[+cle] : liste.find((x) => x.email.toLowerCase() === cle.toLowerCase());
  if (ouv) c.ouverture = ouv;
  const sig = JSON.parse(execFileSync('node', ['docs/templates/communication/signature/brouillon-gmail.mjs', '--json'], { cwd: '/home/user/qme-engineering' }));
  process.stdout.write(JSON.stringify(construire(c, sig)));
}
