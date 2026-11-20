// Codes d'accès aux templates QME et API de données, sans dépendance à Netlify :
// le stockage est injecté (Netlify Blobs en production, mémoire en local et en test).
//
// Un code a la forme PRODUIT-AAAA-AAAA-SSSS-SSSS :
//  - PRODUIT : préfixe du template (REV pour le planning de révision) ;
//  - AAAA-AAAA : 40 bits aléatoires (identifiant de l'acheteur) ;
//  - SSSS-SSSS : 40 bits de signature HMAC-SHA256 avec le secret TEMPLATES_SECRET.
// Aucun code n'est stocké : la signature suffit à le valider. Un code se révoque en
// listant son identifiant (les 8 caractères aléatoires) dans TEMPLATES_CODES_REVOQUES.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PACKS, SUR_MESURE, ACHAT_SUR_MESURE, compositionDepuisAchat, prixComposition, produitsAccessibles } from './packs.mjs';
import { TEMPLATES } from '../../outils/packs/donnees.mjs';
export { PACKS, SUR_MESURE, ACHAT_SUR_MESURE };

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base 32 de Crockford
// Produits vendus : préfixe des codes, page de l'application, identifiant Gumroad (clés de licence).
export const PRODUITS = {
  REV: { nom: 'Planning de révision', url: '/templates/revision/', gumroad: 'zjO4cm1dUdBGh1IfYqmklw==' },
  CRA: { nom: 'Compte rendu et plan d\'actions', url: '/templates/compte-rendu/', gumroad: '29mMG1jJqiRppcqs_Mt09w==' },
  PRX: { nom: 'Coût de revient et prix par client', url: '/templates/cout-revient/', gumroad: '-T__Q8H0-88YesaxXTxU4w==' },
  TJM: { nom: 'Calculateur de TJM freelance', url: '/templates/tjm/', gumroad: 'M7_JNLoIwpFH6zWHHxhOUA==' },
  MCE: { nom: 'Livre recettes-dépenses micro-entreprise', url: '/templates/micro-entreprise/', gumroad: 'fb4T6HNJyejxH1Q-mL8x8g==' },
  BCM: { nom: 'Budget commun', url: '/templates/budget-commun/', gumroad: 'FK_HeZlqRLdZO8o7Y1Bccw==' },
  GNT: { nom: 'Planning Gantt rapide', url: '/templates/gantt/', gumroad: 'CJfr2K4d-pBBg-5mOHaYMA==' },
  TCH: { nom: 'Gestionnaire de tâches', url: '/templates/taches/', gumroad: 'fhPqrSBXayFL21IZWU6YIg==' },
  NTR: { nom: 'Nutrition et dépense énergétique', url: '/templates/nutrition/', gumroad: 'gPo_NgvoB4zjkqk2mFkXBQ==' },
  BDG: { nom: 'Budget du foyer', url: '/templates/budget/', gumroad: 'YvGeAPDZjuqr9yflNtLhhw==' },
  MRG: { nom: 'Organisateur de mariage', url: '/templates/mariage/', gumroad: 'TmtmeDwq1OsE2Y9gL6rDag==' },
  VSA: { nom: 'Circuit de visa des documents', url: '/templates/visa/', gumroad: 'zJsheWedmR4QFEZA1e15mA==' },
  NCF: { nom: 'Registre des non-conformités', url: '/templates/non-conformites/', gumroad: 'DzQ3gTUdCp2Eg3dECASbhA==' },
  CRM: { nom: 'CRM freelance', url: '/templates/crm/', gumroad: 'OGiloE9iB6oIL0UuitwyBA==' },
  VHC: { nom: 'Gestion de flotte de véhicules', url: '/templates/flotte/' },
  PHR: { nom: 'Planner horaire', url: '/templates/planner/', gumroad: '6uyeEBR91feI1tM2Wbij8Q==' },
  RSV: { nom: 'Levée de réserves', url: '/templates/reserves/', gumroad: '1xyF3Lz36TxDCOz4KnVB4A==' },
  PRS: { nom: 'Pipeline de prospection B2B', url: '/templates/prospection/', gumroad: '7Ie2c3Qgcxkl1coobiiNXg==' },
  DVS: { nom: 'Générateur de devis', url: '/templates/devis/', gumroad: 'RmzvzczQ7xnP2IP7yRfwBg==' },
  TRS: { nom: 'Trésorerie prévisionnelle 12 mois', url: '/templates/tresorerie/', gumroad: 'no1AEwLFPlXydqFGU7vRzg==' },
  PRC: { nom: 'Gestion de parc informatique', url: '/templates/parc-informatique/' },
  EVT: { nom: 'Pilote événementiel', url: '/templates/evenementiel/' },
  ASC: { nom: 'Inscriptions associatives', url: '/templates/inscriptions/', gumroad: '5XuVWuitD2ZzpVkwQFHlVw==' },
  AEC: { nom: 'Gestion d\'auto-école', url: '/templates/auto-ecole/' },
  TRV: { nom: 'Pilote de travaux maison', url: '/templates/travaux/', gumroad: 'leplToyYwMtXCmdXZa9T4Q==' },
  SNT: { nom: 'Secret Santa', url: '/templates/secret-santa/', gumroad: 'fCyii9wIVdIfFc1YQdbZzQ==' },
  HBT: { nom: 'Suivi d\'habitudes et routines', url: '/templates/habitudes/', gumroad: 'DvjP1MxGl7bGDZiHfGgcfQ==' },
  ENT: { nom: 'Entretien de la maison', url: '/templates/entretien/' },
  DTT: { nom: 'Remboursement de dettes', url: '/templates/dettes/', gumroad: '-5-cTF1xpPORIx5P_zGn7w==' },
  ABN: { nom: 'Suivi des abonnements', url: '/templates/abonnements/', gumroad: '5wUF3mCVqbG3yAF-coM12A==' },
  PTM: { nom: 'Inventaire valorisé', url: '/templates/patrimoine/', gumroad: 'A8JdI_BV8_BHRmFHWK4r3A==' },
  TDV: { nom: 'Temps de vie', url: '/templates/temps-de-vie/', gumroad: 'sz94ceBG8cN4BLBpImKYxQ==' },
  NDF: { nom: 'Notes de frais et indemnités kilométriques', url: '/templates/notes-de-frais/', gumroad: 'vI2luLWgaztzc9s7FcujWQ==' },
  APD: { nom: 'Préparateur d\'appel découverte', url: '/templates/appel-decouverte/', gumroad: 'NOhwt805chMWKwJGEDhgJQ==' },
  RCV: { nom: 'Relance des impayés', url: '/templates/impayes/', gumroad: 'xbHURXS0w79P1ap-nFBbWQ==' },
  ARD: { nom: 'Onboarding et offboarding salarié', url: '/templates/onboarding/', gumroad: 'u_RxsaNkRuszAnjeMFxKZw==' },
  CNG: { nom: 'Suivi des congés et absences', url: '/templates/conges/', gumroad: 'gJVooOi5p2lDuVx2azvvtA==' },
  STK: { nom: 'Stocks et inventaire', url: '/templates/stocks/', gumroad: '4yl9UwCwQPGWahkhI0oJUA==' },
  SJR: { nom: 'Location saisonnière', url: '/templates/location-saisonniere/' },
  VTR: { nom: 'Simulateur leasing ou achat', url: '/templates/leasing/', gumroad: 'VP_lDEeIUWMGQ8bSAZ12tQ==' },
  RDV: { nom: 'Tableau de bord annuel et roue de vie', url: '/templates/tableau-annuel/', gumroad: 'XMvZIWF4YueA-fSR5lunEg==' },
  EPG: { nom: 'Objectif d\'épargne et fonds d\'urgence', url: '/templates/epargne/', gumroad: 'sEO7sJxS14azsCZ761I-yQ==' },
  DMN: { nom: 'Déménagement', url: '/templates/demenagement/' },
  PCM: { nom: 'Propositions commerciales', url: '/templates/propositions/', gumroad: 'N9GYtihcDeqRncRUYwVwew==' },
  DRP: { nom: 'Document unique d\'évaluation des risques', url: '/templates/document-unique/', gumroad: 'KZHfWPckpGMOxeFYDPcrow==' },
  TDB: { nom: 'Tableau de bord de pilotage PME', url: '/templates/pilotage-pme/', gumroad: 'qzhJTzOWF59ZJo1a1Xbetg==' },
  CHT: { nom: 'Suivi de chantier par lot', url: '/templates/suivi-chantier/', gumroad: '78_8FuKW6L-Dk5kT50W8-Q==' },
  GMA: { nom: 'Maintenance préventive', url: '/templates/maintenance/' },
  RPS: { nom: 'Repas de la semaine et liste de courses', url: '/templates/repas/', gumroad: 'EnpmgktOylLJZJST9_Tfhg==' },
  VYG: { nom: 'Planificateur de voyage', url: '/templates/voyage/', gumroad: 'B0MUKsC_AHC_LeiL83xQvA==' },
  VRF: { nom: 'Vérifications réglementaires', url: '/templates/verifications/' },
  CTR: { nom: 'Contrats fournisseurs et échéances', url: '/templates/contrats/' },
  EQP: { nom: 'Planning d\'équipe et staffing', url: '/templates/planning-equipe/', gumroad: 'uGMwDvkv48r4plEy5vFJNQ==' },
  CMP: { nom: 'Gestion de compétition sportive', url: '/templates/competition/', gumroad: '1evFhHOrqZyrgIdg9T483A==' },
  SNH: { nom: 'Dossier sinistre habitation', url: '/templates/sinistre/', gumroad: 'nSUWbSsPnceWsczHeshUnw==' },
  MSC: { nom: 'Carnet de musculation et cross-training', url: '/templates/musculation/', gumroad: '1T1zE6319ZF9qexKr8Kzzw==' },
  CAR: { nom: 'Carnet de voiture', url: '/templates/voiture/', gumroad: '-cFP8vq3TQIStzfF1gSA-w==' },
  GST: { nom: 'Gestion locative', url: '/templates/gestion-locative/' },
  SDR: { nom: 'Réservation de salles et bureaux', url: '/templates/salles/' },
  BSC: { nom: "Pilotage d'une journée de bascule", url: '/templates/bascule/' },
  CSE: { nom: 'Gestion de classe', url: '/templates/gestion-classe/' },
  EDT: { nom: "Emploi du temps d'établissement", url: '/templates/emploi-du-temps/' },
  PRK: { nom: 'Pilotage de parcs multi-sites', url: '/templates/parcs-multi-sites/' },
  TMP: { nom: 'Suivi du temps et rentabilité par mission', url: '/templates/suivi-temps/', gumroad: 'u-ySqLkS21aA1mhfeG9EFQ==' },
  KRF: { nom: 'Kit références et plaquette', url: '/templates/references-plaquette/', gumroad: 'Y_zjhtlT4nxXqSdqeT_mEA==' },
  CED: { nom: 'Calendrier éditorial', url: '/templates/calendrier-editorial/', gumroad: 'qUwb0nm4TaFmXgiSoc2aJA==' },
  RDE: { nom: 'Registre du DOE', url: '/templates/doe/', gumroad: 'rusN6tG2fwT6JE_JZMEZIA==' },
  STR: { nom: 'Conformité des sous-traitants', url: '/templates/sous-traitants/', gumroad: '6skYhUNcKgwFwua1a56TVw==' },
  CND: { nom: 'Suivi des appels d\'offres et candidatures', url: '/templates/appels-offres/', gumroad: 'q9_HDtnCNGmEe4PrNEOQyA==' },
  ENP: { nom: 'Entretiens annuels et professionnels', url: '/templates/entretiens-annuels/', gumroad: 'iOZ0cB8ONCrvvkxMdbL7BQ==' },
  GRD: { nom: 'Garde-manger et dates de péremption', url: '/templates/garde-manger/' },
  PGS: { nom: 'Suivi de lecture', url: '/templates/lecture/', gumroad: 'cfXnYcVohgvMwrn0ONglsQ==' },
  NTS: { nom: 'Notes et moyennes', url: '/templates/notes/', gumroad: 'mfJW49fm4F0bQ7rUSdY8Kw==' },
  ETD: { nom: 'État des lieux d’entrée et de sortie', url: '/templates/etat-des-lieux/', gumroad: 'eo2d-2oYp7KgqGwQQ_v4OA==' },
  ANM: { nom: "Suivi d'un animal de compagnie", url: '/templates/animal/' },
  TVA: { nom: 'Suivi de TVA', url: '/templates/tva/', gumroad: 'aGMrUCFVZ9yzLWfaNIWQ1w==' },
  DCS: { nom: 'Papiers du foyer', url: '/templates/papiers/', gumroad: 'uJxPWSYtiXp3nixYfudDoQ==' },
  RBS: { nom: 'Remboursements santé', url: '/templates/remboursements-sante/' },
  ACH: { nom: 'Demandes d\'achat et fournitures', url: '/templates/achats/' },
  CPT: { nom: 'Capacité d\'emprunt et comparateur de prêts', url: '/templates/emprunt/', gumroad: '-yAS1RKHFCUmacHWd-lOAw==' },
  CDX: { nom: 'Cadeaux reçus et remerciements', url: '/templates/remerciements/' },
  RVH: { nom: 'Revue hebdomadaire et journal de bord', url: '/templates/revue-hebdo/' },
  CAN: { nom: 'Candidatures études, stages, alternance', url: '/templates/candidatures/', gumroad: '3hYVauouIDMw3cQ-RA5gCQ==' },
  SBV: { nom: 'Subventions', url: '/templates/subventions/' },
  BNV: { nom: 'Bénévoles et planning des créneaux', url: '/templates/benevoles/' },
  MMR: { nom: 'Planning de mémoire ou de thèse', url: '/templates/memoire/', gumroad: '-JA7LGCBFecmAERfqUDnZQ==' },
  AGS: { nom: 'Assemblée générale et vie statutaire', url: '/templates/assemblee-generale/' },
  RNT: { nom: "Rentabilité d'un investissement locatif", url: '/templates/investissement-locatif/', gumroad: 'geVSrMzs3CshVaDi9IeCaQ==' },
  FRM: { nom: 'Matrice compétences et formations', url: '/templates/competences/' },
  PRG: { nom: 'Progression pédagogique', url: '/templates/progression/' },
  PTG: { nom: 'Calendrier du potager', url: '/templates/potager/' },
  BBE: { nom: 'Suivi du bébé', url: '/templates/bebe/' },
  CPR: { nom: 'Charges et AG de copropriété', url: '/templates/copropriete/' },
  CRS: { nom: 'Plan d\'entraînement course à pied', url: '/templates/course-a-pied/' },
  SMN: { nom: 'Séminaire / offsite', url: '/templates/seminaire/' },
  QZZ: { nom: 'Banque de questions et quiz', url: '/templates/quiz/' },
  SVT: { nom: 'Vivre sans voiture', url: '/templates/sans-voiture/', gumroad: '1DfML3czjZu5bg95z3KuRg==' },
};
const GUMROAD_VERIFY = 'https://api.gumroad.com/v2/licenses/verify';
export const TAILLE_MAX = 900_000; // octets, marge sous la limite d'1 Mo d'une requête

