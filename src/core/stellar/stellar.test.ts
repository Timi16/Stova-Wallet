import { describe, expect, it } from 'vitest';
import { addAmounts, formatAmount, fromStroops, memoBytes, parseAmount, subAmounts, toStroops } from './amount';
import { minimumReserve, spendableXlm } from './account';
import { describeResultCode } from './errors';
import { buildPayLink, parsePayLink } from './sep7';
import { assetKey, assetLabel, parseAssetKey } from './assets';

describe('amount parsing', () => {
  it('reads .5 as 0.5 and keeps 7 decimals', () => {
    expect(parseAmount('.5')).toMatchObject({ ok: true, value: '0.5' });
    expect(parseAmount('1.1234567')).toMatchObject({ ok: true, value: '1.1234567' });
    expect(parseAmount('10')).toMatchObject({ ok: true, value: '10' });
    expect(parseAmount('10.00')).toMatchObject({ ok: true, value: '10' });
  });
  it('rejects 8+ decimals, commas, zero, junk', () => {
    expect(parseAmount('1.12345678')).toMatchObject({ ok: false, message: expect.stringMatching(/7 decimals/) });
    expect(parseAmount('1,000')).toMatchObject({ ok: false, message: expect.stringMatching(/dot/) });
    expect(parseAmount('0')).toMatchObject({ ok: false });
    expect(parseAmount('0.0000000')).toMatchObject({ ok: false });
    expect(parseAmount('abc')).toMatchObject({ ok: false });
    expect(parseAmount('')).toMatchObject({ ok: false });
    expect(parseAmount('.')).toMatchObject({ ok: false });
  });
  it('does exact stroop maths', () => {
    expect(toStroops('1')).toBe(10_000_000n);
    expect(fromStroops(15n)).toBe('0.0000015');
    expect(addAmounts('0.1', '0.2')).toBe('0.3');
    expect(subAmounts('10000', '0.00001')).toBe('9999.99999');
  });
  it('formats for display', () => {
    expect(formatAmount('9984.5')).toBe('9,984.50');
    expect(formatAmount('10000')).toBe('10,000.00');
    expect(formatAmount('0.00001')).toBe('0.00001');
    expect(formatAmount('1234567.1234567', { max: 2 })).toBe('1,234,567.12');
    expect(formatAmount('-15')).toBe('−15.00');
  });
  it('counts memo bytes, emoji as 4', () => {
    expect(memoBytes('Lunch')).toBe(5);
    expect(memoBytes('🍕')).toBe(4);
    expect(memoBytes('a'.repeat(28))).toBe(28);
  });
});

describe('spendable XLM', () => {
  it('uses (2 + subentries) × 0.5 as the reserve', () => {
    expect(minimumReserve(0)).toBe('1');
    expect(minimumReserve(1)).toBe('1.5');
    expect(minimumReserve(3)).toBe('2.5');
  });
  it('subtracts reserve and selling liabilities, floors at zero', () => {
    expect(spendableXlm('9984.5', 1)).toBe('9983');
    expect(spendableXlm('9984.5', 1, '100')).toBe('9883');
    expect(spendableXlm('1', 0)).toBe('0');
    expect(spendableXlm('0.5', 0)).toBe('0');
  });
});

describe('error mapping', () => {
  it.each([
    ['op_underfunded', 'stop', /reserve/],
    ['op_low_reserve', 'stop', /more XLM/],
    ['op_no_destination', 'stop', /activated/],
    ['op_no_trust', 'stop', /receive this asset/],
    ['op_line_full', 'stop', /limit/],
    ['op_not_authorized', 'stop', /issuer/],
    ['op_src_not_authorized', 'stop', /issuer/],
    ['tx_bad_seq', 'rebuild', /changed/],
    ['tx_insufficient_fee', 'rebuild', /busy/],
    ['tx_too_late', 'rebuild', /too long/],
    ['tx_insufficient_balance', 'stop', /reserve/],
  ] as const)('%s → %s', (code, action, title) => {
    const f = describeResultCode(code);
    expect(f.action).toBe(action);
    expect(f.title).toMatch(title);
    expect(f.code).toBe(code);
  });
  it('falls back for unknown codes', () => {
    expect(describeResultCode('op_weird')).toMatchObject({ action: 'stop', code: 'op_weird' });
  });
});

describe('SEP-7 pay links', () => {
  const dest = 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6';
  const usdc = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  it('parses XLM and USDC links', () => {
    expect(parsePayLink(`web+stellar:pay?destination=${dest}&amount=12.5&memo=Lunch`)).toEqual({
      destination: dest,
      amount: '12.5',
      asset: { code: 'XLM', issuer: null },
      memo: 'Lunch',
      memoType: 'text',
    });
    expect(parsePayLink(`web+stellar:pay?destination=${dest}&amount=40&asset_code=USDC&asset_issuer=${usdc}`)).toMatchObject({
      asset: { code: 'USDC', issuer: usdc },
      amount: '40',
      memo: null,
    });
  });
  it('rejects bad links', () => {
    expect(parsePayLink('https://example.com')).toHaveProperty('error');
    expect(parsePayLink('web+stellar:pay?destination=GABC')).toHaveProperty('error');
    expect(parsePayLink(`web+stellar:pay?destination=${dest}&asset_code=USDC`)).toHaveProperty('error');
  });
  it('round-trips', () => {
    const link = buildPayLink(dest, '5', { code: 'USDC', issuer: usdc }, 'hi');
    expect(parsePayLink(link)).toMatchObject({ destination: dest, amount: '5', memo: 'hi', asset: { code: 'USDC', issuer: usdc } });
  });
});

describe('asset refs', () => {
  it('keys and labels', () => {
    expect(assetKey({ code: 'XLM', issuer: null })).toBe('native');
    expect(parseAssetKey('USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')).toEqual({
      code: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    });
    expect(assetLabel({ code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' })).toBe('USDC · Circle');
    expect(assetLabel({ code: 'USDC', issuer: 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6' })).toBe('USDC · GDRX…JUJ6');
  });
});
