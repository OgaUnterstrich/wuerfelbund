/** 5.2.1-SRD-Magiegegenstände als echte Instanzen; Ladungsregeln bleiben manuell. */
const MAX_MAGIC_ITEMS = 60;
const MAX_CHARGES = 999;

export function normalizeMagicItems(catalog, previous = []) {
  if (!Array.isArray(catalog)) throw new Error('SRD-Magiegegenstände fehlen.');
  const known = new Map(catalog.map(item => [item.index, item]));
  const output = [];
  const ids = new Set();
  let attunedCount = 0;
  const attunedKinds = new Set();
  for (const record of Array.isArray(previous) ? previous.slice(0, MAX_MAGIC_ITEMS) : []) {
    if (!record || !known.has(record.catalogId) || typeof record.instanceId !== 'string'
      || !/^mi[1-9]\d{0,8}$/.test(record.instanceId) || ids.has(record.instanceId)) continue;
    ids.add(record.instanceId);
    const definition = known.get(record.catalogId);
    const attuned = definition.attunement === true && record.attuned === true
      && attunedCount < 3 && !attunedKinds.has(record.catalogId);
    if (attuned) { attunedCount++; attunedKinds.add(record.catalogId); }
    const maxCharges = Number.isSafeInteger(record.maxCharges) && record.maxCharges > 0
      && record.maxCharges <= MAX_CHARGES ? record.maxCharges : null;
    output.push({ instanceId: record.instanceId, catalogId: record.catalogId, attuned,
      maxCharges, charges: maxCharges === null ? null
        : Number.isSafeInteger(record.charges) ? Math.min(maxCharges, Math.max(0, record.charges)) : maxCharges });
  }
  return output;
}

export function changeMagicItems(catalog, previous, operation) {
  const items = normalizeMagicItems(catalog, previous);
  const definition = catalog.find(entry => entry.index === operation?.catalogId);
  if (operation?.type === 'add') {
    if (!definition || items.length >= MAX_MAGIC_ITEMS) throw new Error('Gegenstand unbekannt oder Inventarlimit erreicht.');
    const highest = items.reduce((max, entry) => Math.max(max, Number(entry.instanceId.slice(2))), 0);
    if (highest >= 999999999) throw new Error('Gegenstands-IDs erschöpft.');
    return [...items, { instanceId: `mi${highest + 1}`, catalogId: definition.index,
      attuned: false, maxCharges: null, charges: null }];
  }
  const index = items.findIndex(entry => entry.instanceId === operation?.instanceId);
  if (index === -1) throw new Error('Diese Gegenstandsinstanz existiert nicht.');
  if (operation.type === 'remove') return items.filter((_, position) => position !== index);
  const entry = { ...items[index] };
  if (operation.type === 'attune') {
    const source = catalog.find(item => item.index === entry.catalogId);
    if (typeof operation.active !== 'boolean' || operation.active && source.attunement !== true) {
      throw new Error('Dieser Gegenstand kann nicht eingestimmt werden.');
    }
    if (operation.active && !entry.attuned && items.filter(item => item.attuned).length >= 3) {
      throw new Error('Maximal drei Gegenstände gleichzeitig einstimmen.');
    }
    if (operation.active && !entry.attuned && items.some(item => item.attuned && item.catalogId === entry.catalogId)) {
      throw new Error('Nicht auf zwei Exemplare desselben Gegenstands einstimmen.');
    }
    entry.attuned = operation.active;
  } else if (operation.type === 'capacity') {
    if (!Number.isSafeInteger(operation.max) || operation.max < 0 || operation.max > MAX_CHARGES) {
      throw new Error('Ladungskapazität muss zwischen 0 und 999 liegen.');
    }
    entry.maxCharges = operation.max || null;
    entry.charges = operation.max || null;
  } else if (operation.type === 'charge') {
    if (entry.maxCharges === null || !Number.isSafeInteger(operation.delta) || ![-1, 1].includes(operation.delta)
      || entry.charges + operation.delta < 0 || entry.charges + operation.delta > entry.maxCharges) {
      throw new Error('Ladungen fehlen oder Limit erreicht.');
    }
    entry.charges += operation.delta;
  } else throw new Error('Unbekannte magische Gegenstandsaktion.');
  items[index] = entry;
  return items;
}
