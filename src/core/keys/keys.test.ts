import { describe, expect, it } from 'vitest';
import { mnemonicToSeedSync } from '@scure/bip39';
import { bytesToHex } from '@noble/hashes/utils.js';
import { checkPhrase, generatePhrase, normalizePhrase } from './mnemonic';
import { deriveStellarSeed, keypairFromPhrase, publicKeyFromPhrase, sep5Path } from './derive';
import { checkSecret, classifyAddress, previewPhrase, shortAddress, chunkAddress } from './import';

// Official SEP-0005 test vectors (Test Case 1).
const SEP5 = {
  phrase: 'illness spike retreat truth genius clock brain pass fit cave bargain toe',
  seedHex:
    'e4a5a632e70943ae7f07659df1332160937fad82587216a4c64315a0fb39497ee4a01f76ddab4cba68147977f3a147b6ad584c41808e8238a07f6cc4b582f186',
  accounts: [
    ['GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6', 'SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMN'],
    ['GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX', 'SCEPFFWGAG5P2VX5DHIYK3XEMZYLTYWIPWYEKXFHSK25RVMIUNJ7CTIS'],
    ['GAY5PRAHJ2HIYBYCLZXTHID6SPVELOOYH2LBPH3LD4RUMXUW3DOYTLXW', 'SDAILLEZCSA67DUEP3XUPZJ7NYG7KGVRM46XA7K5QWWUIGADUZCZWTJP'],
  ],
};

describe('SEP-5 derivation', () => {
  it('produces the official BIP-39 seed', () => {
    expect(bytesToHex(mnemonicToSeedSync(SEP5.phrase))).toBe(SEP5.seedHex);
  });

  it.each(SEP5.accounts.map((a, i) => [i, a[0], a[1]] as const))(
    "derives m/44'/148'/%i' to the official keypair",
    (index, pub, sec) => {
      const kp = keypairFromPhrase(SEP5.phrase, index);
      expect(kp.publicKey()).toBe(pub);
      expect(kp.secret()).toBe(sec);
      expect(publicKeyFromPhrase(SEP5.phrase, index)).toBe(pub);
    },
  );

  it('formats the path', () => {
    expect(sep5Path(0)).toBe("m/44'/148'/0'");
    expect(sep5Path(7)).toBe("m/44'/148'/7'");
  });

  it('rejects bad account indices', () => {
    const seed = mnemonicToSeedSync(SEP5.phrase);
    expect(() => deriveStellarSeed(seed, -1)).toThrow(RangeError);
    expect(() => deriveStellarSeed(seed, 1.5)).toThrow(RangeError);
  });
});

describe('recovery phrase handling', () => {
  it('generates a valid 12-word phrase that round-trips', () => {
    const p = generatePhrase();
    expect(p.split(' ')).toHaveLength(12);
    const check = checkPhrase(p);
    expect(check.ok).toBe(true);
  });

  it('normalises spacing and case', () => {
    expect(normalizePhrase('  Illness   SPIKE\nretreat ')).toEqual(['illness', 'spike', 'retreat']);
    const check = checkPhrase('  ILLNESS spike   retreat truth genius clock brain pass fit cave bargain TOE ');
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.normalized).toBe(SEP5.phrase);
  });

  it('flags wrong word counts', () => {
    const c = checkPhrase('illness spike retreat');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toBe('count');
  });

  it("flags an unknown word by position", () => {
    const c = checkPhrase('illness spike retreat truth genius clock brain pass fit cave bargian toe');
    expect(c.ok).toBe(false);
    if (!c.ok) {
      expect(c.reason).toBe('unknown-word');
      expect(c.badIndex).toBe(10);
      expect(c.message).toContain('Word 11');
    }
  });

  it('flags a checksum failure when words are swapped', () => {
    const c = checkPhrase('spike illness retreat truth genius clock brain pass fit cave bargain toe');
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toBe('checksum');
  });

  it('accepts a 24-word phrase', () => {
    const p24 =
      'bench hurt jump file august wise shallow faculty impulse spring exact slush thunder author capable act festival slice deposit sauce coconut afford frown better';
    const c = checkPhrase(p24);
    expect(c.ok).toBe(true);
    expect(previewPhrase(p24)).toMatchObject({ ok: true, wordCount: 24 });
  });

  it('previews the derived address', () => {
    const p = previewPhrase(SEP5.phrase);
    expect(p).toMatchObject({ ok: true, publicKey: SEP5.accounts[0][0], wordCount: 12 });
  });
});

describe('secret key import', () => {
  it('accepts a valid secret and derives its address', () => {
    const r = checkSecret(SEP5.accounts[0][1].toLowerCase());
    expect(r).toMatchObject({ ok: true, publicKey: SEP5.accounts[0][0] });
  });

  it('explains a pasted public address', () => {
    const r = checkSecret(SEP5.accounts[0][0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/public address/);
  });

  it('explains wrong length and bad checksum', () => {
    expect(checkSecret('SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVM')).toMatchObject({ ok: false });
    const bad = checkSecret('SBGWSG6BTNCKCOB3DIFBGCVMUPQFYPA2G4O34RMTB343OYPXU5DJDVMM');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toMatch(/doesn't check out/);
  });
});

describe('address classification', () => {
  it('classifies inputs', () => {
    expect(classifyAddress('')).toBe('empty');
    expect(classifyAddress(SEP5.accounts[0][0])).toBe('valid');
    expect(classifyAddress(SEP5.accounts[0][1])).toBe('secret');
    expect(classifyAddress('alice*stellar.org')).toBe('federation');
    expect(classifyAddress('GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ')).toBe('length');
    expect(classifyAddress('GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJA')).toBe('invalid');
    expect(classifyAddress('MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK')).toBe('muxed');
  });

  it('shortens and chunks', () => {
    expect(shortAddress(SEP5.accounts[0][0])).toBe('GDRX…JUJ6');
    expect(chunkAddress('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
  });
});
