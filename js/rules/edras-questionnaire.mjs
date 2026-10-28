/** Öffentlicher, konfigurierbarer Edras-Abgleich-Demonstrator.
 * KEIN Kanon oder SL-Geheimnis: Vorschläge bleiben ausdrücklich unverbindlich.
 */
export const EDRAS_QUESTIONNAIRE_VERSION = 'edras-public-draft-1';
export const EDRAS_PUBLIC_AXES = Object.freeze({
  schutz: 'Schutz', erkenntnis: 'Erkenntnis', wandel: 'Wandel', bindung: 'Bindung',
});
const AXES = Object.keys(EDRAS_PUBLIC_AXES);
const situation = (id, prompt, choices) => ({ id, prompt,
  choices: choices.map(([text, axis, intensity]) => ({ text, axis, intensity })) });

// Öffentlich sichtbare Beispiele für neutrale Alltagssituationen; der tatsächliche Kanon-Abgleich
// wird erst nach Freigabe der geheimen Originalmatrix in einer autorisierten Backend-Umgebung möglich.
export const EDRAS_PUBLIC_QUESTIONNAIRE = Object.freeze({
  version: EDRAS_QUESTIONNAIRE_VERSION,
  status: 'uncanonical-preview',
  questions: [
    situation('q01', 'Eine Gruppe gerät auf einer Reise unerwartet in Schwierigkeiten. Was tust du zuerst?', [
      ['Eine sichere Position schaffen.', 'schutz', 2], ['Den Grund herausfinden.', 'erkenntnis', 1], ['Alle koordinieren.', 'bindung', 1]]),
    situation('q02', 'Eine bekannte Lösung funktioniert nicht mehr. Wie reagierst du?', [
      ['Ich probiere eine andere Vorgehensweise.', 'wandel', 2], ['Ich prüfe die Annahmen.', 'erkenntnis', 2], ['Ich bitte um andere Perspektiven.', 'bindung', 1]]),
    situation('q03', 'Jemand bittet dich um eine schwierige Gefälligkeit.', [
      ['Ich kläre die Folgen, bevor ich zusage.', 'erkenntnis', 1], ['Ich helfe, wenn ich jemanden schützen kann.', 'schutz', 2], ['Wir finden gemeinsam eine Lösung.', 'bindung', 2]]),
    situation('q04', 'Du erreichst eine fremde Umgebung. Worauf achtest du zuerst?', [
      ['Mögliche Gefahren und Rückwege.', 'schutz', 1], ['Ungewöhnliche Einzelheiten.', 'erkenntnis', 2], ['Die Menschen vor Ort.', 'bindung', 1]]),
    situation('q05', 'Dein erster Plan scheitert. Was bleibt dir besonders wichtig?', [
      ['Flexibel zu bleiben.', 'wandel', 2], ['Niemanden zurückzulassen.', 'bindung', 2], ['Die Kontrolle zu behalten.', 'schutz', 1]]),
    situation('q06', 'Ein alter Gegenstand könnte eine neue Aufgabe erfüllen.', [
      ['Ich untersuche zuerst seine Funktion.', 'erkenntnis', 2], ['Ich baue ihn mutig um.', 'wandel', 2], ['Ich frage, wem er etwas bedeutet.', 'bindung', 1]]),
    situation('q07', 'Du kannst einen Streit beeinflussen.', [
      ['Ich verhindere eine Eskalation.', 'schutz', 2], ['Ich bringe die Beteiligten zusammen.', 'bindung', 2], ['Ich ändere die festgefahrene Situation.', 'wandel', 1]]),
    situation('q08', 'Vor dir liegt eine unbekannte Abzweigung.', [
      ['Ich sichere den bisherigen Weg.', 'schutz', 1], ['Ich erkunde den neuen Pfad.', 'wandel', 2], ['Ich suche nach Hinweisen.', 'erkenntnis', 2]]),
    situation('q09', 'Eine Person ist von einer Beobachtung überzeugt, du aber nicht.', [
      ['Ich prüfe die Fakten.', 'erkenntnis', 2], ['Ich höre zu und suche Gemeinsamkeiten.', 'bindung', 1], ['Ich teste eine Alternative.', 'wandel', 2]]),
    situation('q10', 'Bei einer Aufgabe bleibt kaum Zeit.', [
      ['Ich übernehme eine schützende Rolle.', 'schutz', 2], ['Ich vertraue auf spontane Anpassung.', 'wandel', 2], ['Ich teile die Aufgabe klar auf.', 'bindung', 1]]),
    situation('q11', 'Du findest Aufzeichnungen über ein ungelöstes Ereignis.', [
      ['Ich vergleiche die Quellen.', 'erkenntnis', 2], ['Ich suche einen neuen Zugang.', 'wandel', 1], ['Ich spreche mit Beteiligten.', 'bindung', 2]]),
    situation('q12', 'Du kannst eine knappe Ressource nur einmal einsetzen.', [
      ['Zum Absichern der Schwächsten.', 'schutz', 2], ['Zum Gewinnen wichtiger Erkenntnisse.', 'erkenntnis', 2], ['Zur Hilfe für das ganze Team.', 'bindung', 1]]),
    situation('q13', 'Ein Freund verändert seine Meinung grundlegend.', [
      ['Ich versuche ihn zu verstehen.', 'bindung', 2], ['Ich suche den Grund des Wandels.', 'erkenntnis', 1], ['Ich akzeptiere neue Wege.', 'wandel', 2]]),
    situation('q14', 'Eine größere Gruppe wartet auf eine Entscheidung.', [
      ['Ich schaffe erst verlässliche Bedingungen.', 'schutz', 2], ['Ich suche einen gemeinsamen Nenner.', 'bindung', 2], ['Ich schlage einen ungewöhnlichen Versuch vor.', 'wandel', 1]]),
    situation('q15', 'Du bemerkst ein wiederkehrendes ungewöhnliches Muster.', [
      ['Ich dokumentiere die Details.', 'erkenntnis', 2], ['Ich reagiere vorsorglich.', 'schutz', 1], ['Ich ändere mein Vorgehen.', 'wandel', 2]]),
    situation('q16', 'Du blickst auf einen schwierigen Abschnitt zurück.', [
      ['Wichtig war, dass andere sicher waren.', 'schutz', 2], ['Wichtig war, was wir gelernt haben.', 'erkenntnis', 1], ['Wichtig war, dass wir zusammenblieben.', 'bindung', 2]]),
    { id: 'experience', prompt: 'Wie viel praktische Erfahrung hat die Figur vor der Kampagne mit vergleichbaren Belastungssituationen?',
      choices: [{ text: 'Keine oder kaum', experience: 0 }, { text: 'Vereinzelte Erfahrungen', experience: 1 },
        { text: 'Regelmäßige Erfahrungen', experience: 2 }, { text: 'Sehr viel Erfahrung', experience: 3 }] },
  ],
});

