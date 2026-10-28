import { test, expect } from '@playwright/test';
import { isolateBrowserNetwork } from './network.mjs';

async function chooseDifferentValues(selects) {
  const used = new Set();
  for (const field of await selects.all()) {
    const values = await field.locator('option').evaluateAll(options => options
      .filter(option => option.value && !option.disabled).map(option => option.value));
    const choice = values.find(value => !used.has(value));
    expect(choice, 'Für jede Pflichtwahl muss eine unterschiedliche gültige Option vorhanden sein').toBeTruthy();
    await field.selectOption(choice);
    used.add(choice);
  }
}

test('320px: vollständigen SRD-Helden erstellen, speichern, nachladen und im Spiel rasten', async ({ page, context }) => {
  await isolateBrowserNetwork(context);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/studio.html#characters');
  await expect.poll(() => page.locator('#character-class option').count()).toBeGreaterThan(1);

  await page.locator('#character-name').fill('B15-C2 Ulf');
  await page.locator('#character-class').selectOption('barbarian');
  await page.locator('#character-level').fill('1');
  await page.locator('#character-species').selectOption('dwarf');
  await page.locator('#character-background').selectOption('soldier');
  await chooseDifferentValues(page.locator('#character-heritage-choices [data-origin-key^="language"]'));
  await chooseDifferentValues(page.getByLabel('Werkzeug des Hintergrunds'));
  await chooseDifferentValues(page.locator('#character-skill-choices select'));
  if (await page.locator('#character-mastery').isVisible()) {
    await page.locator('#character-mastery > summary').click();
    await chooseDifferentValues(page.locator('#character-mastery-choices select'));
  }
  await page.locator('#character-starter > summary').click();
  await chooseDifferentValues(page.locator('#character-kit-class'));
  const backgroundKit = page.locator('#character-kit-background');
  const backgroundKits = await backgroundKit.locator('option').evaluateAll(options => options
    .filter(option => option.value && !option.disabled).map(option => option.value));
  await backgroundKit.selectOption(backgroundKits.at(-1)); // Münzvariante ohne weitere Pflichtwahl
  await page.screenshot({ path: test.info().outputPath('held-mobile-auswahl.png'), fullPage: true });
  const formOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(formOverflow, 'Vollständiger Charakterbogen darf auf 320px seitlich nicht aus dem Bild ragen').toBeLessThanOrEqual(1);
  await page.locator('#character-save').click();

  const stored = async () => page.evaluate(() => JSON.parse(localStorage.getItem('wuerfelbund-save-v1') || '{}')
    .characters?.find(character => character.name === 'B15-C2 Ulf'));
  await expect.poll(stored).toBeTruthy();
  await expect(page.locator('#character-errors')).toBeHidden();
  await page.reload();
  await page.locator('#character-mode-play').click();
  await expect(page.locator('#tracker-panel')).toBeVisible();
  await expect(page.locator('#tracker-character')).toContainText('B15-C2 Ulf');
  await expect(page.locator('#tracker-vitals .vitals-values')).toContainText('TP 14 / 14');
  await page.locator('#tracker-vitals input[aria-label="Schaden, Heilung oder temporäre TP"]').fill('3');
  await page.locator('#tracker-vitals').getByRole('button', { name: 'Schaden', exact: true }).click();
  await expect(page.locator('#tracker-vitals .vitals-values')).toContainText('TP 11 / 14');
  const resourceRow = page.locator('#tracker-list .tracker-row').first();
  const initialResource = await resourceRow.locator('strong').textContent();
  await resourceRow.getByRole('button', { name: /eine Nutzung verbrauchen/ }).click();
  await expect(page.locator('#tracker-list .tracker-row').first().locator('strong')).not.toHaveText(initialResource.trim());
  await page.locator('#tracker-short-rest').click();
  await page.locator('#tracker-long-rest').click();
  await expect(page.locator('#tracker-vitals .vitals-values')).toContainText('TP 14 / 14');
  await expect(page.locator('#tracker-list .tracker-row').first().locator('strong')).toHaveText(initialResource.trim());
  const trackerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(trackerOverflow, 'Mobiler Spielbogen darf auf 320px nicht seitlich überlaufen').toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath('held-mobile-spielbogen.png'), fullPage: true });

  await page.locator('#tracker-edit').click();
  await expect(page.locator('#character-name')).toHaveValue('B15-C2 Ulf');
  await page.locator('#character-level').fill('2');
  await page.locator('#character-save').click();
  await expect.poll(async () => (await stored())?.level).toBe(2);
  await expect(page.locator('#character-errors')).toBeHidden();
});
