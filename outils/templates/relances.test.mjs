// Relances de prospection : mention d'opposition, signature graphique, modes A et B (docs/prospection/relances/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { construire, lienOpposition, dateLongue } from '../../docs/prospection/relances/relance.mjs';

test('relance : lien d\'opposition encodé, français et anglais', () => {
  assert.equal(lienOpposition('a+b@x.fr'), 'https://qm-engineering.fr/ne-plus-recevoir/?email=a%2Bb%40x.fr');
  assert.equal(lienOpposition(' info@y.com ', true), 'https://qm-engineering.fr/ne-plus-recevoir/?lang=en&email=info%40y.com');
  assert.equal(dateLongue('2026-11-01'), '1er novembre');
  assert.equal(dateLongue('2026-11-06', true), '6 November');
});

test('relance mode A : clôture, signature cid, mention en dernier', () => {
  const b = construire({ email: 'contact@exemple.fr', objet: 'Re: Vos plannings', vague: 25, premierMail: '2026-11-06', mode: 'A' });
  assert.equal(b.subject, 'Re: Vos plannings');
  assert.ok(b.body.includes('ma proposition du 6 novembre') && b.body.includes('utm_campaign=derniere-relance-v25'));
  assert.ok(b.body.trim().endsWith('(ou répondez simplement « stop »).'));
  assert.ok(b.htmlBody.includes('cid:att0') && b.htmlBody.includes('cid:att5'));
  assert.ok(b.htmlBody.indexOf('cid:att5') < b.htmlBody.indexOf('Ne plus recevoir les informations'), 'mention après la signature');
  assert.ok(b.htmlBody.includes('ne-plus-recevoir/?email=contact%40exemple.fr'));
  assert.equal(b.attachments.length, 6);
  assert.ok(b.attachments.every((a) => a.inline && /^sha256:[0-9a-f]{64}:/.test(a.content)));
  assert.ok(!/Nexora|Claude|Anthropic/.test(b.body + b.htmlBody));
});

test('relance mode B : paragraphe propre, anglais, copie', () => {
  const b = construire({ email: 'info@show.be', cc: 'autre@show.be', objet: 'Qualifiers', vague: 20, premierMail: '2026-11-03', mode: 'B', lang: 'en', paragraphe: 'scores would be checked in one shared table.' });
  assert.ok(b.body.startsWith('Hi,') && b.body.includes('my message of 3 November') && b.body.includes('To be more concrete: scores'));
  assert.ok(b.body.includes('utm_campaign=relance-v20') && b.body.includes('Stop receiving information: https://qm-engineering.fr/ne-plus-recevoir/?lang=en&email=info%40show.be'));
  assert.deepEqual(b.cc, ['autre@show.be']);
  assert.throws(() => construire({ email: 'x@y.fr', objet: 'o', vague: 1, premierMail: '2026-11-03', mode: 'B' }), /sans paragraphe/);
  assert.throws(() => construire({ email: 'x@y.fr', objet: 'o', vague: 1, premierMail: '03/11', mode: 'A' }), /incomplète/);
});
