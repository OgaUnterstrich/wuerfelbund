/** Kleine gemeinsame UI-Entscheidungen – unabhängig von Browser und Cloud-Backend. */
const fold = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('de').replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();

export function matchesSearch(label, query) {
  const content = fold(label);
  return fold(query).split(' ').filter(Boolean).every(word => content.includes(word));
}

export function searchFeedback({ matches, total, pinned = 0 }) {
  if (![matches, total, pinned].every(Number.isSafeInteger) || matches < 0 || total < 0
    || pinned < 0 || matches + pinned > total) throw new Error('Ungültiger Suchstatus.');
  return `${matches} von ${total} Zaubereinträgen gefunden${pinned ? ` · ${pinned} bereits gewählt, zusätzlich sichtbar` : ''}`;
}

export function cloudConnectionState({ online, signedIn }) {
  if (!online) return { label: 'Offline · Online-Übertragung pausiert, lokale Daten bleiben erhalten', canTransfer: false };
  if (!signedIn) return { label: 'Browser meldet online · nicht angemeldet', canTransfer: false };
  return { label: 'Browser meldet online · Cloud-Aktionen benötigen Serverbestätigung', canTransfer: true };
}

/** Ältere gültige Spielstände dürfen Zeitstempel auslassen; die Ansicht muss trotzdem laden. */
export function storedDateLabel(value, { time = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) return 'Datum unbekannt';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Datum unbekannt';
  return new Intl.DateTimeFormat('de-DE', time
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