function base32(octets) {
  let bits = 0, valeur = 0, sortie = '';
  for (const o of octets) {
    valeur = (valeur << 8) | o; bits += 8;
    while (bits >= 5) { sortie += ALPHABET[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

function signature(secret, produit, id) {
  return base32(createHmac('sha256', secret).update(`${produit}:${id}`).digest().subarray(0, 5));
}

// Code administrateur de Quentin (ADM-XXXX-XXXX-XXXX-XXXX), toujours le même pour un secret donné :
// lit le compteur d'intérêt (/admin/interets/) et ouvre tous les templates à titre personnel.
export function codeAdmin(secret) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court');
  const s = base32(createHmac('sha256', secret).update('admin:interets').digest().subarray(0, 10));
  return `ADM-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}
export function estCodeAdmin(secret, saisie) {
  if (!secret || secret.length < 32) return false;
  const n = normaliser(saisie), attendu = normaliser(codeAdmin(secret));
  return n.length === attendu.length && timingSafeEqual(Buffer.from(n), Buffer.from(attendu));
}
// Code interne personnel de l'administrateur pour un template : mêmes données sur tous ses appareils.
export function codeAdminProduit(secret, produit) {
  const id = base32(createHmac('sha256', secret).update(`admin-perso:${produit}`).digest().subarray(0, 5));
  return formater(produit, id, signature(secret, produit, id));
}

// Majuscules, sans séparateurs ; O→0, I et L→1 (saisie tolérante).
export function normaliser(saisie) {
  return String(saisie || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');
}

const formater = (produit, id, sig) => `${produit}-${id.slice(0, 4)}-${id.slice(4)}-${sig.slice(0, 4)}-${sig.slice(4)}`;

export function genererCode(secret, produit) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court (32 caractères minimum)');
  if (!PRODUITS[produit]) throw new Error(`Produit inconnu : ${produit}`);
  const id = base32(randomBytes(5));
  return formater(produit, id, signature(secret, produit, id));
}

// --- Essai gratuit (décision de Quentin, 18/11/2026) ----------------------------------------------
// Templates « vie personnelle » en vente : 14 jours d'essai sans carte, puis 30 jours en lecture seule,
// puis effacement. Le code d'essai a la forme d'un code de template (PRODUIT-AAAA-AAAA-SSSS-SSSS), mais :
//  - AAA (3 premiers caractères de l'identifiant) = jour de début, compté depuis le 01/01/2026 ;
//  - la signature est calculée dans le contexte « essai », distinct des codes achetés.
// La date de début ne peut donc pas être modifiée sans invalider le code : la durée maximale est garantie
// sans rien stocker. Le registre des essais (store « templates-essais ») ne sert qu'aux e-mails, au report
// des données à l'achat et à l'effacement.
export const ESSAI = { jours: 14, conservation: 30 };
const JOUR0 = Date.UTC(2026, 0, 1);
const MS_JOUR = 86_400_000;

// Date du jour à Paris (AAAA-MM-JJ) : la fin d'un essai tombe à minuit heure de Paris.
export const jourParis = (date = new Date()) => date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
export const decalerJour = (jour, n) => new Date(Date.parse(`${jour}T00:00:00Z`) + n * MS_JOUR).toISOString().slice(0, 10);
const numeroJour = (jour) => Math.round((Date.parse(`${jour}T00:00:00Z`) - JOUR0) / MS_JOUR);

const signerEssai = (secret, produit, id) => signature(secret, `essai:${produit}`, id);

export function genererCodeEssai(secret, produit, date = new Date()) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court (32 caractères minimum)');
  if (!PRODUITS[produit]) throw new Error(`Produit inconnu : ${produit}`);
  const n = numeroJour(jourParis(date));
  const jour = [n >> 10, (n >> 5) & 31, n & 31].map((v) => ALPHABET[v]).join('');
  const id = jour + base32(randomBytes(4)).slice(0, 5);
  return formater(produit, id, signerEssai(secret, produit, id));
}

// Renvoie { produit, id, code, debut, fin, effacement } si le code d'essai est authentique, sinon null.
export function verifierCodeEssai(secret, saisie, revoques = []) {
  if (!secret) return null;
  const n = normaliser(saisie);
  const produit = Object.keys(PRODUITS).find((p) => n.startsWith(p) && n.length === p.length + 16);
  if (!produit) return null;
  const id = n.slice(produit.length, produit.length + 8), sig = n.slice(produit.length + 8);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(signerEssai(secret, produit, id)))) return null;
  if (revoques.map(normaliser).includes(id)) return null;
  const v = [...id.slice(0, 3)].map((c) => ALPHABET.indexOf(c));
  const debut = new Date(JOUR0 + ((v[0] << 10) | (v[1] << 5) | v[2]) * MS_JOUR).toISOString().slice(0, 10);
  const fin = decalerJour(debut, ESSAI.jours);
  return { produit, id, code: formater(produit, id, sig), debut, fin, effacement: decalerJour(fin, ESSAI.conservation) };
}

// État d'un essai à une date : actif jusqu'au jour `fin` inclus, lecture seule jusqu'à `effacement` inclus.
export function etatEssai(essai, aujourdhui = jourParis()) {
  const restants = Math.round((Date.parse(`${essai.fin}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / MS_JOUR);
  return {
    debut: essai.debut, fin: essai.fin, effacement: essai.effacement,
    joursRestants: Math.max(0, restants), termine: aujourdhui > essai.fin, efface: aujourdhui > essai.effacement,
  };
}

export const cleDonneesEssai = (secret, produit, id) => `essai/${produit}/${createHmac('sha256', secret).update(`essai-donnees:${produit}:${id}`).digest('hex').slice(0, 32)}`;
export const cleEmail = (secret, email) => createHmac('sha256', secret).update(`essai-email:${String(email || '').trim().toLowerCase()}`).digest('hex').slice(0, 32);

// Informations d'essai renvoyées à l'application (bandeau, lecture seule, bouton d'achat).
function infoEssai(essai, aujourdhui) {
  const t = TEMPLATES[essai.produit] || {};
  return { ...etatEssai(essai, aujourdhui), prix: t.prix ?? null, achat: t.permalien ? `https://qmengineering.gumroad.com/l/${t.permalien}` : null };
}

// Report des données d'essai dans l'espace acheté (même template). Candidats : le code d'essai envoyé par
// l'application, puis l'essai enregistré avec l'e-mail de l'achat Gumroad. Rien n'est écrasé : si l'espace
// acheté contient déjà des données, il les garde. L'essai est ensuite marqué acheté (plus aucun rappel).
async function reporterEssai({ secret, produit, cible, codeEssai, email, stockage, essais, revoques, maintenant }) {
  if (!essais) return false;
  const candidats = [];
  const parCode = codeEssai ? verifierCodeEssai(secret, codeEssai, revoques) : null;
  if (parCode && parCode.produit === produit) candidats.push(parCode.id);
  if (email) {
    const ref = await essais.get(`email/${cleEmail(secret, email)}/${produit}`);
    if (ref?.id && !candidats.includes(ref.id)) candidats.push(ref.id);
  }
  for (const id of candidats) {
    const reg = await essais.get(`essai/${id}`);
    if (!reg || reg.achete) continue;
    const source = cleDonneesEssai(secret, produit, id);
    const donnees = await stockage.get(source);
    let reporte = false;
    if (donnees && (await stockage.get(cible)) == null) {
      await stockage.set(cible, { ...donnees, majLe: new Date(maintenant()).toISOString() });
      reporte = true;
    }
    await essais.set(`essai/${id}`, { ...reg, achete: new Date(maintenant()).toISOString(), reporte });
    if (reporte && stockage.supprimer) await stockage.supprimer(source);
    return reporte;
  }
  return false;
}

// Clé de licence Gumroad : 4 blocs de 8 caractères hexadécimaux.
export function estLicence(saisie) {
  return /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/.test(String(saisie || '').trim().toUpperCase());
}

// Code interne déterministe associé à une clé Gumroad : mêmes données d'un appareil à l'autre.
export function codeDepuisLicence(secret, produit, licence) {
  const id = base32(createHmac('sha256', secret).update(`gumroad:${produit}:${licence.trim().toUpperCase()}`).digest().subarray(0, 5));
  return formater(produit, id, signature(secret, produit, id));
}

// Interroge Gumroad. Renvoie { ok } ou { ok: false, raison: 'inconnue' | 'rembourse' }.
export async function verifierLicenceGumroad(produitGumroad, licence, fetchImpl = fetch) {
  const r = await fetchImpl(GUMROAD_VERIFY, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ product_id: produitGumroad, license_key: licence.trim().toUpperCase(), increment_uses_count: 'false' }),
    signal: AbortSignal.timeout(8000),
  });
  const corps = await r.json().catch(() => ({}));
  if (r.status === 404 || corps.success === false) return { ok: false, raison: 'inconnue' };
  if (!r.ok || !corps.purchase) throw new Error(`Gumroad ${r.status}`);
  const a = corps.purchase;
  if (a.refunded || a.chargebacked || a.disputed) return { ok: false, raison: 'rembourse' };
  return { ok: true, achat: { price: a.price, currency: a.currency, custom_fields: a.custom_fields, variants: a.variants, sale_timestamp: a.sale_timestamp, ...(a.email ? { email: a.email } : {}) } };
}

