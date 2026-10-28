/** Keine implizite Firebase-Projektauswahl: C3 darf niemals auf Produktion zeigen. */
export function verifiedStagingTarget(environment = process.env) {
  const id = String(environment.WB_C3_PROJECT_ID || '').trim();
  if (!/^[a-z][a-z0-9-]{5,28}[a-z0-9]$/.test(id) || !id.includes('staging')
    || id === 'wuerfelbund' || id.startsWith('demo-')) {
    throw new Error('C3 gesperrt: Projekt-ID muss eine eigenständige Firebase-ID mit „staging“ sein (niemals wuerfelbund/demo-*).');
  }
  if (environment.WB_C3_CONFIRM !== `STAGING:${id}`) {
    throw new Error(`C3 gesperrt: WB_C3_CONFIRM muss exakt STAGING:${id} sein.`);
  }
  if (environment.FIRESTORE_EMULATOR_HOST || environment.FIREBASE_AUTH_EMULATOR_HOST
    || environment.GCLOUD_PROJECT && environment.GCLOUD_PROJECT !== id
    || environment.GOOGLE_CLOUD_PROJECT && environment.GOOGLE_CLOUD_PROJECT !== id) {
    throw new Error('C3 gesperrt: Emulator- oder abweichende Cloud-Projektumgebung erkannt.');
  }
  return id;
}
