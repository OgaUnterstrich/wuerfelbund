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

/** Alle Kampagnenindizes laden, aber nie mehr als 20 Cloud-Lesungen parallel. */
export async function loadIndexedCampaigns(records, readCampaign, isCurrent) {
  const campaigns = [];
  for (let offset = 0; offset < records.length; offset += 20) {
    if (!isCurrent()) return null; // Abmeldung/Kampagnenwechsel: veraltete Antwort verwerfen.
    const group = await Promise.all(records.slice(offset, offset + 20).map(async record => {
      try { return await readCampaign(record); }
      catch (error) {
        // Verwaiste Indizes sind zulässig. Netzwerk-/Serverausfälle dagegen anzeigen.
        if (error?.code === 'permission-denied' || error?.code === 'not-found') return null;
        throw error;
      }
    }));
    campaigns.push(...group);
  }
  return campaigns.filter(Boolean);
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
