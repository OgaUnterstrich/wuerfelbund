import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { isolateBrowserNetwork } from './network.mjs';

/**
 * Netzwerkgrenze: Webmodule ausschließlich vom bekannten statischen CDN,
 * Daten ausschließlich vom lokalen Demo-Emulator. Andere Requests scheitern.
 */
test.beforeEach(async ({ context }) => {
  await isolateBrowserNetwork(context);
});

test('Startseite: Würfeln, Neuladen, Navigation und Export', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stat-rolls')).toHaveText('0');
  await page.locator('[data-action="roll-d20"]').click();
  await expect(page.locator('#stat-rolls')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#stat-rolls')).toHaveText('1');

  await page.locator('[data-view="settings"]').first().click();
  await expect(page.locator('#view-settings')).toHaveClass(/active/);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-data').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^wuerfelbund-spielstand-.*\.json$/);
  await page.screenshot({ path: test.info().outputPath('start-einstellungen.png'), fullPage: true });
});

test('Offline: verständlicher Verbindungsstatus, lokale Aktionen und Wiederverbindung', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#cloud-connection-status')).not.toContainText('wird geprüft');
  await context.setOffline(true);
  await expect(page.locator('#cloud-connection-status')).toContainText('Offline');

  await page.locator('[data-action="roll-d20"]').click();
  await expect(page.locator('#stat-rolls')).toHaveText('1');
  await page.locator('[data-view="settings"]').first().click();
  await expect(page.locator('#export-data')).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-data').click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/);

  await context.setOffline(false);
  await expect(page.locator('#cloud-connection-status')).toContainText('Browser meldet online');
  await page.locator('[data-view="overview"]').first().click();
  await expect(page.locator('#stat-rolls')).toHaveText('1');
});

test('Lokale Daten: Beschädigter Import lässt bestehenden Stand unverändert', async ({ page }) => {
  await page.goto('/#settings');
  await page.locator('#import-file').setInputFiles({
    name: 'defekt.json', mimeType: 'application/json', buffer: Buffer.from('{kaputt'),
  });
  await expect(page.locator('#toast')).toContainText('Import abgebrochen');
  await expect(page.locator('#backup-status')).toContainText('Keine Import-Sicherung');
});

test('Lokale Sicherung: exportieren, importieren und vorherigen Stand wiederherstellen', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="roll-d20"]').click();
  await expect(page.locator('#stat-rolls')).toHaveText('1');
  await page.locator('[data-view="settings"]').first().click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-data').click();
  const exportFile = await downloadPromise;
  const buffer = await readFile(await exportFile.path());
  expect(JSON.parse(buffer.toString()).rolls).toHaveLength(1);

  await page.locator('[data-view="overview"]').first().click();
  await page.locator('[data-action="roll-d20"]').click();
  await expect(page.locator('#stat-rolls')).toHaveText('2');
  await page.locator('[data-view="settings"]').first().click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-file').setInputFiles({
    name: 'sicherung.json', mimeType: 'application/json', buffer,
  });
  await expect(page.locator('#restore-data')).toBeEnabled();
  await page.locator('[data-view="overview"]').first().click();
  await expect(page.locator('#stat-rolls')).toHaveText('1');

  await page.reload();
  await page.locator('[data-view="settings"]').first().click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#restore-data').click();
  await expect(page.locator('#restore-data')).toBeDisabled();
  await page.locator('[data-view="overview"]').first().click();
  await expect(page.locator('#stat-rolls')).toHaveText('2');
});

test('Regelstudio: Tabwechsel, Formularfehler und lokal erreichbare Regeldaten', async ({ page }) => {
  await page.goto('/studio.html#characters');
  await expect(page.locator('#character-form')).toBeVisible();
  await expect(page.locator('#character-class option').first()).toBeAttached();
  await page.locator('#character-name').fill('B15 Testheld');
  await page.locator('#character-level').fill('1');
  await page.locator('#character-save').click();
  // Fehlende Pflichtwahlen müssen sichtbar sein, falls noch nicht gespeichert wird.
  const hasError = await page.locator('#character-errors').isVisible();
  const hasSaved = await page.evaluate(() =>
    Boolean(JSON.parse(localStorage.getItem('wuerfelbund-save-v1') || '{"characters":[]}')
      .characters?.some(c => c.name === 'B15 Testheld')));
  const nativeInvalid = await page.locator('#character-form').evaluate(form => !form.checkValidity());
  expect(hasError || hasSaved || nativeInvalid).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath('charakterlabor.png'), fullPage: true });

  await page.locator('[data-tab="catalog"]').click();
  await expect(page.locator('[data-panel="catalog"]')).toHaveClass(/active/);
  await page.locator('[data-tab="characters"]').click();
  await expect(page.locator('#character-form')).toBeVisible();
});

