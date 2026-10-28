import { test, expect } from '@playwright/test';
import { isolateBrowserNetwork } from './network.mjs';

/** Drei Browserprofile, aber kein Zugriff auf das echte Firebase-Projekt. */
async function isolatedPage(browser) {
  const context = await browser.newContext();
  await isolateBrowserNetwork(context);
  const page = await context.newPage();
  await page.goto('/');
  return { context, page };
}

async function signUp(page, address) {
  const dialog = page.locator('#cloud-auth-dialog');
  const switchMode = page.locator('#cloud-auth-switch');
  const submit = page.locator('#cloud-auth-submit');
  // Erst die Firebase-Initialisierung abwarten: der sichtbare Button existiert
  // bereits, bevor die extern geladene SDK-Moduldatei ihre Handler bindet.
  await expect(page.locator('#cloud-connection-status')).not.toContainText('wird geprüft');
  await expect(page.locator('#cloud-auth-button')).toHaveText('Anmelden');
  await page.locator('#cloud-auth-button').click();
  await expect(dialog).toBeVisible();
  await expect(switchMode).toHaveText('Neues Konto erstellen');
  await switchMode.click();
  await expect(submit).toHaveText('Registrieren');
  await page.locator('#cloud-email').fill(address);
  await page.locator('#cloud-password').fill('Demo-B15-Nur-Emulator-2026');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#cloud-auth-button')).toHaveText('Abmelden');
}

test('SL + zwei Spieler: Registrierung, Kampagne, Einladung und getrennte Mitgliedschaft', async ({ browser }) => {
  const session = [];
  let primaryError;
  try {
    for (let i = 0; i < 3; i++) session.push(await isolatedPage(browser));
    const run = `${test.info().project.name}-${Date.now()}`.replace(/[^a-z0-9-]/gi, '-');
    await test.step('Spielleitung registrieren', () => signUp(session[0].page, `sl-${run}@example.test`));
    await test.step('Ersten Spieler registrieren', () => signUp(session[1].page, `bob-${run}@example.test`));
    await test.step('Zweiten Spieler registrieren', () => signUp(session[2].page, `carol-${run}@example.test`));

    const owner = session[0].page;
    await owner.locator('#new-online-campaign').click();
    await owner.locator('#online-campaign-name').fill(`Emulator-Kampagne ${run}`);
    await owner.locator('#cloud-campaign-save').click();
    await expect(owner.locator('#toast')).toContainText('Kampagne wurde erstellt');

    const campaignId = await owner.locator('[data-cloud="select"][data-cid]').first()
      .getAttribute('data-cid');
    expect(campaignId).toMatch(/^[A-Za-z0-9]{20}$/);

    for (const { page } of session.slice(1)) {
      await page.locator('#join-online-campaign').click();
      await page.locator('#cloud-join-code').fill(campaignId);
      await page.locator('#cloud-join-save').click();
      await expect(page.locator('#cloud-join-dialog')).not.toBeVisible();
      await expect(page.locator('#cloud-campaign-list')).toContainText(`Emulator-Kampagne ${run}`);
    }

    await owner.screenshot({ path: test.info().outputPath('emulator-spielleitung.png'), fullPage: true });
    await session[1].page.screenshot({ path: test.info().outputPath('emulator-spieler.png'), fullPage: true });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    // Browserabstürze beim Aufräumen dürfen den primären Testfehler nicht verdecken.
    const results = await Promise.allSettled(session.map(({ context }) => context.close()));
    const cleanupErrors = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (cleanupErrors.length && primaryError) {
      console.warn('Browserkontexte konnten nach Testfehler nicht vollständig geschlossen werden:', cleanupErrors);
    } else if (cleanupErrors.length) {
      throw new AggregateError(cleanupErrors, 'Browserkontexte konnten nicht geschlossen werden.');
    }
  }
});
