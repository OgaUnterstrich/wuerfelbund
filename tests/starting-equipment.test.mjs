import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getStartingKits, grantStartingKits, normalizeInventory } from '../js/rules/gear.mjs';

const load = async kind => JSON.parse(await readFile(new URL(`../data/srd-5.2.1/en/5e-SRD-${kind}.json`, import.meta.url), 'utf8'));
const fixtures = Promise.all([load('Classes'), load('Backgrounds'), load('Equipment')]);
const get = (list, id) => list.find(item => item.index === id);
const selections = (klass, background, equipment, classVariant = '0', backgroundVariant = '0') => {
  const choices = {};
  for (const [source, variantId, kind] of [[klass, classVariant, 'class'], [background, backgroundVariant, 'background']]) {
    const kit = getStartingKits(source, equipment).find(entry => entry.id === variantId);
    for (const choice of kit.choices) choices[`${kind}-${choice.id}`] = choice.options[0].id;
  }
  return { classVariant, backgroundVariant, choices };
};

test('Alle Klassen- und Hintergrund-Startausrüstungsoptionen sind aus dem SRD lesbar', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  assert.equal(classes.length, 12);
  assert.equal(backgrounds.length, 4);
  for (const source of [...classes, ...backgrounds]) {
    const kits = getStartingKits(source, equipment);
    assert.ok(kits.length >= 2, `${source.index}: mindestens zwei Alternativen`);
    assert.ok(kits.every((kit, i) => kit.id === String(i) && kit.label.startsWith(String.fromCharCode(65 + i))));
    for (const kit of kits) {
      assert.ok(Object.keys(kit.items).every(id => equipment.some(entry => entry.index === id)));
      for (const choice of kit.choices) {
        assert.ok(choice.options.length > 0, `${source.index}: keine leere Ausrüstungskategorie`);
        assert.ok(choice.options.every(option => equipment.some(entry => entry.index === option.id)));
      }
    }
  }
});

test('Verschiedene Quellen werden addiert: Kämpfer und Soldat mit Waffen, Pfeilen und beiden Geldbeträgen', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  const klass = get(classes, 'fighter');
  const background = get(backgrounds, 'soldier');
  const inventory = grantStartingKits({ classEntry: klass, background, equipment,
    selection: selections(klass, background, equipment) });
  assert.equal(inventory.items['chain-mail'], 1);
  assert.equal(inventory.items.greatsword, 1);
  assert.equal(inventory.items.javelin, 8);
  assert.equal(inventory.items.shortbow, 1);
  assert.equal(inventory.items.arrows, 20);
  assert.equal(inventory.coins.gp, 18);
  assert.ok(inventory.items.dice || inventory.items.dragonchess || inventory.items['three-dragon-ante']
    || inventory.items['playing-card-set'], 'Ausgewähltes Soldaten-Spielset');
});

test('Geldalternative gibt kein Ausrüstungspaket aus, aber beide korrekten Münzbeträge', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  const klass = get(classes, 'wizard');
  const background = get(backgrounds, 'sage');
  const inventory = grantStartingKits({ classEntry: klass, background, equipment,
    selection: selections(klass, background, equipment, '1', '1') });
  assert.deepEqual(inventory.items, {});
  assert.equal(inventory.coins.gp, 105);
});

test('Zauberbuch, Tasche und Hintergrundausrüstung lassen sich in einem Charakter kombinieren', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  const klass = get(classes, 'wizard');
  const background = get(backgrounds, 'sage');
  const inventory = grantStartingKits({ classEntry: klass, background, equipment,
    selection: selections(klass, background, equipment) });
  assert.equal(inventory.items.spellbook, 1);
  assert.equal(inventory.items.dagger, 2);
  assert.equal(inventory.items.quarterstaff, 2, 'Klasse und Hintergrund führen beide einen Stab');
  assert.equal(inventory.coins.gp, 13);
});

