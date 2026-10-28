import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { isolateBrowserNetwork } from './network.mjs';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

test.beforeEach(async ({ context }) => {
  await isolateBrowserNetwork(context);
});

async function auditVisiblePage(page, label) {
  // Kontrast nach dem echten Ansichtswechsel messen, sobald dessen kurze
  // Einblendanimation abgeschlossen ist (währenddessen ist der Text absichtlich transparent).
  await page.evaluate(async () => {
    const transitions = document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity);
    await Promise.all(transitions.map(animation => animation.finished.catch(() => {})));
  });
  if (!await page.evaluate(() => Boolean(window.axe))) await page.addScriptTag({ path: axePath });
  const findings = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map(({ id, impact, nodes }) => ({
      id, impact, elements: nodes.map(node => node.target.join(' ')).slice(0, 8),
    }));
  });
  const high = findings.filter(finding => ['serious', 'critical'].includes(finding.impact));
  if (findings.length) console.log(`${label}: ${JSON.stringify(findings)}`);
  expect(high, `${label}: schwerwiegende WCAG-Befunde: ${JSON.stringify(findings)}`).toEqual([]);
  return findings;
}

test('WCAG: alle lokalen Taverne-Ansichten bei 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  for (const view of ['dice', 'characters', 'combat', 'journal', 'settings']) {
    await page.locator(`[data-view="${view}"]`).first().click();
    await expect(page.locator(`#view-${view}`)).toBeVisible();
    await auditVisiblePage(page, `Taverne ${view}`);
  }
});

test('WCAG: Regelbibliothek und Homebrew-Editoren bei 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/studio.html#catalog');
  for (const tab of ['catalog', 'abilities', 'packs']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator(`[data-panel="${tab}"]`)).toBeVisible();
    await auditVisiblePage(page, `Regelstudio ${tab}`);
  }
});

test('WCAG: Startseite und Anmeldedialog ohne schwerwiegende automatisierte Befunde', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.locator('#view-overview')).toBeVisible();
  await auditVisiblePage(page, 'Startseite 320px');
  await page.locator('#cloud-auth-button').click();
  await expect(page.getByRole('dialog', { name: 'Willkommen zurück' })).toBeVisible();
  const dialogTree = await page.locator('#cloud-auth-dialog').ariaSnapshot();
  expect(dialogTree).toContain('textbox "E-Mail-Adresse"');
  await page.screenshot({ path: test.info().outputPath('anmeldung-320px.png'), fullPage: true });
  await auditVisiblePage(page, 'Anmeldedialog 320px');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cloud-auth-dialog')).toBeHidden();
});

test('WCAG: Charakterlabor und Formularfehler mit zugänglicher Fokusführung', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/studio.html#characters');
  await expect.poll(() => page.locator('#character-class option').count()).toBeGreaterThan(1);
  await auditVisiblePage(page, 'Charakterlabor 320px');

  await page.locator('#character-name').fill('Absichtlich unvollständig');
  await page.locator('#character-save').click();
  await expect(page.getByRole('region', { name: 'Fehler bei der Charaktererstellung' })).toBeVisible();
  await expect(page.locator('#character-errors')).toBeFocused();
  await page.screenshot({ path: test.info().outputPath('charakterfehler-320px.png'), fullPage: true });
  const firstError = page.locator('#character-errors .error-link').first();
  await expect(firstError).toBeVisible();
  await firstError.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#character-errors')).not.toBeFocused();
});

test('WCAG: Zauberwahl, Suche und Mehrklassenverlauf bei 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/studio.html#characters');
  await expect.poll(() => page.locator('#character-class option').count()).toBeGreaterThan(1);
  await page.locator('#character-name').fill('Mehrklassen-Entwurf');
  await page.locator('#character-class').selectOption('cleric');
  await page.locator('#character-level').fill('2');

  await page.locator('#character-multiclass > summary').click();
  await page.locator('#character-multiclass-enabled').check();
  await page.locator('#character-level-history [data-history-level="2"]').selectOption('fighter');
  await expect(page.locator('#character-multiclass-count')).toContainText('2 Klassen');

  await expect(page.locator('#character-spells')).toBeVisible();
  await page.locator('#character-spells > summary').click();
  const cantrips = page.locator('#character-spell-options [data-spell-kind="cantrips"]');
  await expect.poll(() => cantrips.count()).toBeGreaterThan(0);
  await cantrips.first().check();
  await expect(page.locator('#character-spells-count')).toContainText('1/');
  await page.locator('#character-spell-search').fill('Feuer');
  await expect(page.locator('#character-spell-search-status')).not.toContainText('wird geladen');
  await page.locator('#character-spell-search').fill('');

  await auditVisiblePage(page, 'Mehrklassen und Zauberwahl 320px');
  await page.screenshot({ path: test.info().outputPath('mehrklassen-zauber-320px.png'), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'Zauber- und Mehrklassenformular darf nicht seitlich überlaufen').toBeLessThanOrEqual(1);

  await page.locator('#character-save').click();
  await expect(page.getByRole('region', { name: 'Fehler bei der Charaktererstellung' })).toBeVisible();
  await expect(page.locator('#character-errors')).toBeFocused();
});