const techniqueOptions = { schutz: ['W', 'K'], erkenntnis: ['R', 'G'],
  wandel: ['P', 'L'], bindung: ['E', 'S'] };
const hash32 = text => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value >>> 0;
};
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);

export function validateEdrasQuestionnaire(definition = EDRAS_PUBLIC_QUESTIONNAIRE) {
  if (!definition || typeof definition.version !== 'string' || !Array.isArray(definition.questions)
    || definition.questions.length !== 17 || definition.questions[16]?.id !== 'experience'
    || new Set(definition.questions.map(question => question.id)).size !== 17) {
    throw new Error('Ungültige Edras-Fragebogenversion oder unvollständiger Fragenkatalog.');
  }
  for (const [index, question] of definition.questions.entries()) {
    if (typeof question.id !== 'string' || typeof question.prompt !== 'string'
      || !Array.isArray(question.choices) || question.choices.length !== (index === 16 ? 4 : 3)) {
      throw new Error('Ungültige Edras-Frage oder Antwortanzahl.');
    }
    for (const option of question.choices) {
      if (typeof option.text !== 'string' || (index === 16 ?
        !Number.isInteger(option.experience) || option.experience < 0 || option.experience > 3 :
        !AXES.includes(option.axis) || !Number.isInteger(option.intensity) || option.intensity < 0 || option.intensity > 2)) {
        throw new Error('Ungültiges Antwortschema im Edras-Fragebogen.');
      }
    }
  }
  return true;
}

/** Nur öffentliche Vorschlagswerte. Seed verändert Gleichstände und die Technik-Auswahl pro Achse. */
export function evaluateEdrasQuestionnaire({ version, answers, seed }, definition = EDRAS_PUBLIC_QUESTIONNAIRE) {
  validateEdrasQuestionnaire(definition);
  if (version !== definition.version) throw new Error('Die Edras-Fragebogenversion hat sich geändert.');
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9_-]{4,64}$/.test(seed)) throw new Error('Ungültiger öffentlicher Seed.');
  if (!Array.isArray(answers) || answers.length !== 17 || answers.some((value, index) =>
    !Number.isInteger(value) || value < 0 || value >= definition.questions[index].choices.length)) {
    throw new Error('Beantworte alle 17 Edras-Fragen mit zulässigen Optionen.');
  }
  const counts = Object.fromEntries(AXES.map(axis => [axis, 0]));
  let intensity = 0;
  for (let index = 0; index < 16; index++) {
    const option = definition.questions[index].choices[answers[index]];
    counts[option.axis] += 1 + option.intensity;
    intensity += option.intensity;
  }
  const experience = definition.questions[16].choices[answers[16]].experience;
  const fingerprint = `${definition.version}:${seed}:${answers.join(',')}`;
  const most = Math.max(...Object.values(counts));
  const finalists = AXES.filter(axis => counts[axis] === most);
  const primaryAxis = finalists[hash32(fingerprint + ':axis') % finalists.length];
  const potential = Math.min(5, 1 + Math.floor((intensity + experience * 3) / 10));
  const possibleTechniques = techniqueOptions[primaryAxis];
  const techniqueId = possibleTechniques[hash32(fingerprint + ':technique') % possibleTechniques.length];
  return { version: definition.version, status: 'uncanonical-preview', primaryAxis,
    potential, techniqueId, scores: counts, experience };
}

/** Import/Editor darf ein öffentliches Ergebnis niemals ohne Nachprüfung übernehmen. */
export function verifyEdrasPublicAssessment(assessment, definition = EDRAS_PUBLIC_QUESTIONNAIRE) {
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)
    || Object.keys(assessment).some(key => !['version', 'seed', 'answers', 'result'].includes(key))) {
    throw new Error('Ungültiger öffentlicher Edras-Abgleich.');
  }
  const result = evaluateEdrasQuestionnaire(assessment, definition);
  if (canonical(assessment.result) !== canonical(result)) {
    throw new Error('Öffentliches Edras-Ergebnis passt nicht zum Seed oder zu den Antworten.');
  }
  return result;
}
