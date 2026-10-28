import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EDRAS_PUBLIC_QUESTIONNAIRE, EDRAS_QUESTIONNAIRE_VERSION,
  EDRAS_PUBLIC_AXES, validateEdrasQuestionnaire, evaluateEdrasQuestionnaire,
  verifyEdrasPublicAssessment } from '../js/rules/edras-questionnaire.mjs';
import { edrasTechniqueRules, getEdrasTechniqueD20Rules,
  makeEdrasState, normalizeEdrasState, applyEdrasAction, EDRAS_TECHNIQUES } from '../js/rules/edras.mjs';
import { getD20RuleEffects, resolveD20Roll } from '../js/rules/vitals.mjs';

const context = { level: 8, constitution: 14 };
const answerSet = Array.from({ length: 17 }, (_, index) => index === 16 ? 2 : index % 3);
const questionnaire = (answers = answerSet, seed = 'public-seed-a') => ({
  version: EDRAS_QUESTIONNAIRE_VERSION, answers, seed,
});
const assessment = (answers = answerSet, seed = 'public-seed-a') => {
  const input = questionnaire(answers, seed);
  return { ...input, result: evaluateEdrasQuestionnaire(input) };
};

test('B12: exakt 16 öffentliche Situationen plus Erfahrungsfrage, kein Klassenurteil', () => {
  assert.equal(validateEdrasQuestionnaire(), true);
  assert.equal(EDRAS_PUBLIC_QUESTIONNAIRE.questions.length, 17);
  assert.equal(EDRAS_PUBLIC_QUESTIONNAIRE.questions[16].id, 'experience');
  assert.equal(new Set(EDRAS_PUBLIC_QUESTIONNAIRE.questions.map(q => q.id)).size, 17);
  for (const q of EDRAS_PUBLIC_QUESTIONNAIRE.questions) {
    assert.ok(q.prompt.length > 20);
    assert.ok(q.choices.every(option => option.text && !('classId' in option)));
  }
  const result = evaluateEdrasQuestionnaire(questionnaire());
  assert.deepEqual(Object.keys(result).sort(), ['experience', 'potential', 'primaryAxis', 'scores',
    'status', 'techniqueId', 'version']);
  assert.equal(result.status, 'uncanonical-preview');
  assert.ok(Object.hasOwn(EDRAS_PUBLIC_AXES, result.primaryAxis));
  assert.ok(EDRAS_TECHNIQUES.some(entry => entry.id === result.techniqueId));
});

test('B12: 17 Antworten und Seed reproduzierbar; Seed ändert weder Punkte noch Potenzial', () => {
  for (const answers of [Array(17).fill(0), Array(17).fill(1), Array(17).fill(2), answerSet]) {
    for (const seed of ['seed-A01', 'seed-B01', 'seed-C01']) {
      const input = questionnaire(answers, seed);
      assert.deepEqual(evaluateEdrasQuestionnaire(input), evaluateEdrasQuestionnaire(input));
      assert.deepEqual(evaluateEdrasQuestionnaire(input), evaluateEdrasQuestionnaire(structuredClone(input)));
    }
    const a = evaluateEdrasQuestionnaire(questionnaire(answers, 'seed-A01'));
    const b = evaluateEdrasQuestionnaire(questionnaire(answers, 'seed-B01'));
    assert.deepEqual(a.scores, b.scores);
    assert.equal(a.potential, b.potential);
    assert.equal(a.experience, b.experience);
    if (a.primaryAxis !== b.primaryAxis) {
      assert.equal(a.scores[a.primaryAxis], Math.max(...Object.values(a.scores)));
      assert.equal(b.scores[b.primaryAxis], Math.max(...Object.values(b.scores)));
    }
  }
});

test('B12: tatsächlicher Gleichstand wird seedabhängig aufgelöst, Punktwerte nicht', () => {
  const tied = [0, 1, 2, 0, 2, 2, 0, 0, 1, 2, 0, 0, 0, 2, 2, 2, 2];
  const outcomes = Array.from({ length: 60 }, (_, index) =>
    evaluateEdrasQuestionnaire(questionnaire(tied, `tie-${index.toString().padStart(3, '0')}`)));
  assert.equal(outcomes[0].scores.schutz, outcomes[0].scores.bindung);
  assert.ok(new Set(outcomes.map(item => item.primaryAxis)).size > 1);
  assert.equal(new Set(outcomes.map(item => item.potential)).size, 1);
  for (const output of outcomes) {
    assert.deepEqual(output.scores, outcomes[0].scores);
    assert.ok(['schutz', 'bindung'].includes(output.primaryAxis));
  }
});

test('B12: alle 17 Fragen validiert und negative/manipulierte Eingaben abgewiesen', () => {
  const invalid = [[], [0], Array(16).fill(0), [...answerSet, 0],
    [...answerSet.slice(0, 3), -1, ...answerSet.slice(4)],
    [...answerSet.slice(0, 3), 3, ...answerSet.slice(4)],
    [...answerSet.slice(0, 3), 1.5, ...answerSet.slice(4)],
    [...answerSet.slice(0, 16), 4], [...answerSet.slice(0, 16), '1']];
  for (const answers of invalid) {
    assert.throws(() => evaluateEdrasQuestionnaire(questionnaire(answers)), /Beantworte/);
  }
  for (const seed of ['', 'a', 'space seed', '<script>', 'x'.repeat(65)]) {
    assert.throws(() => evaluateEdrasQuestionnaire(questionnaire(answerSet, seed)), /Seed/);
  }
  assert.throws(() => evaluateEdrasQuestionnaire({ ...questionnaire(), version: 'v2' }), /version/i);
  assert.throws(() => validateEdrasQuestionnaire({ ...EDRAS_PUBLIC_QUESTIONNAIRE, questions: [] }));
  assert.throws(() => validateEdrasQuestionnaire({ ...EDRAS_PUBLIC_QUESTIONNAIRE,
    questions: EDRAS_PUBLIC_QUESTIONNAIRE.questions.map((q, i) => i === 0
      ? { ...q, choices: [{ text: 'Fehler', axis: 'unbekannt', intensity: 3 }, ...q.choices.slice(1)] } : q) }));
});

