import { expect, test, type Page } from '@playwright/test';

/** Official SEP-0005 test vector 1: phrase → account 0 and 1, and the account-0 secret. */
const PHRASE = 'illness spike retreat truth genius clock brain pass fit cave bargain toe';
const ACCT0 = 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6';
const ACCT1 = 'GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX';
const SECRET0 = 'SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN';
const PASSWORD = 'import-e2e-key-2026';

async function setPassword(page: Page) {
  await expect(page.getByRole('heading', { name: 'Lock it with a password' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Import wallet' }).click();
  await expect(page.getByText('Wallet imported')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Open my wallet' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('import by recovery phrase derives the SEP-5 address and the same second account', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Your 12 or 24 words').fill('  ILLNESS spike   retreat truth genius clock brain pass fit cave bargain TOE ');
  await expect(page.getByText('12 words')).toBeVisible();
  await expect(page.getByText(`${ACCT0.slice(0, 8)}…${ACCT0.slice(-8)}`)).toBeVisible();
  await page.screenshot({ path: 'test-results/shots/30-import-phrase.png' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await setPassword(page);
  await expect(page.locator('header button[aria-label="Switch account"] .font-mono')).toHaveText(`${ACCT0.slice(0, 4)}…${ACCT0.slice(-4)}`);

  // Second account from the same phrase lands on the official m/44'/148'/1' address.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Accounts' }).click();
  await page.getByRole('button', { name: 'New account' }).first().click();
  await page.getByLabel('Name').fill('Savings');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Savings is ready')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText(`${ACCT1.slice(0, 4)}…${ACCT1.slice(-4)}`)).toBeVisible();
  await page.screenshot({ path: 'test-results/shots/31-accounts.png' });
});

test('import by secret key, and the import screen explains common mistakes', async ({ page }) => {
  await page.goto('/import');
  await page.getByRole('tab', { name: 'Secret key' }).click();
  const field = page.getByLabel('Secret key', { exact: true });
  await field.fill(ACCT0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/That's a public address/)).toBeVisible();
  await field.fill(SECRET0.slice(0, 55));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/That has 55 characters/)).toBeVisible();
  await field.fill(SECRET0);
  await expect(page.getByText(`${ACCT0.slice(0, 8)}…${ACCT0.slice(-8)}`)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await setPassword(page);
  await expect(page.locator('header button[aria-label="Switch account"] .font-mono')).toHaveText(`${ACCT0.slice(0, 4)}…${ACCT0.slice(-4)}`);

  // A secret-key wallet has no phrase: Settings offers the secret key instead.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('link', { name: 'Show secret key' })).toBeVisible();
});

test('private words never reach the network', async ({ page }) => {
  const bodies: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) bodies.push(`${r.url()} ${r.postData() ?? ''}`);
  });
  await page.goto('/import');
  await page.getByLabel('Your 12 or 24 words').fill(PHRASE);
  await page.getByRole('button', { name: 'Continue' }).click();
  await setPassword(page);
  await page.getByRole('link', { name: 'Receive' }).click();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  const joined = bodies.join('\n');
  expect(joined).not.toContain('illness');
  expect(joined).not.toContain(SECRET0);
  expect(joined).not.toContain(PASSWORD);
  expect(bodies.every((b) => /horizon-testnet\.stellar\.org|friendbot\.stellar\.org/.test(b))).toBe(true);
});

test('balance survives lock, unlock and reload even when Horizon is unreachable', async ({ page }) => {
  await page.goto('/import');
  await page.getByLabel('Your 12 or 24 words').fill(PHRASE);
  await page.getByRole('button', { name: 'Continue' }).click();
  await setPassword(page);
  // The SEP-5 test account is a long-lived funded Testnet account.
  await expect(page.getByText('Stellar Lumens')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Updated/)).toBeVisible({ timeout: 30_000 });
  const hero = await page.locator('span.text-5xl').innerText();
  expect(hero).not.toBe('0.00');
  await page.waitForTimeout(1500); // let the persisted cache flush

  // Lock and unlock without reloading: same numbers, no skeleton, no "unfunded" card.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Lock now' }).click();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.locator('span.text-5xl')).toHaveText(hero);
  await expect(page.getByText('Three steps to your first payment')).toHaveCount(0);

  // Now cut Horizon off completely and reload: the last-known balance must still show.
  await page.route('**/horizon-testnet.stellar.org/**', (route) => route.abort());
  await page.reload();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator('span.text-5xl')).toHaveText(hero, { timeout: 10_000 });
  await expect(page.getByText(/Can't reach Stellar right now/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Three steps to your first payment')).toHaveCount(0);
  expect(await page.locator('.skeleton').count()).toBe(0);
});
