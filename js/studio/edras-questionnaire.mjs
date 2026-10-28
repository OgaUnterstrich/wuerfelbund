/** Kein verdeckter Fragebogen-Algorithmus: ausschließlich öffentliche Vorschläge. */
import { EDRAS_PUBLIC_QUESTIONNAIRE, EDRAS_PUBLIC_AXES, evaluateEdrasQuestionnaire,
  verifyEdrasPublicAssessment } from '../rules/edras-questionnaire.mjs';
import { EDRAS_TECHNIQUES } from '../rules/edras.mjs';

const byId = id => document.getElementById(id);
let applied = null;
let pending = null;

const publicSeed = () => globalThis.crypto?.randomUUID?.().replaceAll('-', '')
  || `public${Date.now().toString(36)}`;
const text = (tag, value) => {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
};
const selections = () => [...byId('character-edras-question-list').querySelectorAll('select')];

function preview(assessment) {
  const result = verifyEdrasPublicAssessment(assessment);
  const technique = EDRAS_TECHNIQUES.find(entry => entry.id === result.techniqueId);
  byId('character-edras-results').textContent = `Öffentlicher Testvorschlag · ${EDRAS_PUBLIC_AXES[result.primaryAxis]}`
    + ` · Potenzial ${result.potential}/5 · ${technique.name}. Das ist KEIN geheimer oder kanonischer Resonanzwert.`;
  pending = assessment;
  byId('character-edras-apply').hidden = false;
}

export function invalidateEdrasQuestionnaire({ keepInputs = true } = {}) {
  applied = null;
  pending = null;
  byId('character-edras-apply').hidden = true;
  byId('character-edras-results').textContent = 'Noch nicht ausgewertet. Manuelle Werte bleiben davon unabhängig.';
  if (!keepInputs) {
    for (const select of selections()) select.value = '';
    byId('character-edras-seed').value = publicSeed();
  }
}

export function initEdrasQuestionnaire(onApply) {
  const box = byId('character-edras-question-list');
  box.replaceChildren();
  for (const [index, question] of EDRAS_PUBLIC_QUESTIONNAIRE.questions.entries()) {
    const label = text('label', `${index + 1}. ${question.prompt}`);
    const select = document.createElement('select');
    select.dataset.edrasQuestion = question.id;
    const empty = text('option', '– Bitte wählen –'); empty.value = '';
    select.append(empty);
    for (const [number, choice] of question.choices.entries()) {
      const option = text('option', choice.text); option.value = String(number);
      select.append(option);
    }
    label.append(select);
    box.append(label);
  }
  box.addEventListener('change', () => invalidateEdrasQuestionnaire());
  byId('character-edras-seed').value = publicSeed();
  byId('character-edras-seed').addEventListener('input', () => invalidateEdrasQuestionnaire());
  byId('character-edras-new-seed').addEventListener('click', () => {
    byId('character-edras-seed').value = publicSeed();
    invalidateEdrasQuestionnaire();
  });
  byId('character-edras-evaluate').addEventListener('click', () => {
    try {
      const current = { version: EDRAS_PUBLIC_QUESTIONNAIRE.version,
        answers: selections().map(select => select.value === '' ? null : Number(select.value)),
        seed: byId('character-edras-seed').value.trim() };
      preview({ ...current, result: evaluateEdrasQuestionnaire(current) });
    } catch (error) {
      invalidateEdrasQuestionnaire();
      byId('character-edras-results').textContent = error.message;
    }
  });
  byId('character-edras-apply').addEventListener('click', () => {
    if (!pending) return;
    const result = verifyEdrasPublicAssessment(pending);
    byId('character-edras-potential').value = String(result.potential);
    byId('character-edras-technique').value = result.techniqueId;
    applied = JSON.parse(JSON.stringify(pending));
    byId('character-edras-results').textContent += ' · Als öffentlicher Entwurf übernommen.';
    byId('character-edras-apply').hidden = true;
    onApply();
  });
}

export function getAppliedEdrasAssessment() {
  return applied ? JSON.parse(JSON.stringify(applied)) : null;
}

export function restoreEdrasQuestionnaire(assessment) {
  invalidateEdrasQuestionnaire({ keepInputs: false });
  if (!assessment) return;
  verifyEdrasPublicAssessment(assessment);
  byId('character-edras-seed').value = assessment.seed;
  for (const [index, choice] of assessment.answers.entries()) selections()[index].value = String(choice);
  preview(assessment);
  applied = JSON.parse(JSON.stringify(assessment));
  pending = null;
  byId('character-edras-apply').hidden = true;
  byId('character-edras-results').textContent += ' · Gespeicherter öffentlicher Entwurf.';
}