// --- Packs -----------------------------------------------------------------------------------------
// Code de pack : PACK-AAAA-AAAA-SSSS-SSSS (même forme qu'un code de template, préfixe de PACKS).
// Code sur mesure : SMP-<préfixes accolés>-AAAA-AAAA-SSSS-SSSS ; la signature couvre la composition.
// Chaque template du pack reçoit un code de template déterministe (codePackProduit) : mêmes données
// d'un appareil à l'autre, et les templates n'ont rien à savoir des packs.
// Option « Pack évolutif » : portée par la signature (contexte pack+ au lieu de pack).
const signerPack = (secret, pack, compo, id, option = false) => signature(secret, compo ? `${pack}:${compo}` : `${option ? 'pack+' : 'pack'}:${pack}`, id);

export function genererCodePack(secret, pack, composition = [], { option = false } = {}) {
  if (!secret || secret.length < 32) throw new Error('TEMPLATES_SECRET absent ou trop court (32 caractères minimum)');
  const id = base32(randomBytes(5));
  if (pack === SUR_MESURE) {
    const compo = [...new Set(composition)];
    if (compo.length < 2 || compo.some((p) => !PRODUITS[p])) throw new Error('Pack sur mesure : au moins 2 templates connus');
    const sig = signerPack(secret, SUR_MESURE, compo.join(''), id);
    return `${SUR_MESURE}-${compo.join('')}-${id.slice(0, 4)}-${id.slice(4)}-${sig.slice(0, 4)}-${sig.slice(4)}`;
  }
  if (!PACKS[pack]) throw new Error(`Pack inconnu : ${pack}`);
  return formater(pack, id, signerPack(secret, pack, '', id, option));
}

