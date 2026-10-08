import { describe, expect, it } from 'vitest';
import { AccountRequiresMemoError, Horizon } from '@stellar/stellar-sdk';
import { describeError } from './errors';
import { normalizeOperation } from './history';
import { parseDirectoryPage, parseDirectoryRecord } from './directory';
import { emptyAccount, toAccountInfo } from './account';

const ME = 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6';
const THEM = 'GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX';
const USDC = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const base = (over: Record<string, unknown>) =>
  ({
    id: '1',
    paging_token: '1',
    source_account: ME,
    created_at: '2026-10-08T10:00:00Z',
    transaction_hash: 'abc',
    transaction_successful: true,
    ...over,
  }) as unknown as Horizon.ServerApi.OperationRecord;

describe('history normalisation', () => {
  it('maps outgoing and incoming payments', () => {
    const out = normalizeOperation(base({ type: 'payment', from: ME, to: THEM, asset_type: 'native', amount: '5.0000000' }), ME);
    expect(out).toMatchObject({ kind: 'out', title: 'Sent XLM', counterparty: THEM, amount: '5.0000000', asset: { code: 'XLM', issuer: null } });
    const inc = normalizeOperation(base({ type: 'payment', from: THEM, to: ME, asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC, amount: '40' }), ME);
    expect(inc).toMatchObject({ kind: 'in', title: 'Received USDC', counterparty: THEM, asset: { code: 'USDC', issuer: USDC } });
  });

  it('maps account creation both ways and spots Friendbot', () => {
    const funded = normalizeOperation(base({ type: 'create_account', account: ME, funder: THEM, starting_balance: '10000.0000000' }), ME);
    expect(funded).toMatchObject({ kind: 'funded', title: 'Funded by Friendbot', counterparty: 'Friendbot' });
    const created = normalizeOperation(base({ type: 'create_account', account: THEM, funder: ME, starting_balance: '5.0000000' }), ME);
    expect(created).toMatchObject({ kind: 'created', title: 'Created account', counterparty: THEM, amount: '5.0000000' });
    const activated = normalizeOperation(base({ type: 'create_account', account: ME, funder: THEM, starting_balance: '2.0000000' }), ME);
    expect(activated).toMatchObject({ kind: 'funded', title: 'Account created', counterparty: THEM });
  });

  it('maps path payments and labels unknown operations', () => {
    const pp = normalizeOperation(base({ type: 'path_payment_strict_send', from: THEM, to: ME, asset_type: 'native', amount: '1' }), ME);
    expect(pp).toMatchObject({ kind: 'in', title: 'Received XLM (path)' });
    const other = normalizeOperation(base({ type: 'claim_claimable_balance' }), ME);
    expect(other).toMatchObject({ kind: 'other', title: 'Other operation', amount: null });
  });
});

describe('error mapping extras', () => {
  it('explains SEP-29 memo-required recipients', () => {
    const f = describeError(new AccountRequiresMemoError('memo required', THEM, 0));
    expect(f.code).toBe('memo_required');
    expect(f.action).toBe('stop');
    expect(f.title).toMatch(/requires a memo/);
  });
  it('turns a plain fetch failure into a network message', () => {
    const f = describeError(new TypeError('Failed to fetch'));
    expect(f.code).toBe('network');
    expect(f.action).toBe('poll');
  });
});

describe('asset directory parsing', () => {
  it('parses records and skips XLM and contract-only entries', () => {
    const page = parseDirectoryPage(
      {
        _embedded: {
          records: [
            { asset: 'XLM', code: 'XLM', paging_token: 1 },
            { asset: `USDC-${USDC}-1`, code: 'USDC', domain: 'circle.com', trustlines: { total: 93633 }, payments: 5, rating: { average: 4.2 }, paging_token: 2 },
            { asset: 'CAUGJT4GREIY3WHOUUU5RIUDGSPVREF5CDCYJOWMHOVT2GWQT5JEETGJ', code: null, paging_token: 3 },
            { asset: `BAD-NOTANISSUER-1`, code: 'BAD', paging_token: 4 },
          ],
        },
      },
      4,
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ asset: { code: 'USDC', issuer: USDC }, domain: 'circle.com', trustlines: 93633, rating: 4.2, pagingToken: '2' });
    expect(page.nextCursor).toBe('4');
  });
  it('has no next cursor on a short page', () => {
    expect(parseDirectoryPage({ _embedded: { records: [] } }, 20).nextCursor).toBeNull();
    expect(parseDirectoryRecord({ asset: 'nonsense' })).toBeNull();
  });
});

describe('account info', () => {
  it('reports an unfunded account as not existing with zero XLM', () => {
    const a = emptyAccount(ME);
    expect(a.exists).toBe(false);
    expect(a.xlm.spendable).toBe('0');
    expect(a.balances[0].asset.issuer).toBeNull();
  });
  it('normalises Horizon balances with XLM first and unauthorised flags', () => {
    const resp = {
      accountId: () => ME,
      sequenceNumber: () => '42',
      subentry_count: 2,
      balances: [
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC, balance: '250.0000000', limit: '922337203685.4775807', buying_liabilities: '0', selling_liabilities: '0', is_authorized: true },
        { asset_type: 'credit_alphanum12', asset_code: 'AUTHTOKEN', asset_issuer: THEM, balance: '0.0000000', limit: '1', buying_liabilities: '0', selling_liabilities: '0', is_authorized: false },
        { asset_type: 'native', balance: '100.0000000', buying_liabilities: '0', selling_liabilities: '10.0000000' },
      ],
    } as unknown as Horizon.AccountResponse;
    const info = toAccountInfo(resp);
    expect(info.balances[0].asset.code).toBe('XLM');
    expect(info.balances.find((b) => b.asset.code === 'AUTHTOKEN')?.authorized).toBe(false);
    expect(info.xlm.reserve).toBe('2');
    expect(info.xlm.spendable).toBe('88'); // 100 − 2 reserve − 10 selling liabilities
  });
});
