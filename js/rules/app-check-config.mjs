/** Öffentlicher reCAPTCHA-Enterprise-Site-Key, KEIN geheimer Server-Schlüssel.
 * Absichtlich leer bis Staging-Funktion, Android-Browser und Kosten geklärt sind.
 * Niemals einen Secret Key, Admin-Key oder CI-Debug-Token hier eintragen.
 */
export const enterpriseAppCheckSiteKey = '';

export function appCheckEnabled({ emulator, protocol }, siteKey = enterpriseAppCheckSiteKey) {
  return !emulator && protocol === 'https:' && typeof siteKey === 'string' && siteKey.trim().length > 0;
}