// Code de pack déterministe associé à une clé Gumroad de pack.
export function codePackDepuisLicence(secret, pack, licence) {
  const id = base32(createHmac('sha256', secret).update(`gumroad-pack:${pack}:${licence.trim().toUpperCase()}`).digest().subarray(0, 5));
  return formater(pack, id, signerPack(secret, pack, '', id));
}

// Renvoie { pack, id, produits } si le code de pack est valide, sinon null.
export function verifierCodePack(secret, saisie, revoques = []) {
  if (!secret) return null;
  const n = normaliser(saisie);
  let pack, compo = '', reste;
  if (n.startsWith(SUR_MESURE) && (n.length - SUR_MESURE.length - 16) % 3 === 0 && n.length >= SUR_MESURE.length + 6 + 16) {
    pack = SUR_MESURE; compo = n.slice(3, n.length - 16); reste = n.slice(-16);
  } else {
    pack = Object.keys(PACKS).find((p) => n.startsWith(p) && n.length === p.length + 16);
    if (!pack) return null;
    reste = n.slice(pack.length);
  }
  const id = reste.slice(0, 8), sig = reste.slice(8);
  const egal = (option) => timingSafeEqual(Buffer.from(sig), Buffer.from(signerPack(secret, pack, compo, id, option)));
  const option = pack !== SUR_MESURE && egal(true);
  if (!option && !egal(false)) return null;
  if (revoques.map(normaliser).includes(id)) return null;
  const produits = pack === SUR_MESURE ? compo.match(/.{3}/g).filter((p) => PRODUITS[p]) : produitsAccessibles(pack, { option }, PRODUITS);
  return { pack, id, option, produits };
}

