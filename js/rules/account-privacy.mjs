/** Reine Entscheidungslogik für Kontoauskunft und geschützte Kontoauflösung. */
export function validateHandover({ actorId, ownerId, successorId, successorRole, successorBlocked, emailVerified }) {
  if (!emailVerified) throw new Error('Bitte bestätige zuerst deine E-Mail-Adresse.');
  if (!actorId || ownerId !== actorId) throw new Error('Nur die aktuelle Spielleitung darf den Besitz übergeben.');
  if (!successorId || successorId === actorId || successorRole !== 'player' || successorBlocked) {
    throw new Error('Wähle ein aktives, nicht gesperrtes Kampagnenmitglied als neue Spielleitung.');
  }
  return successorId;
}

/** Niemals ein Auth-Konto löschen, solange Cloud-Daten unsichtbar/unerreichbar sind. */
export function assertErasurePossible(campaigns) {
  for (const campaign of campaigns) {
    if (campaign.owner) {
      throw new Error(`Du leitest noch „${campaign.name}“. Übergib zuerst die Spielleitung.`);
    }
    if (!campaign.accessible) {
      throw new Error(`„${campaign.name}“ ist nicht vollständig zugänglich. Bitte den Betreiber um eine sichere Löschung, bevor du das Konto entfernst.`);
    }
  }
  return true;
}

/** Ein Export erfasst ausschließlich die eigenen Figuren, auch wenn SL mehr lesen darf. */
export function ownCharacterRecords(records, userId) {
  return records.filter(record => record.ownerId === userId);
}

export function accountArchive({ uid, email, emailVerified, campaigns, personalPacks, exportedAt }) {
  return {
    format: 'wuerfelbund-account-export-v1',
    exportedAt,
    account: { uid, email, emailVerified: Boolean(emailVerified) },
    campaigns: campaigns.map(campaign => ({
      id: campaign.id, name: campaign.name, description: campaign.description,
      owner: Boolean(campaign.owner), ownCharacters: ownCharacterRecords(campaign.characters, uid),
      ...(campaign.owner ? { dmPrivate: campaign.dmPrivate || [], publishedPacks: campaign.publishedPacks || [] } : {}),
    })),
    personalPacks,
    notice: 'Nur im Würfelbund-Client zugängliche Cloud-Daten. Provider-Protokolle und fremde Kampagnendaten sind nicht enthalten; für eine vollständige Auskunft bitte den Betreiber kontaktieren.',
  };
}
