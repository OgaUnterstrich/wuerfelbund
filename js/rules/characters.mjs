/** Gemeinsamer lokaler Spielstand. Ältere Regelprofile werden einmalig übernommen. */
export const SAVE_KEY = 'wuerfelbund-save-v1';
const OLD_PROFILES_KEY = 'wuerfelbund-ruleprofiles-v1';
export const IMPORT_BACKUP_KEY = 'wuerfelbund-import-backup-v1';

export const emptyGame = () => ({
  version: 1, campaign: '', characters: [], notes: [], rolls: [], rollCount: 0,
  encounter: { actors: [], turn: 0, round: 1 },
});

/** Beschädigte vorhandene Spielstände niemals still mit einem leeren Stand überschreiben. */
export function inspectGameStorage(storage) {
  let raw;
  try { raw = (storage ?? globalThis.localStorage).getItem(SAVE_KEY); }
  catch { return { status: 'blocked', message: 'Der Browserspeicher ist nicht erreichbar. Änderungen können nicht gesichert werden.' }; }
  if (raw === null) return { status: 'empty', message: '' };
  try {
    validateGameImport(JSON.parse(raw));
  } catch {
    return { status: 'invalid', message: 'Der vorhandene Spielstand ist beschädigt oder unbekannt. Automatisches Überschreiben ist gesperrt. Bitte Rohdaten exportieren und erst danach bewusst importieren oder zurücksetzen.' };
  }
  return { status: 'ready', message: '' };
}

/** Gemeinsamer, ausdrücklich fehlender statt still scheiternder Speicherweg. */
export function saveGame(game, storage) {
  const health = inspectGameStorage(storage);
  if (health.status === 'blocked' || health.status === 'invalid') throw new Error(health.message);
  validateGameImport(game);
  try { (storage ?? globalThis.localStorage).setItem(SAVE_KEY, JSON.stringify(game)); }
  catch { throw new Error('Spielstand konnte nicht gespeichert werden (Speicher voll oder blockiert). Bitte Speicher prüfen und vor weiteren Änderungen exportieren.'); }
}

/** Importgrenze: Kernstruktur strikt prüfen, optionale Regelprofile unverändert bewahren. */
export function validateGameImport(game) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  if (!record(game) || game.version !== 1 || !Array.isArray(game.characters)
    || !Array.isArray(game.notes) || game.characters.length > 200 || game.notes.length > 500
    || (game.campaign !== undefined && (typeof game.campaign !== 'string' || game.campaign.length > 80))) {
    throw new Error('Unbekanntes Spielstandformat oder ungültige Grunddaten.');
  }
  const characterIds = new Set();
  for (const character of game.characters) {
    if (!record(character) || !text(character.id, 100) || !text(character.name, 60)
      || !Number.isInteger(character.level) || character.level < 1 || character.level > 20
      || (character.className !== undefined && (typeof character.className !== 'string' || character.className.length > 50))
      || (character.race !== undefined && (typeof character.race !== 'string' || character.race.length > 50))
      || characterIds.has(character.id)) throw new Error('Figur beschädigt, doppelt oder außerhalb der erlaubten Grenzen.');
    characterIds.add(character.id);
    if (character.profile !== undefined && (!record(character.profile)
      || !text(character.profile.ruleset, 100)
      || (character.profile.ruleset === 'srd-5.2.1' && !text(character.profile.classId, 80)))) {
      throw new Error(`Das Regelprofil von „${character.name}“ ist beschädigt.`);
    }
  }
  const noteIds = new Set();
  for (const note of game.notes) {
    if (!record(note) || !text(note.id, 100) || !text(note.title, 100)
      || (note.body !== undefined && (typeof note.body !== 'string' || note.body.length > 10000))
      || (note.created !== undefined && (typeof note.created !== 'string' || !Number.isFinite(Date.parse(note.created))))
      || noteIds.has(note.id)) throw new Error('Chronikeinträge sind beschädigt oder doppelt.');
    noteIds.add(note.id);
  }
  if (game.rolls !== undefined && (!Array.isArray(game.rolls) || game.rolls.length > 30
    || game.rolls.some(roll => !record(roll) || !text(roll.id, 100)
      || !integer(roll.sides, 4, 100) || !integer(roll.count, 1, 20)
      || !integer(roll.mod, -100, 100) || !integer(roll.total, -100, 2100)
      || !Array.isArray(roll.values) || roll.values.length !== roll.count
      || roll.values.some(value => !integer(value, 1, roll.sides))))) {
    throw new Error('Würfelhistorie ist beschädigt.');
  }
  if (game.encounter !== undefined && (!record(game.encounter) || !Array.isArray(game.encounter.actors)
    || game.encounter.actors.length > 100 || game.encounter.actors.some(actor => !record(actor)
      || !text(actor.id, 100) || !text(actor.name, 60) || !integer(actor.initiative, -50, 100))
    || !integer(game.encounter.round, 1, 100000)
    || !integer(game.encounter.turn, 0, Math.max(0, game.encounter.actors.length - 1)))) {
    throw new Error('Kampfinitiative ist beschädigt.');
  }
  return game;
}

