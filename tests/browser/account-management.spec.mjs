import { test, expect } from '@playwright/test';
import { isolateBrowserNetwork } from './network.mjs';

test.beforeEach(async ({ context }) => isolateBrowserNetwork(context));

test('B16: Android-breites Kontoarchiv, Wiederanmeldung, Löschschutz und Kontoauflösung im Demo-Emulator', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await expect(page.locator('#cloud-connection-status')).not.toContainText('wird geprüft');
  await page.locator('#cloud-auth-button').click();
  await page.locator('#cloud-auth-switch').click();
  const email = `b16-${test.info().project.name}-${Date.now()}@example.test`;
  await page.locator('#cloud-email').fill(email);
  await page.locator('#cloud-password').fill('Nur-Demo-Emulator-2026!');
  await page.locator('#cloud-auth-submit').click();
  await expect(page.locator('#cloud-auth-dialog')).toBeHidden();
  await expect(page.locator('#cloud-auth-button')).toHaveText('Abmelden');

  await page.locator('[data-view="settings"]').first().click();
  await expect(page.locator('#cloud-account-email')).toContainText(email);
  await expect(page.locator('#cloud-account-id')).not.toBeEmpty();
  await expect(page.locator('#cloud-account-verification')).toContainText('noch nicht bestätigt');
  await page.screenshot({ path: test.info().outputPath('konto-android-360.png'), fullPage: true });

  const downloadStarted = page.waitForEvent('download');
  await page.locator('#cloud-account-export').click();
  const downloaded = await downloadStarted;
  expect(downloaded.suggestedFilename()).toBe('wuerfelbund-kontoauskunft.json');
  await expect(page.locator('#cloud-account-result')).toContainText('Kontoauskunft gespeichert');

  await page.locator('#cloud-account-delete').click();
  await expect(page.locator('#cloud-account-delete-dialog')).toBeVisible();
  await page.locator('#cloud-account-delete-password').fill('Nur-Demo-Emulator-2026!');
  await page.locator('#cloud-account-delete-confirm').fill('FALSCH');
  await page.locator('#cloud-account-delete-submit').click();
  await expect(page.locator('#cloud-account-delete-status')).toContainText('exakt KONTO LÖSCHEN');
  await expect(page.locator('#cloud-auth-button')).toHaveText('Abmelden');

  await page.locator('#cloud-account-delete-confirm').fill('KONTO LÖSCHEN');
  await page.locator('#cloud-account-delete-submit').click();
  await expect(page.locator('#cloud-account-delete-dialog')).toBeHidden();
  await expect(page.locator('#cloud-auth-button')).toHaveText('Anmelden');
  await expect(page.locator('#cloud-account-result')).toContainText('Online-Konto');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'Kontoansicht darf bei 360 px nicht horizontal überlaufen').toBeLessThanOrEqual(1);
});

test('B16: Passwort-vergessen-Aktion und zugängliche Löschdialoge bei kleinem Display', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await expect(page.locator('#cloud-connection-status')).not.toContainText('wird geprüft');
  await page.locator('#cloud-auth-button').click();
  await page.locator('#cloud-email').fill('nicht-vorhanden@example.test');
  await page.locator('#cloud-password-reset').click();
  await expect(page.locator('#toast')).toContainText('Falls das Konto existiert');
  await page.keyboard.press('Escape');
  await page.locator('[data-view="settings"]').first().click();
  await expect(page.locator('#cloud-account-guest')).toBeVisible();
  await expect(page.locator('#cloud-account-actions')).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('B16: bestätigte SL übergibt eine Kampagne im echten Browser-Demo-Emulator', async ({ browser }) => {
  const contexts = [];
  try {
    const createPage = async () => {
      const context = await browser.newContext();
      contexts.push(context);
      await isolateBrowserNetwork(context);
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.locator('#cloud-connection-status')).not.toContainText('wird geprüft');
      return page;
    };
    const signUp = async (page, email) => {
      await page.locator('#cloud-auth-button').click();
      await page.locator('#cloud-auth-switch').click();
      await page.locator('#cloud-email').fill(email);
      await page.locator('#cloud-password').fill('Demo-B16-Übergabe-2026!');
      await page.locator('#cloud-auth-submit').click();
      await expect(page.locator('#cloud-auth-button')).toHaveText('Abmelden');
    };
    const owner = await createPage(), player = await createPage();
    const nonce = `${Date.now()}-${test.info().project.name}`;
    const ownerEmail = `lead-${nonce}@example.test`;
    await signUp(owner, ownerEmail);
    await signUp(player, `player-${nonce}@example.test`);
    await expect(owner.locator('#cloud-account-result')).toContainText('Bestätigungs-E-Mail versendet');

    // Nur Emulator: E-Mail-Verifikationslink aus offizieller OOB-Test-API.
    const codesResponse = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-wuerfelbund/oobCodes');
    expect(codesResponse.ok).toBe(true);
    const codes = (await codesResponse.json()).oobCodes;
    const verification = codes.find(item => item.email === ownerEmail && item.requestType === 'VERIFY_EMAIL');
    expect(verification?.oobLink).toBeTruthy();
    const confirmed = await fetch(verification.oobLink);
    expect(confirmed.ok).toBe(true);
    await owner.locator('[data-view="settings"]').first().click();
    await owner.locator('#cloud-verify-refresh').click();
    await expect(owner.locator('#cloud-account-verification')).toContainText('E-Mail bestätigt');

    await owner.locator('#new-online-campaign').click();
    await owner.locator('#online-campaign-name').fill(`B16 Übergabe ${nonce}`);
    await owner.locator('#cloud-campaign-save').click();
    await expect(owner.locator('#cloud-campaign-dialog')).toBeHidden();
    const cid = await owner.locator('[data-cloud="transfer"][data-cid]').first().getAttribute('data-cid');
    expect(cid).toMatch(/^[a-zA-Z0-9]{20}$/);
    await player.locator('#join-online-campaign').click();
    await player.locator('#cloud-join-code').fill(cid);
    await player.locator('#cloud-join-save').click();
    await expect(player.locator('#cloud-join-dialog')).toBeHidden();

    const targetUid = await player.locator('#cloud-account-id').textContent();
    await owner.locator(`[data-cloud="transfer"][data-cid="${cid}"]`).click();
    await expect(owner.locator('#cloud-transfer-dialog')).toBeVisible();
    await owner.locator('#cloud-transfer-member').selectOption(targetUid);
    await owner.locator('#cloud-transfer-password').fill('Demo-B16-Übergabe-2026!');
    await owner.locator('#cloud-transfer-confirm').fill('ÜBERGEBEN');
    await owner.locator('#cloud-transfer-submit').click();
    await expect(owner.locator('#cloud-transfer-dialog')).toBeHidden();
    await expect(owner.locator('#cloud-campaign-list')).toContainText('Spieler');
    await player.reload();
    await expect(player.locator(`[data-cloud="transfer"][data-cid="${cid}"]`)).toBeVisible();
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
  }
});
