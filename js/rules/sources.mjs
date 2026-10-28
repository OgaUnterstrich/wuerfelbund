/** Eine Quellenauflösung für Kampagnen, Cloud-Aktionen und bestehende Hausregeln. */
import { RULESET } from './catalog.mjs';
import { validatePack } from './engine.mjs';

export const EDRAS_SOURCE = Object.freeze({ id: 'edras-v1', version: 1, name: 'Edras' });
const PACK_ID = /^pack\.[a-z0-9][a-z0-9.-]{3,79}$/;

export function defaultCampaignRules() {
  return { base: RULESET.id, worlds: [], packs: [] };
}

/** Ältere Kampagnen ohne `rules` sind explizit SRD-only, niemals implizit Edras. */
export function normalizeCampaignRules(value) {
  if (value == null) return defaultCampaignRules();
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['base', 'worlds', 'packs'].includes(key))
    || value.base !== RULESET.id || !Array.isArray(value.worlds) || !Array.isArray(value.packs)
    || value.worlds.length > 1 || value.packs.length > 6
    || value.worlds.some(id => id !== EDRAS_SOURCE.id)
    || value.packs.some(id => typeof id !== 'string' || !PACK_ID.test(id))
    || new Set(value.worlds).size !== value.worlds.length
    || new Set(value.packs).size !== value.packs.length) {
    throw new Error('Unbekannte, doppelte oder ungültige Kampagnen-Regelquellen.');
  }
  return { base: RULESET.id, worlds: [...value.worlds], packs: [...value.packs] };
}

/** Publikationen bleiben unveränderliche Nutzerdaten; B05 erlaubt nur eigene Originalregeln. */
export function preparePublishedPack(pack, publisherId) {
  const errors = validatePack(pack);
  if (errors.length) throw new Error(errors[0]);
  if (pack.source !== 'homebrew' || typeof publisherId !== 'string' || !publisherId) {
    throw new Error('Nur eigene, ausdrücklich freigegebene Hausregeln dürfen geteilt werden.');
  }
  const content = { schemaVersion: 1, id: pack.id, name: pack.name, version: pack.version,
    abilities: pack.abilities, source: 'homebrew', license: 'author-confirmed', publisherId };
  if (JSON.stringify(content).length > 60000 || pack.abilities.length > 50) {
    throw new Error('Kampagnenpaket zu groß: höchstens 50 Fähigkeiten und 60 KB.');
  }
  return structuredClone(content);
}

/** Gibt keine erfundenen Fähigkeiten zurück: ungültige/nicht vorhandene Quellen sind Konflikte. */
export function resolveCampaignSources(rules, publishedPacks = [], character = null) {
  const config = normalizeCampaignRules(rules);
  const errors = [], packs = [], seenAbilities = new Set();
  for (const id of config.packs) {
    const pack = publishedPacks.find(item => item?.id === id);
    if (!pack || pack.source !== 'homebrew' || pack.license !== 'author-confirmed'
      || validatePack(pack).length || pack.abilities.length > 50) {
      errors.push(`Quellenkonflikt: Paket ${id} fehlt oder ist nicht zulässig.`);
      continue;
    }
    for (const ability of pack.abilities) {
      if (seenAbilities.has(ability.id)) errors.push(`Quellenkonflikt: Fähigkeit ${ability.id} ist doppelt.`);
      seenAbilities.add(ability.id);
    }
    packs.push(pack);
  }
  if (character?.profile) {
    const profile = character.profile, refs = profile.sourceRefs || {};
    if (profile.ruleset !== RULESET.id || (refs.base && refs.base !== RULESET.id)) {
      errors.push('Quellenkonflikt: Charakter stammt aus einem anderen Regelsystem.');
    }
    if (profile.edras && !config.worlds.includes(EDRAS_SOURCE.id)) {
      errors.push('Quellenkonflikt: Edras ist in dieser Kampagne deaktiviert.');
    }
    if (refs.worlds && (typeof refs.worlds !== 'object' || Array.isArray(refs.worlds)
      || Object.entries(refs.worlds).some(([id, version]) => id !== 'edras' || version !== EDRAS_SOURCE.version
        || !config.worlds.includes(EDRAS_SOURCE.id)))) {
      errors.push('Quellenkonflikt: Weltmodul oder Weltversion ist nicht zugelassen.');
    }
    if (refs.packs && (typeof refs.packs !== 'object' || Array.isArray(refs.packs))) {
      errors.push('Quellenkonflikt: Paketquellen des Charakters sind ungültig.');
    } else {
      for (const [id, version] of Object.entries(refs.packs || {})) {
        const pack = packs.find(item => item.id === id);
        if (!pack || pack.version !== version) {
          errors.push(`Quellenkonflikt: ${id} Version ${version} ist nicht aktiv oder wurde aktualisiert.`);
        }
      }
    }
  }
  return { config, packs, worlds: config.worlds.includes(EDRAS_SOURCE.id) ? [EDRAS_SOURCE] : [],
    abilities: errors.length ? [] : packs.flatMap(pack => pack.abilities), errors, valid: errors.length === 0 };
}

/** Pinnt alte Quellenversionen explizit; neue Figuren übernehmen keine fremden Pakete automatisch. */
export function pinCharacterSources(character, rules, publishedPacks = []) {
  const resolved = resolveCampaignSources(rules, publishedPacks, character);
  if (!resolved.valid) throw new Error(resolved.errors[0]);
  if (!character?.profile) throw new Error('Nur vollständige Regelprofile dürfen Cloud-Quellen tragen.');
  const sourceRefs = {
    base: RULESET.id,
    worlds: character.profile.edras ? { edras: EDRAS_SOURCE.version } : {},
    packs: { ...(character.profile.sourceRefs?.packs || {}) },
  };
  return { ...character, profile: { ...character.profile, sourceRefs } };
}