test('Barde: im externen Import ausgelassenes Instrument bleibt als Auswahl verfügbar', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  const klass = get(classes, 'bard');
  const background = get(backgrounds, 'criminal');
  const kit = getStartingKits(klass, equipment)[0];
  assert.ok(kit.choices.some(choice => choice.label === 'Musical Instrument'));
  const selected = selections(klass, background, equipment);
  assert.throws(() => grantStartingKits({ classEntry: klass, background, equipment,
    selection: { ...selected, choices: {} } }), /fehlt/);
  const inventory = grantStartingKits({ classEntry: klass, background, equipment, selection: selected });
  assert.equal(inventory.items[kit.choices[0].options[0].id], 1);
});

test('Mönch wählt selbst genau ein Werkzeug ODER Instrument; Kleriker wählt ein konkretes Symbol', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  const monk = get(classes, 'monk');
  const background = get(backgrounds, 'acolyte');
  const kit = getStartingKits(monk, equipment)[0];
  assert.equal(kit.choices.length, 1);
  const selected = selections(monk, background, equipment);
  const music = kit.choices[0].options.find(option => get(equipment, option.id).equipment_categories
    .some(cat => cat.index === 'musical-instruments'));
  assert.ok(music);
  selected.choices['class-option-0'] = music.id;
  const inventory = grantStartingKits({ classEntry: monk, background, equipment, selection: selected });
  assert.equal(inventory.items[music.id], 1);
  const cleric = get(classes, 'cleric');
  const holy = getStartingKits(cleric, equipment)[0].choices.find(choice => choice.label === 'Holy Symbols');
  assert.ok(holy?.options.some(option => option.id === 'amulet'));
});

test('Manipulierte Auswahlen werden zurückgewiesen, auch bei gültig existierenden fremden Gegenständen', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  const klass = get(classes, 'cleric');
  const background = get(backgrounds, 'acolyte');
  const chosen = selections(klass, background, equipment);
  assert.throws(() => grantStartingKits({ classEntry: klass, background, equipment,
    selection: { ...chosen, classVariant: 'other' } }), /variante/i);
  assert.throws(() => grantStartingKits({ classEntry: klass, background, equipment,
    selection: { ...chosen, choices: { ...chosen.choices, 'class-option-0': 'greatsword' } } }), /fehlt/);
  assert.throws(() => grantStartingKits({ classEntry: klass, background, equipment,
    selection: { ...chosen, choices: { ...chosen.choices, 'class-option-0': '' } } }), /fehlt/);
});

test('Jede Kombination aller 12 Klassen, 4 Hintergründe und 2–3 Varianten liefert ein gültiges Inventar', async () => {
  const [classes, backgrounds, equipment] = await fixtures;
  let total = 0;
  for (const klass of classes) for (const background of backgrounds) {
    for (const c of getStartingKits(klass, equipment)) for (const b of getStartingKits(background, equipment)) {
      const selection = selections(klass, background, equipment, c.id, b.id);
      const inventory = grantStartingKits({ classEntry: klass, background, equipment, selection });
      assert.deepEqual(normalizeInventory(equipment, JSON.parse(JSON.stringify(inventory))), inventory);
      assert.ok(Object.values(inventory.items).every(amount => amount > 0 && amount <= 9999));
      total++;
    }
  }
  assert.equal(total, 200);
});

test('Startpakete werden nur für neue Figuren vergeben und beim Bearbeiten nicht erneut gutgeschrieben', async () => {
  const script = await readFile(new URL('../js/studio/main.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio.html', import.meta.url), 'utf8');
  assert.match(html, /id="character-starter"/);
  assert.match(script, /\$\('#character-starter'\)\.hidden = !!id/);
  assert.match(script, /const inventory = previous \? normalizeInventory/);
  assert.match(script, /: grantStartingKits\(/);
  assert.match(script, /startingEquipment, inventory/);
});
