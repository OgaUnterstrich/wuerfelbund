import { emptyGame, validateGameImport } from './characters.mjs';
import { applyCharacterAction } from './character-actions.mjs';

/** Ein Firestore-Dokument enthält genau einen bestehenden lokalen Charakter. */
export function prepareCloudCharacter(character) {
  if (!character || typeof character !== 'object' || Array.isArray(character)) {
    throw new Error('Der Charakter ist ungültig.');
  }
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(character.id || '')) {
    throw new Error('Diese Charakter-ID ist nicht für die Cloud geeignet. Der lokale Entwurf bleibt erhalten.');
  }
  const selected = Object.fromEntries(
    ['id', 'name', 'className', 'race', 'level', 'profile']
      .filter(key => Object.hasOwn(character, key)).map(key => [key, character[key]]),
  );
  // Firestore verträgt keine undefined-/Funktionswerte. Fehler statt stiller Profildatenverluste.
  const check = (value, depth = 0) => {
    if (depth > 32) throw new Error('Das Charakterprofil ist zu tief verschachtelt.');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach(item => check(item, depth + 1)); return; }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      for (const [key, item] of Object.entries(value)) {
        if (/^__.*__$/.test(key) || ['constructor', 'prototype'].includes(key)) {
          throw new Error('Das Profil enthält nicht unterstützte Feldnamen.');
        }
        check(item, depth + 1);
      }
      return;
    }
    throw new Error('Das Profil enthält nicht speicherbare Werte.');
  };
  check(selected);
  const json = JSON.stringify(selected);
  if (new TextEncoder().encode(json).length > 700_000) {
    throw new Error('Das Profil ist für ein einzelnes Cloud-Dokument zu groß.');
  }
  const safeCharacter = JSON.parse(json);
  validateGameImport({ ...emptyGame(), characters: [safeCharacter] });
  return safeCharacter;
}

/** Cloud → lokal nur nach ausdrücklichem Nutzerwunsch, mit optionaler Konfliktfreigabe. */
export function mergeCloudCharacter(game, remote, { replace = false } = {}) {
  validateGameImport(game);
  if (!remote || remote.schemaVersion !== 1 || typeof remote.ownerId !== 'string') {
    throw new Error('Unbekannte Cloud-Charakterversion.');
  }
  const character = prepareCloudCharacter(remote.character);
  const index = game.characters.findIndex(entry => entry.id === character.id);
  if (index >= 0 && !replace) throw new Error('Eine lokale Figur mit dieser ID existiert bereits.');
  if (index === -1 && game.characters.length >= 200) throw new Error('Die lokale Charakterliste ist voll.');
  const characters = [...game.characters];
  if (index >= 0) characters[index] = character;
  else characters.push(character);
  const merged = { ...game, characters };
  validateGameImport(merged);
  return merged;
}

/** In derselben Firestore-Transaktion prüfen und anwenden; Transaktions-Retries sind rein. */
export async function commitCloudAction(transaction, reference, {
  operationId, action, catalog, serverTimestamp, validateCharacter,
}) {
  if (typeof operationId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(operationId)) {
    throw new Error('Ungültige Aktionskennung.');
  }
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists()) throw new Error('Cloud-Figur ist nicht mehr vorhanden.');
  const record = snapshot.data();
  if (record.schemaVersion !== 1) throw new Error('Unbekannte Cloud-Figurenversion.');
  const recent = Array.isArray(record.recentActionIds) ? record.recentActionIds : [];
  if (recent.includes(operationId)) return { duplicate: true, character: record.character };
  if (validateCharacter) validateCharacter(record.character);
  const character = prepareCloudCharacter(applyCharacterAction(record.character, catalog, action));
  if (validateCharacter) validateCharacter(character);
  transaction.update(reference, { character, updatedAt: serverTimestamp(),
    recentActionIds: [...recent.slice(-23), operationId] });
  return { duplicate: false, character };
}