/** Import bleibt rückholbar; wenn die Sicherung scheitert, bleibt der aktuelle Stand bestehen. */
export function saveImportedGame(game, storage = globalThis.localStorage) {
  validateGameImport(game);
  const next = JSON.stringify(game);
  const previous = storage.getItem(SAVE_KEY);
  const olderBackup = storage.getItem(IMPORT_BACKUP_KEY);
  storage.setItem(IMPORT_BACKUP_KEY, previous === null ? JSON.stringify(emptyGame()) : previous);
  try { storage.setItem(SAVE_KEY, next); }
  catch (error) {
    // Fehlschläge der zweiten Schreiboperation dürfen auch die frühere Sicherung nicht opfern.
    try {
      if (olderBackup === null) storage.removeItem(IMPORT_BACKUP_KEY);
      else storage.setItem(IMPORT_BACKUP_KEY, olderBackup);
    } catch { /* ursprünglicher Spielstand bleibt unabhängig davon bestehen */ }
    throw error;
  }
}

/** Die letzte Import-Sicherung einmalig wiederherstellen. */
export function restoreImportedGame(storage = globalThis.localStorage) {
  const previous = storage.getItem(IMPORT_BACKUP_KEY);
  if (previous === null) throw new Error('Keine Import-Sicherung vorhanden.');
  let game;
  try { game = validateGameImport(JSON.parse(previous)); }
  catch { throw new Error('Die Import-Sicherung ist beschädigt. Der aktuelle Spielstand bleibt bestehen.'); }
  storage.setItem(SAVE_KEY, previous);
  try { storage.removeItem(IMPORT_BACKUP_KEY); } catch { /* wiederhergestellter Stand ist gültig */ }
  return game;
}

/** Nur lokalen Spielstand und alte Sicherungen entfernen; Regelpakete bleiben separat. */
export function resetSavedGame(storage = globalThis.localStorage) {
  storage.setItem(SAVE_KEY, JSON.stringify(emptyGame()));
  storage.removeItem(IMPORT_BACKUP_KEY);
  storage.removeItem(OLD_PROFILES_KEY);
}

export function readGame(storage = globalThis.localStorage) {
  let game;
  try { game = JSON.parse(storage.getItem(SAVE_KEY)); } catch { /* beschädigter Speicher */ }
  if (!game || game.version !== 1 || !Array.isArray(game.characters)) game = emptyGame();

  let oldProfiles;
  try { oldProfiles = JSON.parse(storage.getItem(OLD_PROFILES_KEY)); } catch { /* keine alten Profile */ }
  if (!oldProfiles || typeof oldProfiles !== 'object' || Array.isArray(oldProfiles)) return game;

  let changed = false;
  for (const character of game.characters) {
    if (!character || typeof character.id !== 'string' || character.profile) continue;
    const former = Object.hasOwn(oldProfiles, character.id) ? oldProfiles[character.id] : null;
    if (!former || typeof former !== 'object' || Array.isArray(former)
      || former.ruleset !== 'srd-5.2.1' || typeof former.classId !== 'string') continue;
    const { name: _oldName, level: _oldLevel, ...profile } = former;
    character.profile = profile;
    changed = true;
  }
  if (changed) {
    try { saveGame(game, storage); } catch { /* im Speicher nutzbar; beschädigte Originaldaten bleiben unverändert */ }
  }
  // Der alte Schlüssel bleibt als Sicherheitskopie bestehen, wird aber nie neu beschrieben.
  return game;
}

/** Einen Entwurf ergänzen oder exakt seinen bestehenden Eintrag ersetzen. */
export function upsertCharacter(game, next, editingId = '') {
  if (!game || !Array.isArray(game.characters) || typeof next?.id !== 'string' || !next.id
    || typeof next.profile?.ruleset !== 'string' || !next.profile.ruleset) {
    throw new Error('Ungültiger Charakterspielstand.');
  }
  const index = game.characters.findIndex(entry => entry?.id === next.id);
  if (!editingId) {
    if (index !== -1) throw new Error('Diese Charakter-ID existiert bereits.');
    if (game.characters.length >= 200) throw new Error('Die lokale Charakterliste ist bereits voll.');
    return { ...game, characters: [...game.characters, next] };
  }
  if (editingId !== next.id || index === -1 || game.characters[index]?.profile?.ruleset !== next.profile.ruleset) {
    throw new Error('Der zu bearbeitende Charakter wurde verändert oder ist nicht mehr vorhanden.');
  }
  return { ...game, characters: game.characters.map((entry, position) => position === index ? next : entry) };
}