test('B12: öffentlicher Nachweis übersteht JSON, lehnt Resultat-/Versionsfälschung ab', () => {
  const original = assessment();
  assert.deepEqual(verifyEdrasPublicAssessment(JSON.parse(JSON.stringify(original))), original.result);
  const reordered = { result: { techniqueId: original.result.techniqueId, ...original.result },
    answers: original.answers, seed: original.seed, version: original.version };
  assert.deepEqual(verifyEdrasPublicAssessment(reordered), original.result);
  for (const forged of [
    { ...original, result: { ...original.result, potential: 5 } },
    { ...original, result: { ...original.result, primaryAxis: 'unklar' } },
    { ...original, result: { ...original.result, secretResonance: 100 } },
    { ...original, result: { ...original.result, scores: { ...original.result.scores, schutz: 999 } } },
    { ...original, answers: [...original.answers.slice(0, 1), 2, ...original.answers.slice(2)] },
    { ...original, hiddenSeed: 123 },
    { ...original, version: 'edras-public-draft-2' },
  ]) assert.throws(() => verifyEdrasPublicAssessment(forged));
});

test('B12: Potenzial und Technik sind überprüft im bestehenden LE-Profil enthalten', () => {
  const proof = assessment();
  const edras = makeEdrasState({ ...context, potential: proof.result.potential,
    techniqueId: proof.result.techniqueId, publicAssessment: proof });
  assert.deepEqual(edras.publicAssessment, proof);
  assert.deepEqual(normalizeEdrasState(context, JSON.parse(JSON.stringify(edras))), edras);
  const next = applyEdrasAction(context, edras, 'spend');
  assert.deepEqual(next.publicAssessment, proof);
  assert.deepEqual(applyEdrasAction(context, next, 'longRest').publicAssessment, proof);
  assert.throws(() => makeEdrasState({ ...context, potential: 1, techniqueId: 'R', publicAssessment: proof }), /widersprechen/);
  assert.throws(() => normalizeEdrasState(context, { ...edras, potential: edras.potential === 5 ? 4 : 5 }), /widersprechen/);
  assert.ok(!Object.hasOwn(makeEdrasState({ ...context, potential: 2, techniqueId: 'R' }), 'publicAssessment'));
});

test('B12: Edras-Belastung nur für Edras-Technikchecks, keine allgemeine D&D-Mutation', () => {
  const vitals = { hp: 30, exhaustion: 1, conditions: ['poisoned'] };
  const standard = getD20RuleEffects(vitals, { kind: 'check', circumstance: 'normal' });
  assert.equal(standard.mode, 'disadvantage');
  for (let stress = 0; stress <= 5; stress++) {
    const effect = edrasTechniqueRules({ stress });
    assert.equal(effect.disadvantage, stress >= 2);
    assert.equal(effect.dcPenalty, stress >= 4 ? -2 : 0);
    assert.equal(effect.blocked, stress === 5);
    const technique = getEdrasTechniqueD20Rules({ stress }, vitals);
    assert.equal(technique.blocked, stress === 5);
    assert.equal(technique.penalty, -2);
    assert.equal(technique.techniqueDcPenalty, effect.dcPenalty);
    assert.deepEqual(getD20RuleEffects(vitals, { kind: 'check' }), standard);
  }
  const alone = getEdrasTechniqueD20Rules({ stress: 2 }, { hp: 30, conditions: [], exhaustion: 0 });
  assert.equal(alone.mode, 'disadvantage');
  assert.equal(resolveD20Roll(alone, [18, 7], { modifier: 3, dc: 10 }).success, true);
  assert.equal(resolveD20Roll(alone, [18, 7], { modifier: 2, dc: 10 }).success, false);
  const cancelled = getEdrasTechniqueD20Rules({ stress: 4 }, { hp: 30, conditions: [], exhaustion: 0 },
    { circumstance: 'advantage' });
  assert.equal(cancelled.mode, 'normal');
  assert.throws(() => resolveD20Roll(getEdrasTechniqueD20Rules({ stress: 5 }, { hp: 30 }), [15]));
  assert.throws(() => edrasTechniqueRules({ stress: 7 }));
});

test('B12: öffentliches Formular und sichere Auswertung verdrahtet; keine Klasse vom Fragebogen gesetzt', () => {
  const html = readFileSync(new URL('../studio.html', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../js/studio/edras-questionnaire.mjs', import.meta.url), 'utf8');
  for (const id of ['character-edras-questionnaire', 'character-edras-question-list', 'character-edras-seed',
    'character-edras-new-seed', 'character-edras-evaluate', 'character-edras-results', 'character-edras-apply']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const name of ['initEdrasQuestionnaire', 'invalidateEdrasQuestionnaire',
    'getAppliedEdrasAssessment', 'restoreEdrasQuestionnaire']) assert.match(studio, new RegExp(name));
  assert.match(studio, /publicAssessment: edras\.publicAssessment/);
  assert.match(ui, /verifyEdrasPublicAssessment/);
  assert.doesNotMatch(ui, /character-class.*\.value\s*=/);
  assert.doesNotMatch(JSON.stringify(EDRAS_PUBLIC_QUESTIONNAIRE), /hiddenSeed|trueResonance|secretMatrix|classId/i);
});
