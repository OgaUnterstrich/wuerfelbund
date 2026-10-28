/** Statische, zugängliche Spielbogenansicht. Aktionen bleiben im bestehenden Tracker. */
const element = (tag, content = '', className = '') => {
  const item = document.createElement(tag);
  item.textContent = String(content);
  if (className) item.className = className;
  return item;
};
const signed = value => `${value >= 0 ? '+' : ''}${value}`;

export function renderCharacterSheet(root, sheet) {
  const previousDetails = new Map([...root.querySelectorAll('details[id]')].map(item => [item.id, item.open]));
  root.replaceChildren();
  const header = element('div', '', 'sheet-identity');
  const title = element('div');
  title.append(element('p', 'SPIELBOGEN · SRD 5.2.1', 'eyebrow'), element('h3', sheet.name || 'Unbenannte Figur'));
  title.append(element('p', `${sheet.classNames.map(klass => `${klass.name} ${klass.level}`).join(' / ')} · ${sheet.species} · ${sheet.background}`, 'form-hint'));
  header.append(title, element('span', `Stufe ${sheet.level}`, 'count'));
  root.append(header);

  const quick = element('div', '', 'sheet-quick-stats');
  for (const [name, value, hint] of [
    ['Trefferpunkte', `${sheet.hp}/${sheet.maxHp}`, sheet.tempHp ? `+${sheet.tempHp} temporär` : 'Aktuelle TP'],
    ['Rüstungsklasse', sheet.armorClass, 'Getragene Rüstung'],
    ['Initiative', signed(sheet.initiative), 'GE + bekannte Boni'],
    ['Tempo', `${sheet.speed} ft.`, 'Vor Zuständen'],
    ['Übungsbonus', signed(sheet.proficiencyBonus), `Gesamtstufe ${sheet.level}`],
    ['Passiv', sheet.passivePerception, 'Wahrnehmung · bekannte Zustände'],
  ]) {
    const stat = element('div', '', 'stat');
    stat.append(element('strong', value), element('span', name), element('small', hint));
    quick.append(stat);
  }
  root.append(quick);

  if (sheet.warnings.length) {
    const warnings = element('div', '', 'sheet-warnings');
    warnings.append(element('strong', 'Noch zu prüfen'));
    for (const warning of sheet.warnings) warnings.append(element('p', warning, 'form-hint'));
    root.append(warnings);
  }
  const expanded = element('details', '', 'vitals-details sheet-more');
  expanded.id = 'tracker-sheet-details';
  expanded.open = previousDetails.get(expanded.id) || false;
  expanded.append(element('summary', 'Attribute, Fertigkeiten, Merkmale und Quellen'));
  expanded.append(element('h4', 'Attribute'));
  const scores = element('div', '', 'sheet-attributes');
  for (const ability of sheet.attributes) {
    const stat = element('div', '', 'sheet-ability');
    stat.setAttribute('aria-label', `${ability.name} ${ability.score}, Modifikator ${signed(ability.modifier)}`);
    stat.append(element('span', ability.id.toUpperCase()), element('strong', signed(ability.modifier)),
      element('small', `${ability.score} · ${ability.name}`));
    scores.append(stat);
  }
  expanded.append(scores);

  expanded.append(element('h4', 'Rettungswürfe'));
  const saving = element('div', '', 'sheet-saves');
  for (const entry of sheet.savingThrows) {
    const label = sheet.attributes.find(attr => attr.id === entry.id).name;
    const line = element('div', '', `sheet-save${entry.trained ? ' trained' : ''}`);
    line.append(element('span', label), element('strong', signed(entry.modifier)),
      element('small', entry.trained ? 'Geübt' : 'Ungeübt'));
    saving.append(line);
  }
  expanded.append(saving);

  const skills = element('details', '', 'vitals-details'); skills.id = 'tracker-skills';
  skills.open = previousDetails.get(skills.id) || false;
  skills.append(element('summary', `Fertigkeiten · ${sheet.skills.filter(entry => entry.trained).length}/18 geübt`));
  const skillList = element('div', '', 'sheet-checks');
  for (const entry of [...sheet.skills].sort((a, b) => Number(b.trained) - Number(a.trained) || a.name.localeCompare(b.name, 'de'))) {
    const line = element('div', '', 'sheet-check');
    line.append(element('span', entry.name), element('strong', signed(entry.modifier)),
      element('small', entry.expertise ? 'Expertise' : entry.trained ? 'Geübt' : '–'));
    if (entry.minimumD20) line.title = 'Reliable Talent: W20-Minimum 10 bei zulässigen Fertigkeitsproben';
    skillList.append(line);
  }
  skills.append(skillList);
  expanded.append(skills);

  if (sheet.spellcasting.length) {
    expanded.append(element('h4', 'Zauberangriffe & Rettungswurf-SG'));
    const spells = element('div', '', 'sheet-spellcasting');
    for (const source of sheet.spellcasting) {
      const line = element('p', `${source.className} ${source.level} · Angriff ${signed(source.attackBonus)} · SG ${source.saveDC}`, 'form-hint');
      spells.append(line);
    }
    expanded.append(spells);
  }

  const features = element('details', '', 'vitals-details'); features.id = 'tracker-features';
  features.open = previousDetails.get(features.id) || false;
  features.append(element('summary', `Klassen- und Unterklassenmerkmale · ${sheet.features.length}`));
  const list = element('ul', '', 'sheet-feature-list');
  for (const item of sheet.features) {
    const row = element('li');
    row.append(element('span', `${item.source} ${item.level}`));
    if (item.description) {
      const detail = element('details', '', 'sheet-feature-detail');
      detail.append(element('summary', item.name), element('p', item.description, 'sheet-description'));
      row.append(detail);
    } else row.append(element('strong', item.name));
    list.append(row);
  }
  if (!sheet.features.length) list.append(element('li', 'Keine Merkmale im aktuellen SRD-Stufenbereich.'));
  features.append(list);
  expanded.append(features);

  const traits = element('details', '', 'vitals-details'); traits.id = 'tracker-ancestry';
  traits.open = previousDetails.get(traits.id) || false;
  traits.append(element('summary', `Speziesmerkmale · ${sheet.ancestry.length}`));
  const traitList = element('ul', '', 'sheet-feature-list');
  for (const trait of sheet.ancestry) {
    const line = element('li');
    line.append(element('span', `Ab Stufe ${trait.level}`));
    if (trait.description) {
      const detail = element('details', '', 'sheet-feature-detail');
      detail.append(element('summary', trait.name), element('p', trait.description, 'sheet-description'));
      line.append(detail);
    } else line.append(element('strong', trait.name));
    traitList.append(line);
  }
  traits.append(traitList);
  expanded.append(traits);

  if (sheet.classChoices.length) {
    const choices = element('details', '', 'vitals-details');
    choices.append(element('summary', `Gewählte Klassenoptionen · ${sheet.classChoices.length}`));
    const lines = element('ul', '', 'sheet-feature-list');
    for (const choice of sheet.classChoices) {
      const line = element('li');
      line.append(element('span', choice.name), element('strong', choice.value));
      lines.append(line);
    }
    choices.append(lines);
    expanded.append(choices);
  }

  const source = element('details', '', 'vitals-details'); source.id = 'tracker-sources';
  source.open = previousDetails.get(source.id) || false;
  source.append(element('summary', 'Herkunft, Sprachen, Ausrüstung und Regelgrenzen'));
  for (const info of [
    `Regelbasis: SRD 5.2.1 · Weltmodul: ${sheet.world}`,
    `Herkunft: ${sheet.species} · ${sheet.background}${sheet.subclass ? ` · ${sheet.subclass}` : ''}`,
    `Sprachen: ${sheet.languages.join(', ') || 'keine notiert'}`,
    `Werkzeuge: ${sheet.tools.join(', ') || 'keine notiert'}`,
    `Angelegte Rüstung: ${sheet.armor} · Schild: ${sheet.shield ? 'ja' : 'nein'}`,
    `Bestätigte Herkunftsresistenzen: ${sheet.resistances.join(', ') || 'keine'}`,
    `Talente: ${sheet.chosenFeats.map(feat => `${feat.name} (${feat.source})`).join(', ') || 'keine'}`,
  ]) source.append(element('p', info, 'form-hint'));
  source.append(element('p', 'Berechnung: Klasse/Stufenchronik, Attribute, Herkunft, Talente und angelegte Rüstung aus demselben SRD-Profil. Nicht strukturierte Effekte, magische Boni und konkrete SL-Entscheidungen bleiben manuell.', 'form-hint'));
  expanded.append(source);
  root.append(expanded);
}
