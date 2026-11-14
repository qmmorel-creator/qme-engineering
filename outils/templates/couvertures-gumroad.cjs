// Couvertures Gumroad (1280 × 720) au style Pastel, une par template, à partir des captures du site.
// Lancer depuis la racine du dépôt avec un serveur sur le port 8899 : python3 -m http.server 8899 --directory .
// Usage : node couvertures.cjs [dossier de sortie] (défaut : assets/ du dépôt)
const { chromium } = require('playwright');
const fs = require('fs');
const R = process.cwd();
const OUT = process.argv[2] || `${R}/assets`;
const T = {
  'auto-ecole': ["Gestion d'auto-école", 'Chaque leçon à sa place, chaque heure comptée.', 'Planning · élèves · véhicules · coût par heure'],
  budget: ['Budget du foyer', 'Chaque euro a une place.', 'Enveloppes · prévu et réel · flux du mois'],
  'budget-commun': ['Budget commun', 'Qui doit combien à qui.', 'Prorata des revenus · parts · un virement pour équilibrer'],
  'compte-rendu': ["Compte rendu · plan d'actions", "Chaque action suivie jusqu'au bout.", 'Décisions, actions datées, reprises à la réunion suivante'],
  'cout-revient': ['Coût de revient · prix par client', 'Sais-tu ce que te coûte une heure ?', 'Prix plancher, prix conseillé, rentabilité par client'],
  crm: ['CRM freelance', "Personne à relancer n'est oublié.", 'Relances du jour · affaires · factures suivies'],
  devis: ['Générateur de devis', 'Des devis justes au centime.', 'Catalogue · remises · TVA · mentions vérifiées'],
  evenementiel: ['Pilote événementiel', 'Tous tes événements, un seul pilote.', 'Rétroplanning · budget et acomptes · invités · jour J'],
  flotte: ['Gestion de flotte', 'Ta flotte, sans échéance oubliée.', 'Réservations · entretiens · contrôles · coût au km'],
  gantt: ['Planning Gantt rapide', 'Ton planning en une ligne par tâche.', 'Liens · jours fériés calculés · chemin critique · A3'],
  inscriptions: ['Inscriptions associatives', 'Chaque place, chaque famille, chaque euro.', "Liste d'attente · quotient familial · échéances · appel"],
  mariage: ['Organisateur de mariage', 'Le grand jour, sans le grand désordre.', 'Rétroplanning · budget · invités · plan de table'],
  'micro-entreprise': ['Micro-entreprise', 'Ton livre des recettes, à jour.', 'Cotisations estimées · seuils de TVA · export CSV'],
  'non-conformites': ['Registre des non-conformités', "Chaque écart traité jusqu'au bout.", 'Constat · 5 pourquoi · actions · vérification'],
  nutrition: ['Nutrition et dépense', 'Ce que tu manges, face à ce que tu dépenses.', 'Table Ciqual · dépense du jour · menus'],
  'parc-informatique': ['Gestion de parc informatique', "Qui a quoi, jusqu'à quand.", 'Inventaire · affectations · licences · garanties'],
  patrimoine: ['Inventaire valorisé', 'Que valent vraiment tes affaires ?', 'Valeur actuelle · revente frais déduits · objets qui dorment'],
  planner: ['Planner horaire', 'Chaque heure a sa place.', 'Blocs de 30 min · glisser-déposer · prévu / réalisé'],
  prospection: ['Prospection B2B', 'Relancer au bon moment.', 'Pipeline · cadences · scripts · conversion'],
  reserves: ['Levée de réserves', 'Chaque réserve levée, contrôlée, signée.', 'Lots · entreprises · retards · PV imprimable'],
  'secret-santa': ['Secret Santa · cadeau de Noël', 'Même l\'organisateur ne sait pas.', 'Inscription par lien · exclusions · tirage secret · gratuit'],
  revision: ['Planning de révision', 'Réviser au bon moment.', "J+1, J+3, J+7, J+14, J+30 · jusqu'à l'examen"],
  'temps-de-vie': ['Temps de vie', 'Combien d\'heures de travail pour ça ?', 'Dépense → heures · mode de vie · scénarios A/B/C'],
  taches: ['Gestionnaire de tâches', "Tout noter. Faire l'essentiel.", 'Boîte de réception · triage · focus du jour'],
  tjm: ['Calculateur de TJM', "Ton tarif, à l'euro près.", 'Objectif · jours facturables · statut · seuils'],
  travaux: ['Pilote de travaux maison', 'Tes travaux, devis par devis.', 'Devis comparés · budget · planning · réserves'],
  tresorerie: ['Trésorerie prévisionnelle · 12 mois', "Voir le creux avant qu'il arrive.", 'Prévu, réalisé, 3 scénarios · alerte sous ton seuil'],
  habitudes: ["Suivi d'habitudes et routines", "Un geste par jour.", "À cocher ou chiffrées · jours non applicables · séries"],
  entretien: ["Entretien de la maison", "Rien d'oublié, chaque saison.", "Échéances calculées · obligations sourcées · historique"],
  dettes: ["Remboursement de dettes", "Une date de fin, enfin.", "Boule de neige · avalanche · date de fin · pointage"],
  abonnements: ["Suivi des abonnements", "Ce que tu paies, chaque mois.", "Coût mensuel et annuel · prélèvements · à décider avant le …"],
  'notes-de-frais': ["Notes de frais et indemnités kilométriques", "Chaque euro avancé, retrouvé.", "Justificatifs · barème kilométrique · note du mois en PDF"],
  impayes: ["Relance des impayés", "Chaque facture payée à temps.", "Retard en jours · pénalités calculées · relances par palier"],
  onboarding: ["Onboarding et offboarding salarié", "Personne n'oublie rien.", "Checklists par profil · J-15 à J+90 · matériel remis et rendu"],
  'appel-decouverte': ["Préparateur d'appel découverte", "Prépare l'appel. Mène-le. Conclus.", "84 questions par phase · objections · score de qualification · prochaine étape datée"],
  visa: ['Circuit de visa des documents', 'Chaque visa dans les délais.', 'Indices · VSO, VAO, REF · relances prêtes'],
  'stocks': ["Stocks et inventaire", "Le bon stock, au bon moment.", "Alertes de seuil · liste à commander · coût moyen · inventaire"],
  'location-saisonniere': ["Location saisonnière", "Tes logements, toujours prêts.", "Calendrier · ménage · taxe de séjour · net par canal"],
  'leasing': ["Simulateur leasing ou achat", "Ta voiture, au vrai prix.", "Comptant · crédit · LOA · LLD : le coût total net côte à côte"],
  'conges': ["Suivi des congés et absences", "Qui est là, qui part, et combien il reste.", "Soldes calculés · demandes · calendrier d'équipe"],
  'tableau-annuel': ["Tableau de bord annuel · roue de vie", "Ton année, domaine par domaine.", "Roue de vie · objectifs et résultats clés · revue chaque trimestre"],
  'epargne': ["Objectif d'épargne · fonds d'urgence", "Chaque euro a un but.", "Fonds d'urgence en mois de dépenses · date d'atteinte · scénarios"],
  'pilotage-pme': ["Tableau de bord de pilotage PME", "Tes chiffres, face à tes objectifs.", "45 indicateurs expliqués · écarts · alertes · revue du mois"],
  'maintenance': ["Maintenance préventive · GMAO légère", "Chaque machine entretenue à temps.", "Date, compteur ou premier atteint · bons d'intervention · coût par équipement"],
};
// Trois ambiances qui alternent : [fond du bloc capture, grande forme, petite forme, pastille]
const AMB = [
  ['#D8E4F0', '#F8DCD3', '#E8B93A', '#D8E4F0', '#22476E'],
  ['#F8DCD3', '#FBEBC2', '#2E5A88', '#F8DCD3', '#8A3322'],
  ['#FBEBC2', '#D8E4F0', '#E58C74', '#FBEBC2', '#6E5310'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function page(slug, i) {
  const [sur, h1, sous] = T[slug];
  const cat = fs.readFileSync(`${R}/catalogue/${slug}/index.html`, 'utf8');
  const ecran = cat.match(/<img class="ecran" src="\/assets\/([^"?]+)/)[1];
  const tel = cat.match(/<img class="tel" src="\/assets\/([^"?]+)/)[1];
  const [bloc, forme1, forme2, pastille, pastilleTexte] = AMB[i % 3];
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/fonts/outfit.css">
<style>
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#FBF7F1;font-family:Outfit,sans-serif;color:#24221F}
.f{position:absolute}
.bloc{left:600px;top:56px;width:640px;height:608px;background:${bloc};border-radius:36px;overflow:hidden}
.forme1{right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;background:${forme1}}
.forme2{left:-40px;bottom:-40px;width:170px;height:170px;border-radius:0 170px 0 0;background:${forme2};opacity:.9}
.ecran{left:640px;top:126px;width:560px;height:350px;border-radius:16px;overflow:hidden;background:#FBF7F1;box-shadow:0 18px 40px rgba(36,34,31,.16)}
.ecran img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}
.tel{left:1010px;top:300px;width:180px;height:330px;border-radius:26px;overflow:hidden;background:#FBF7F1;border:6px solid #24221F;box-shadow:0 18px 40px rgba(36,34,31,.20)}
.tel img{width:100%;display:block}
.texte{left:64px;top:0;width:500px;height:720px;display:flex;flex-direction:column;justify-content:center;gap:22px}
.pastille{align-self:flex-start;font-size:18px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:8px 16px;border-radius:999px;background:${pastille};color:${pastilleTexte}}
h1{margin:0;font-size:${h1.length > 34 ? 52 : 62}px;font-weight:700;letter-spacing:-.03em;line-height:1.02}
.sous{margin:0;font-size:22px;font-weight:500;color:#514C44;line-height:1.35}
.marque{left:64px;top:628px;display:flex;align-items:center;gap:12px;font-size:28px;font-weight:800;letter-spacing:-.02em}
.point{left:64px;top:64px;display:flex;gap:10px}
.point i{display:block;width:18px;height:18px;border-radius:50%}
</style></head><body>
<div class="f bloc"><div class="f forme1"></div><div class="f forme2"></div></div>
<div class="f ecran"><img src="/assets/${ecran}"></div>
<div class="f tel"><img src="/assets/${tel}"></div>
<div class="f point"><i style="background:#E58C74"></i><i style="background:#E8B93A;border-radius:4px"></i><i style="background:#2E5A88;border-radius:18px 0 0 0"></i></div>
<div class="f texte"><span class="pastille">${esc(sur)}</span><h1>${esc(h1)}</h1><p class="sous">${esc(sous)}</p></div>
<div class="f marque"><svg viewBox="0 0 80 80" width="36" height="36"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="#24221F"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#FBF7F1"/></svg><span>Q<span style="color:#2E5A88">M</span><span style="color:#E8B93A">E</span></span></div>
</body></html>`;
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  // SEUL=slug1,slug2 : ne régénérer que ces couvertures (les autres restent intactes).
  const slugs = process.env.SEUL ? process.env.SEUL.split(',') : Object.keys(T);
  for (const s of slugs) { const i = Object.keys(T).indexOf(s);
    fs.mkdirSync(`${R}/.couv-tmp`, { recursive: true }); const f = `${R}/.couv-tmp/couv-${s}.html`; // dossier temporaire, à supprimer ensuite
    fs.writeFileSync(f, page(s, i));
    await p.goto(`http://localhost:8899/.couv-tmp/couv-${s}.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    const outfit = await p.evaluate(() => [...document.fonts].some((x) => x.family.replace(/"/g, '') === 'Outfit' && x.status === 'loaded'));
    if (!outfit) console.log('POLICE ABSENTE', s);
    const deborde = await p.evaluate(() => { const t = document.querySelector('.texte'); return [...t.children].some((e) => e.getBoundingClientRect().right > 580); });
    await p.screenshot({ path: `${OUT}/templates-${s}-couverture.png` });
    if (deborde) console.log('débordement', s);
  }
  console.log('couvertures', slugs.length);
  await b.close();
})();
