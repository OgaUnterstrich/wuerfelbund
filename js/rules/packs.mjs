import { validatePack } from './engine.mjs';

export const PACKS_STORAGE_KEY = 'wuerfelbund-rulepacks-v1';

export function makePack(name, identity = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))) {
  const slug = String(identity).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 45);
  return { schemaVersion: 1, id: `pack.${slug}`, version: 1, name: String(name).trim().slice(0, 90), abilities: [], source: 'homebrew' };
}

export function loadLocalPacks(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(PACKS_STORAGE_KEY));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(pack => validatePack(pack).length === 0).slice(0, 50);
  } catch { return []; }
}

export function saveLocalPacks(packs, storage = globalThis.localStorage) {
  if (!Array.isArray(packs) || packs.length > 50) throw new Error('Zu viele Pakete.');
  for (const pack of packs) {
    const errors = validatePack(pack);
    if (errors.length) throw new Error(errors[0]);
  }
  storage.setItem(PACKS_STORAGE_KEY, JSON.stringify(packs));
}

export function importPackJson(source) {
  if (typeof source !== 'string' || source.length > 250000) throw new Error('Regelpaket ist zu groß.');
  let pack;
  try { pack = JSON.parse(source); } catch { throw new Error('Kein gültiges JSON.'); }
  const errors = validatePack(pack);
  if (errors.length) throw new Error(errors.slice(0, 3).join(' '));
  return pack;
}