// Code de pack sur mesure déterministe associé à une clé Gumroad du produit « Pack sur mesure ».
export function codeSurMesureDepuisLicence(secret, licence, compo) {
  const id = base32(createHmac('sha256', secret).update(`gumroad-smp:${licence.trim().toUpperCase()}:${compo.join('')}`).digest().subarray(0, 5));
  const sig = signerPack(secret, SUR_MESURE, compo.join(''), id);
  return `${SUR_MESURE}-${compo.join('')}-${id.slice(0, 4)}-${id.slice(4)}-${sig.slice(0, 4)}-${sig.slice(4)}`;
}

// Code du template `produit` ouvert par le pack (pack, id).
export function codePackProduit(secret, pack, id, produit) {
  const id2 = base32(createHmac('sha256', secret).update(`pack-produit:${pack}:${id}:${produit}`).digest().subarray(0, 5));
  return formater(produit, id2, signature(secret, produit, id2));
}

function reponsePack(secret, acces, code) {
  const nom = acces.pack === SUR_MESURE ? 'Pack sur mesure' : PACKS[acces.pack].nom;
  const slug = acces.pack === SUR_MESURE ? 'sur-mesure' : PACKS[acces.pack].slug;
  const templates = acces.produits.map((p) => ({ produit: p, nom: PRODUITS[p].nom, url: PRODUITS[p].url, code: codePackProduit(secret, acces.pack, acces.id, p) }));
  return json(200, { ok: true, pack: acces.pack, slug, nom, option: Boolean(acces.option), code, templates });
}