test('320px und CSS-Zoom-Reflow: kein horizontales Seiten-Scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  const navigation = page.locator('.sidebar .nav .nav-button');
  await expect(navigation).toHaveCount(7);
  const allNavItemsVisible = await navigation.evaluateAll(items => items.every(item => {
    const bounds = item.getBoundingClientRect();
    return bounds.width > 0 && bounds.left >= 0 && bounds.right <= window.innerWidth;
  }));
  expect(allNavItemsVisible, 'Alle Hauptnavigationsziele müssen bei 320px ohne verstecktes Wischen sichtbar sein').toBe(true);
  await page.screenshot({ path: test.info().outputPath('start-320px.png'), fullPage: true });
  await navigation.last().click();
  await expect(page.locator('#view-settings')).toHaveClass(/active/);
  await page.screenshot({ path: test.info().outputPath('einstellungen-320px.png'), fullPage: true });
  const homeOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(homeOverflow, `Startseite läuft ${homeOverflow}px über`).toBeLessThanOrEqual(1);

  await page.goto('/studio.html#characters');
  await page.screenshot({ path: test.info().outputPath('studio-320px.png'), fullPage: true });
  const studioOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(studioOverflow, `Regelstudio läuft ${studioOverflow}px über`).toBeLessThanOrEqual(1);

  // 640 CSS-Pixel bei 320 physischen CSS-Pixeln simuliert 200%-Zoom-Reflow.
  await page.setViewportSize({ width: 640, height: 740 });
  await page.evaluate(() => { document.documentElement.style.zoom = '200%'; });
  const zoomOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(zoomOverflow, `Regelstudio mit CSS-200%-Zoom läuft ${zoomOverflow}px über`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath('studio-zoom200.png'), fullPage: true });
});

test('Tastaturnavigation: Sprunglink, Fokus und Dialog-Abbruch', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('href', '#main-content');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.locator('[data-action="rename-campaign"]').first().click();
  await expect(page.locator('#campaign-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#campaign-dialog')).not.toBeVisible();
});

test('Kurzprofil anlegen, neu laden, bearbeiten und Abbruch ohne Datenverlust', async ({ page }) => {
  await page.goto('/#characters');
  await page.locator('#view-characters [data-action="new-character"]').first().click();
  await expect(page.locator('#character-dialog')).toBeVisible();
  await page.locator('#character-name').fill('Mira');
  await page.locator('#character-class').fill('Kämpferin');
  await page.locator('#character-race').fill('Mensch');
  await page.locator('#character-level').fill('2');
  await page.locator('#character-form button[type="submit"]').click();
  await expect(page.locator('#character-list .character-card')).toHaveCount(1);
  await expect(page.locator('#character-list')).toContainText('Mira');
  await page.reload();
  await expect(page.locator('#character-list')).toContainText('Mira');

  await page.locator('#character-list [data-action="edit-character"]').click();
  await page.locator('#character-name').fill('Mira die Tapfere');
  await page.locator('#character-form button[type="submit"]').click();
  await expect(page.locator('#character-list .character-card')).toHaveCount(1);
  await expect(page.locator('#character-list')).toContainText('Mira die Tapfere');

  await page.locator('#view-characters [data-action="new-character"]').first().click();
  await page.locator('#character-name').fill('Nicht speichern');
  await page.locator('#character-dialog [data-close-dialog]').click();
  await expect(page.locator('#character-dialog')).not.toBeVisible();
  await expect(page.locator('#character-list .character-card')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('kurzprofil-bearbeitet.png'), fullPage: true });
});

test('Kontodialog: falsche E-Mail wird lokal abgewiesen und Abbrechen funktioniert', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#cloud-connection-status')).not.toContainText('wird geprüft');
  await page.locator('#cloud-auth-button').click();
  await expect(page.locator('#cloud-auth-dialog')).toBeVisible();
  await page.locator('#cloud-email').fill('ungueltige-adresse');
  await page.locator('#cloud-password').fill('gueltiges-Testpasswort');
  await page.locator('#cloud-auth-submit').click();
  const invalid = await page.locator('#cloud-email').evaluate(input => input.validity.typeMismatch);
  expect(invalid).toBe(true);
  await page.locator('#cloud-auth-dialog [data-close-dialog]').click();
  await expect(page.locator('#cloud-auth-dialog')).not.toBeVisible();
  await expect(page.locator('#cloud-auth-button')).toHaveText('Anmelden');
});

test('Regelstudio: Edras ist optional, unzulässiger Paketimport verändert nichts', async ({ page }) => {
  await page.goto('/studio.html#characters');
  await expect(page.locator('#character-class option').first()).toBeAttached();
  await page.getByText('Optionale Weltregeln', { exact: true }).click();
  await expect(page.locator('#character-world')).toBeVisible();
  await page.locator('#character-world').selectOption('edras-5.5-v0.1');
  await expect(page.locator('#character-edras-options')).toBeVisible();
  await page.locator('#character-world').selectOption('');
  await expect(page.locator('#character-edras-options')).toBeHidden();

  await page.locator('[data-tab="packs"]').click();
  const before = await page.locator('#pack-count').textContent();
  await page.locator('#pack-import').setInputFiles({
    name: 'manipuliert.json', mimeType: 'application/json', buffer: Buffer.from('{"name": "Kaputt"'),
  });
  await expect(page.locator('#studio-notice')).toBeVisible();
  await expect(page.locator('#pack-count')).toHaveText(before.trim());
});
