import { expect, test, type Page } from '@playwright/test';
import { Keypair } from '@stellar/stellar-sdk';

const PASSWORD = 'stova-e2e-pass-2026';
const SHOTS = 'test-results/shots';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

test.describe.configure({ mode: 'serial' });

test('MVP flow on Testnet: create, fund, add USDC, send, history, lock', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  // Horizon answers 404 for accounts that are not activated yet; that is expected. Anything else 404ing is a bug.
  const bad404: string[] = [];
  page.on('response', (r) => {
    if (r.status() === 404 && !/horizon-testnet\.stellar\.org\/accounts\//.test(r.url())) bad404.push(r.url());
  });

  // Welcome
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText('A Stellar wallet that lives in your browser')).toBeVisible();
  await shot(page, '01-welcome');
  await page.getByRole('link', { name: 'Create a new wallet' }).click();

  // Backup
  await expect(page.getByRole('heading', { name: 'Write down these 12 words' })).toBeVisible();
  await shot(page, '02-backup-hidden');
  await page.getByRole('button', { name: /Tap to reveal/ }).click();
  const words = await page.locator('ol li span:nth-child(2)').allInnerTexts();
  expect(words).toHaveLength(12);
  await shot(page, '03-backup-revealed');
  await page.getByLabel('I wrote them down somewhere safe').check();
  await page.getByRole('link', { name: 'Continue' }).click();

  // Confirm
  await expect(page.getByRole('heading', { name: 'Quick check' })).toBeVisible();
  for (const n of [3, 7, 11]) {
    const card = page.locator('div.card', { hasText: `Word #${n}` });
    await card.getByRole('button', { name: words[n - 1], exact: true }).click();
    await expect(card.getByText('Correct')).toBeVisible();
  }
  await shot(page, '04-confirm');
  await page.getByRole('link', { name: 'Continue' }).click();

  // Password
  await expect(page.getByRole('heading', { name: 'Lock it with a password' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await shot(page, '05-password');
  await page.getByRole('button', { name: 'Create wallet' }).click();
  await expect(page.getByText('Your wallet is ready')).toBeVisible({ timeout: 60_000 });
  await shot(page, '06-ready');
  await page.getByRole('button', { name: 'Open my wallet' }).click();

  // Home · unfunded → Friendbot
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Three steps to your first payment')).toBeVisible();
  await shot(page, '07-home-unfunded');
  await page.getByRole('button', { name: 'Fund with Friendbot' }).click();
  await expect(page.getByText('10,000 XLM arrived')).toBeVisible({ timeout: 90_000 });
  await shot(page, '08-funded');
  await page.getByRole('button', { name: 'Open my wallet' }).click();
  await expect(page.getByText('10,000.00', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Spendable 9,999\.00/)).toBeVisible();
  await shot(page, '09-home-funded');

  // Receive
  const address = await page.locator('header button[aria-label="Switch account"] .font-mono').innerText();
  await page.getByRole('link', { name: 'Receive' }).click();
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await shot(page, '10-receive');
  const fullAddress = (await page.locator('main .font-mono.break-all').first().innerText()).replace(/\s+/g, '');
  expect(fullAddress).toMatch(/^G[A-Z2-7]{55}$/);
  expect(address.slice(0, 4)).toBe(fullAddress.slice(0, 4));
  await page.getByRole('button', { name: 'Request a specific amount' }).click();
  await page.getByLabel('Amount').fill('12.5');
  await expect(page.getByText(/^web\+stellar:pay\?destination=/)).toBeVisible();
  await shot(page, '11-receive-request');
  await page.getByRole('link', { name: 'Back' }).click();

  // Add USDC
  await page.getByRole('link', { name: 'Add asset' }).click();
  await expect(page.getByRole('heading', { name: 'Add asset' })).toBeVisible();
  // The Testnet directory loads with logos, holder counts and a working search.
  await expect(page.getByText(/holders?$/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Search Testnet assets').fill('USDXM');
  await expect(page.getByText(/^USDXM/).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, '12-add-asset');
  await page.getByLabel('Search Testnet assets').fill('');
  await page.getByRole('button', { name: 'Add USDC', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Add USDC?' })).toBeVisible();
  await shot(page, '13-add-asset-sheet');
  await page.getByRole('button', { name: 'Add and sign' }).click();
  await expect(page.getByText('USDC added')).toBeVisible({ timeout: 90_000 });
  await shot(page, '14-usdc-added');
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByText('USD Coin')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('1.50 reserved')).toBeVisible({ timeout: 30_000 });

  // Send 5 XLM to a brand-new address (createAccount path)
  const friend = Keypair.random().publicKey();
  await page.getByRole('link', { name: 'Send' }).click();
  await expect(page.getByRole('heading', { name: 'Send' })).toBeVisible();
  await page.getByLabel('To').fill(friend);
  await expect(page.getByText("This account isn't on Stellar yet")).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /^XLM/ }).click();
  await page.getByLabel('Amount').fill('0.5');
  await expect(page.getByText('New accounts need at least 1 XLM')).toBeVisible();
  await page.getByLabel('Amount').fill('1,000');
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText(/Use a dot for decimals/)).toBeVisible();
  await page.getByLabel('Amount').fill('5');
  await page.getByLabel(/Memo/).fill('e2e 🍕');
  await shot(page, '15-send-form');
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('New account: this payment creates it')).toBeVisible();
  await shot(page, '16-send-review');
  await page.getByRole('button', { name: 'Confirm and sign' }).click();
  await expect(page.getByText('Sent 5.00 XLM')).toBeVisible({ timeout: 120_000 });
  await shot(page, '17-send-result');
  await page.getByRole('link', { name: 'Done' }).click();

  // Blocked case: USDC to the new account (no trustline)
  await page.getByRole('link', { name: 'Send' }).click();
  await page.getByLabel('To').fill(friend);
  await page.getByRole('button', { name: /^USDC/ }).click();
  await expect(page.getByText(/has no USDC trustline yet|can't receive USDC/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /They need to add USDC first/ })).toBeVisible();
  await shot(page, '18-send-blocked-no-trust');
  await page.getByRole('button', { name: 'Back' }).click();

  // Activity
  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Created account/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Funded by Friendbot/ })).toBeVisible();
  await shot(page, '19-activity');
  await page.getByRole('button', { name: /Created account/ }).click();
  await expect(page.getByText('Confirmed')).toBeVisible();
  await expect(page.getByText('e2e 🍕')).toBeVisible({ timeout: 20_000 });
  await shot(page, '20-tx-sheet');
  await page.getByRole('button', { name: 'Close' }).click();

  // Asset page
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('link', { name: /USD Coin/ }).click();
  await expect(page.getByText('Issued by Circle')).toBeVisible();
  await shot(page, '21-asset-usdc');
  await page.getByRole('link', { name: 'Back' }).click();

  // Settings → Lock now → Unlock
  await page.getByRole('link', { name: 'Settings' }).click();
  await shot(page, '22-settings');
  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(page).toHaveURL(/\/unlock$/);
  await shot(page, '23-unlock');
  await page.getByLabel('Password', { exact: true }).fill('wrong password 1');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText(/Wrong password\. 4 tries left/)).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page).toHaveURL(/\/(home|settings)$/); // returns to where it locked
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/home$/);

  // Reload: wallet persists, locked
  await page.reload();
  await expect(page).toHaveURL(/\/unlock$/);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('USD Coin')).toBeVisible({ timeout: 30_000 });

  // Second account from the same phrase
  await page.getByRole('button', { name: 'Switch account' }).click();
  await page.getByRole('button', { name: 'New account' }).click();
  await page.getByLabel('Name').fill('Savings');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Savings is ready')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Go to Savings/ }).click();
  await expect(page.getByText('Three steps to your first payment')).toBeVisible();
  await shot(page, '24-second-account');

  // Export needs the password
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Show recovery phrase' }).click();
  await page.getByLabel('Nobody is watching my screen').check();
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Show my phrase' }).click();
  await page.getByRole('button', { name: /Tap to reveal/ }).click();
  const exported = await page.locator('ol li span:nth-child(2)').allInnerTexts();
  expect(exported).toEqual(words);
  await shot(page, '25-export');

  // Nothing secret ever hit the network; storage holds ciphertext only.
  const idb = await page.evaluate(async () => {
    const req = indexedDB.open('stova');
    const db: IDBDatabase = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const tx = db.transaction('vault', 'readonly');
    const get = tx.objectStore('vault').get('wallet');
    const rec = await new Promise((res) => (get.onsuccess = () => res(get.result)));
    return JSON.stringify(rec);
  });
  for (const w of words) expect(idb.includes(`"${w}"`)).toBe(false);
  expect(idb).not.toContain(PASSWORD);
  expect(idb).toContain(fullAddress);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe('{}');

  expect(bad404).toEqual([]);
  const realErrors = consoleErrors.filter((e) => !/favicon|manifest|status of 404/.test(e));
  expect(realErrors, realErrors.join('\n')).toEqual([]);
});