// Renvoie { produit, id } si le code est valide, sinon null.
export function verifierCode(secret, saisie, revoques = []) {
  if (!secret) return null;
  const n = normaliser(saisie);
  const produit = Object.keys(PRODUITS).find((p) => n.startsWith(normaliser(p)) && n.length === normaliser(p).length + 16);
  if (!produit) return null;
  const reste = n.slice(normaliser(produit).length);
  const id = reste.slice(0, 8), sig = reste.slice(8);
  const attendue = signature(secret, produit, id);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(attendue))) return null;
  if (revoques.map(normaliser).includes(id)) return null;
  return { produit, id };
}

function cleDonnees(secret, produit, id) {
  return `${produit}/${createHmac('sha256', secret).update(`donnees:${produit}:${id}`).digest('hex').slice(0, 32)}`;
}

const json = (statut, corps) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Routes (préfixe /api/templates) :
//  POST /connexion   { code, produit? }  → { ok, produit, donnees } (produit requis pour le code administrateur)
//  GET  /donnees     (en-tête X-Code)    → { donnees }
//  PUT  /donnees     { donnees, base }   → { ok, majLe } ou 409 { donnees } si une version plus récente existe
// Le stockage expose get(cle) → objet|null et set(cle, objet).
export async function traiter(requete, { secret, revoques = [], stockage, essais = null, maintenant = Date.now, verifierLicence = verifierLicenceGumroad }) {
  if (!secret) return json(503, { erreur: 'Service non configuré' });
  const chemin = new URL(requete.url).pathname.replace(/^\/api\/templates/, '').replace(/\/$/, '');

  let corps = null;
  if (requete.method === 'POST' || requete.method === 'PUT') {
    const texte = await requete.text();
    if (texte.length > TAILLE_MAX) return json(413, { erreur: 'Données trop volumineuses' });
    try { corps = JSON.parse(texte || '{}'); } catch { return json(400, { erreur: 'JSON invalide' }); }
  }

  let code = requete.method === 'POST' ? corps?.code : requete.headers.get('x-code');
  // Achat vérifié auprès de Gumroad : sert au report des données d'un essai gratuit dans l'espace acheté.
  let achatVerifie = null;
  const reporter = (produit, cible) => reporterEssai({ secret, produit, cible, codeEssai: corps?.essai, email: achatVerifie?.email, stockage, essais, revoques, maintenant })
    .catch((e) => { console.error('Report d\'essai impossible', e); return false; });
  // Pack acheté : chaque template du pack peut recevoir les données d'un essai du même template.
  const reporterPack = async (pack) => {
    for (const p of pack.produits) {
      const a = verifierCode(secret, codePackProduit(secret, pack.pack, pack.id, p), revoques);
      if (a) await reporter(p, cleDonnees(secret, p, a.id));
    }
  };

  // Connexion par clé de licence Gumroad : vérifiée auprès de Gumroad, puis convertie en code interne.
  if (chemin === '/connexion' && requete.method === 'POST' && estLicence(code)) {
    // Tous les produits sont interrogés en parallèle : le temps de réponse ne dépend pas du nombre de produits.
    const candidats = [...Object.entries(PRODUITS), ...Object.entries(PACKS), [SUR_MESURE, ACHAT_SUR_MESURE]].filter(([, p]) => p.gumroad);
    const reponses = await Promise.allSettled(candidats.map(([, p]) => verifierLicence(p.gumroad, code)));
    const trouve = reponses.findIndex((r) => r.status === 'fulfilled' && r.value.ok);
    const rembourse = reponses.some((r) => r.status === 'fulfilled' && r.value.raison === 'rembourse');
    if (trouve >= 0) {
      const [cle] = candidats[trouve];
      achatVerifie = reponses[trouve].value.achat || {};
      if (cle === SUR_MESURE) {
        // Pack sur mesure : composition lue dans l'achat, montant payé contrôlé contre le barème.
        const achat = reponses[trouve].value.achat;
        const compo = compositionDepuisAchat(achat, PRODUITS);
        if (compo.length < 2) return json(422, { erreur: 'Pack sur mesure : la liste des templates est introuvable dans l’achat. Écrivez à quentin.morel@qm-engineering.fr.' });
        if (String(achat?.currency || '').toLowerCase() !== 'eur' || Number(achat?.price) < prixComposition(compo)) {
          return json(403, { erreur: 'Pack sur mesure : le montant payé ne correspond pas aux templates choisis. Écrivez à quentin.morel@qm-engineering.fr.' });
        }
        code = codeSurMesureDepuisLicence(secret, code, compo);
      } else if (PACKS[cle]) {
        // Pack Gumroad : option lue dans la version achetée, date d'achat pour les templates ajoutés depuis.
        // La clé Gumroad elle-même est renvoyée comme code : l'espace la revérifie à chaque ouverture.
        const achat = reponses[trouve].value.achat || {};
        const option = /volutif/i.test(String(achat.variants || ''));
        const acces = verifierCodePack(secret, codePackDepuisLicence(secret, cle, code), revoques);
        if (!acces) return json(401, { erreur: 'Clé de licence inconnue.' });
        await reporterPack(acces);
        return reponsePack(secret, { ...acces, option, produits: produitsAccessibles(cle, { option, date: achat.sale_timestamp }, PRODUITS) }, code.trim().toUpperCase());
      } else code = codeDepuisLicence(secret, cle, code);
    }
    else if (!rembourse && reponses.some((r) => r.status === 'rejected')) {
      return json(502, { erreur: 'Vérification de la licence impossible pour le moment. Réessaie dans un instant.' });
    }
    if (estLicence(code)) {
      return json(rembourse ? 403 : 401, { erreur: rembourse ? 'Cet achat a été remboursé : la licence n\'est plus active.' : 'Clé de licence inconnue.' });
    }
  }

  // Code administrateur : ouvre le template qui le demande (champ produit), avec l'espace personnel de Quentin.
  if (chemin === '/connexion' && requete.method === 'POST' && estCodeAdmin(secret, code)) {
    if (!PRODUITS[corps?.produit]) return json(400, { erreur: 'Code administrateur : précise le template à ouvrir.' });
    code = codeAdminProduit(secret, corps.produit);
  }

  // Pack : renvoie la liste de ses templates, chacun avec son code (tableau de bord /packs/espace/).
  if (chemin === '/connexion' && requete.method === 'POST') {
    const pack = verifierCodePack(secret, code, revoques);
    if (pack) {
      if (achatVerifie) await reporterPack(pack);
      return reponsePack(secret, pack, code);
    }
  }

  let acces = verifierCode(secret, code, revoques);
  // Code d'essai gratuit : accès complet jusqu'à la fin de l'essai, lecture seule ensuite, refusé une fois effacé.
  let essai = null;
  if (!acces) {
    const e = verifierCodeEssai(secret, code, revoques);
    if (e) {
      const aujourdhui = jourParis(new Date(maintenant()));
      const reg = essais ? await essais.get(`essai/${e.id}`) : { id: e.id };
      if (reg?.achete) return json(401, { erreur: 'Vous avez acheté ce template : ouvrez-le avec votre clé de licence Gumroad. Vos données d\'essai y ont été reportées.' });
      if (!reg || etatEssai(e, aujourdhui).efface) return json(401, { erreur: 'Cet essai gratuit est terminé et ses données ont été effacées. Le template reste disponible à l\'achat.' });
      essai = { ...e, info: infoEssai(e, aujourdhui) };
      acces = { produit: e.produit, id: e.id };
    }
  }
  if (!acces) return json(401, { erreur: 'Code d\'accès invalide' });
  const cle = essai ? cleDonneesEssai(secret, acces.produit, acces.id) : cleDonnees(secret, acces.produit, acces.id);
  const extra = essai ? { essai: essai.info } : {};

  if (chemin === '/connexion' && requete.method === 'POST') {
    if (achatVerifie && !essai) await reporter(acces.produit, cle);
    const jeton = essai ? essai.code : formater(acces.produit, acces.id, signature(secret, acces.produit, acces.id));
    return json(200, { ok: true, produit: acces.produit, url: PRODUITS[acces.produit].url, jeton, donnees: (await stockage.get(cle)) ?? null, ...extra });
  }
  if (chemin === '/donnees' && requete.method === 'GET') {
    return json(200, { donnees: (await stockage.get(cle)) ?? null, ...extra });
  }
  if (chemin === '/donnees' && requete.method === 'PUT') {
    if (essai?.info.termine) return json(403, { erreur: 'Votre essai gratuit est terminé : vos données restent consultables, mais plus modifiables. Achetez le template pour continuer avec elles.', essaiTermine: true, ...extra });
    const donnees = corps?.donnees;
    if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) return json(400, { erreur: 'Données manquantes' });
    const actuelles = await stockage.get(cle);
    // Un autre appareil a enregistré depuis la dernière lecture : on renvoie sa version.
    if (actuelles?.majLe && corps.base !== undefined && corps.base !== actuelles.majLe) {
      return json(409, { erreur: 'Version plus récente sur un autre appareil', donnees: actuelles });
    }
    const majLe = new Date().toISOString();
    await stockage.set(cle, { ...donnees, majLe });
    return json(200, { ok: true, majLe });
  }
  return json(404, { erreur: 'Route inconnue' });
}

// Stockage qui migre à la volée : lit d'abord le nouveau stockage ; si la clé n'y est pas, la reprend
// dans l'ancien, la recopie dans le nouveau, puis l'efface de l'ancien (seulement après une copie réussie).
// Chaque stockage expose get(cle), set(cle, valeur) et, pour l'ancien, supprimer(cle).
export function stockageMigrant(nouveau, ancien) {
  return {
    async get(cle) {
      const v = await nouveau.get(cle);
      if (v != null || !ancien) return v;
      const anciennes = await ancien.get(cle);
      if (anciennes == null) return null;
      await nouveau.set(cle, anciennes);
      await ancien.supprimer(cle);
      return anciennes;
    },
    set: (cle, valeur) => nouveau.set(cle, valeur),
    ...(nouveau.supprimer ? { supprimer: (cle) => nouveau.supprimer(cle) } : {}),
  };
}

export function revoquesDepuis(variable) {
  return String(variable || '').split(/[\s,;]+/).filter(Boolean);
}
