/** SRD-2024-Daten aus dem gepinnten Open-Source-Datensatz von 5e-bits. */

export const RULESET = Object.freeze({
  id: 'srd-5.2.1',
  name: 'D&D 5.5e – SRD 5.2.1',
  version: '5.2.1',
  language: 'en',
  license: 'CC-BY-4.0',
  original: 'https://www.dndbeyond.com/srd',
  dataset: 'https://github.com/5e-bits/5e-database',
});

export const CATEGORIES = Object.freeze({
  abilityScores: { label: 'Attribute', file: 'Ability-Scores' },
  alignments: { label: 'Gesinnungen', file: 'Alignments' },
  classes: { label: 'Klassen', file: 'Classes' },
  subclasses: { label: 'Unterklassen', file: 'Subclasses' },
  species: { label: 'Spezies', file: 'Species' },
  subspecies: { label: 'Abstammungen', file: 'Subspecies' },
  backgrounds: { label: 'Hintergründe', file: 'Backgrounds' },
  feats: { label: 'Talente', file: 'Feats' },
  features: { label: 'Klassenfähigkeiten', file: 'Features' },
  spells: { label: 'Zauber', file: 'Spells' },
  equipment: { label: 'Ausrüstung', file: 'Equipment' },
  equipmentCategories: { label: 'Ausrüstungskategorien', file: 'Equipment-Categories' },
  magicItems: { label: 'Magische Gegenstände', file: 'Magic-Items' },
  magicSchools: { label: 'Magieschulen', file: 'Magic-Schools' },
  monsters: { label: 'Monster', file: 'Monsters' },
  damageTypes: { label: 'Schadensarten', file: 'Damage-Types' },
  conditions: { label: 'Zustände', file: 'Conditions' },
  languages: { label: 'Sprachen', file: 'Languages' },
  poisons: { label: 'Gifte', file: 'Poisons' },
  levels: { label: 'Stufentabellen', file: 'Levels' },
  traits: { label: 'Speziesmerkmale', file: 'Traits' },
  proficiencies: { label: 'Übungen', file: 'Proficiencies' },
  skills: { label: 'Fertigkeiten', file: 'Skills' },
  weaponMasteries: { label: 'Waffenmeisterschaften', file: 'Weapon-Mastery-Properties' },
  weaponProperties: { label: 'Waffeneigenschaften', file: 'Weapon-Properties' },
});

const cache = new Map();
export async function loadCategory(category) {
  const entry = CATEGORIES[category];
  if (!entry) throw new Error(`Unbekannte SRD-Kategorie: ${category}`);
  if (!cache.has(category)) {
    const url = new URL(`../../data/srd-5.2.1/en/5e-SRD-${entry.file}.json`, import.meta.url);
    const pending = fetch(url).then(response => {
      if (!response.ok) throw new Error(`Regeldaten konnten nicht geladen werden (${response.status}).`);
      return response.json();
    }).then(data => {
      if (!Array.isArray(data)) throw new Error('Regeldaten haben ein ungültiges Format.');
      return data;
    }).catch(error => { cache.delete(category); throw error; });
    cache.set(category, pending);
  }
  return cache.get(category);
}

export async function listClassFeatures(classId, level, subclassId = '') {
  const [levels, features, subclasses] = await Promise.all([
    loadCategory('levels'), loadCategory('features'), loadCategory('subclasses'),
  ]);
  const upperLevel = Math.min(20, Math.max(1, Number(level) || 1));
  const refs = [];
  for (const row of levels) {
    if (row.class?.index !== classId || row.level > upperLevel) continue;
    for (const ref of row.features || []) refs.push({ index: ref.index, level: row.level });
  }
  const featureMap = new Map(features.map(feature => [feature.index, feature]));
  // Manche SRD-Fähigkeiten werden auf mehreren Stufen erneut vergeben,
  // z. B. Ability Score Improvement. Jede Vergabe ist ein eigener Eintrag.
  const result = refs.filter(ref => featureMap.has(ref.index)).map(ref => ({
    ...featureMap.get(ref.index), unlockedAt: ref.level,
    instanceId: `${ref.index}@${ref.level}`,
  }));
  if (subclassId) {
    const subclass = subclasses.find(item => item.index === subclassId && item.class?.index === classId);
    for (const feature of subclass?.features || []) {
      if (feature.level <= upperLevel) result.push({
        ...feature,
        index: `${subclassId}-${feature.level}-${feature.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        unlockedAt: feature.level,
      });
    }
  }
  return result.sort((a, b) => a.unlockedAt - b.unlockedAt);
}
