import { beforeEach, describe, expect, it } from 'vitest';
import { TransactionBuilder, Account, Operation, Asset, Networks, Keypair } from '@stellar/stellar-sdk';
import { decryptJson, encryptJson, generateMasterKey, openJson, sealJson, unwrapMasterKey, wrapMasterKey, wrappingKeyFromPrf, WrongPasswordError } from './crypto';
import { deleteVault, readVault, writeVault } from './storage';
import * as session from './session';
import type { VaultRecordV1, VaultRecordV2 } from './types';

const PHRASE = 'illness spike retreat truth genius clock brain pass fit cave bargain toe';
const ACCT0 = 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6';
const ACCT1 = 'GBAW5XGWORWVFE2XTJYDTLDHXTY2Q2MO73HYCGB3XMFMQ562Q2W2GJQX';
const PW = 'correct horse battery 9';
// Keep tests fast: the production iteration count is 600k.
const FAST = 1_000;

describe('vault crypto', () => {
  it('round-trips and rejects a wrong password', async () => {
    const ct = await encryptJson({ hello: 'world' }, PW, FAST);
    expect(ct.kdf).toBe('PBKDF2-SHA256');
    expect(ct.iterations).toBe(FAST);
    await expect(decryptJson(ct, PW)).resolves.toEqual({ hello: 'world' });
    await expect(decryptJson(ct, PW + 'x')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('never repeats salt or IV', async () => {
    const a = await encryptJson('x', PW, FAST);
    const b = await encryptJson('x', PW, FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('wraps and unwraps a master key, rejecting the wrong wrapping key', async () => {
    const master = await generateMasterKey();
    const sealed = await sealJson(master, { hi: 1 });
    const kA = await wrappingKeyFromPrf(new Uint8Array(32).fill(1));
    const kB = await wrappingKeyFromPrf(new Uint8Array(32).fill(2));
    const wrapped = await wrapMasterKey(master, kA);
    const back = await unwrapMasterKey(wrapped, kA);
    await expect(openJson(back, sealed)).resolves.toEqual({ hi: 1 });
    await expect(unwrapMasterKey(wrapped, kB)).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe('session', () => {
  beforeEach(async () => {
    await deleteVault();
    session.__resetForTests();
    session.__setKdfIterationsForTests(FAST);
    await session.initSession();
  });

  it('starts with no wallet', () => {
    expect(session.getSession().status).toBe('none');
  });

  it('creates, locks, reloads and unlocks a wallet; storage holds ciphertext only', async () => {
    const vault = await session.createWalletFromPhrase(PHRASE, PW);
    expect(session.getSession().status).toBe('unlocked');
    expect(vault.accounts[0].publicKey).toBe(ACCT0);

    const stored = JSON.stringify(await readVault());
    expect(stored).not.toContain('illness');
    expect(stored).not.toContain(PW);
    expect(stored).toContain(ACCT0); // public key readable while locked

    session.lock();
    expect(session.getSession().status).toBe('locked');
    expect(() => session.signTransaction(dummyTx(ACCT0), ACCT0)).toThrow(session.LockedError);

    session.__resetForTests();
    await session.initSession();
    expect(session.getSession().status).toBe('locked');
    await expect(session.unlock('nope nope nope')).rejects.toBeInstanceOf(WrongPasswordError);
    await session.unlock(PW);
    expect(session.getSession().status).toBe('unlocked');
  });

  it('signs with the right derived key', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    const tx = session.signTransaction(dummyTx(ACCT0), ACCT0);
    expect(tx.signatures).toHaveLength(1);
    const kp = Keypair.fromPublicKey(ACCT0);
    expect(kp.verify(tx.hash(), tx.signatures[0].signature)).toBe(true);
  });

  it('cools down after five wrong passwords', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    session.lock();
    for (let i = 0; i < 4; i++) await expect(session.unlock('wrong')).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(session.unlock('wrong')).rejects.toBeInstanceOf(session.CooldownError);
    await expect(session.unlock(PW)).rejects.toBeInstanceOf(session.CooldownError);
    expect(session.cooldownSecondsLeft()).toBeGreaterThan(0);
  });

  it('adds derived accounts on the SEP-5 path and switches', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    const sav = await session.addDerivedAccount('Savings');
    expect(sav.index).toBe(1);
    expect(sav.publicKey).toBe(ACCT1);
    expect(session.getSession().vault?.activeId).toBe(sav.id);
    const tx = session.signTransaction(dummyTx(ACCT1), ACCT1);
    expect(Keypair.fromPublicKey(ACCT1).verify(tx.hash(), tx.signatures[0].signature)).toBe(true);
  });

  it('imports a secret-key account and keeps it across lock/unlock', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    const kp = Keypair.random();
    const meta = await session.addImportedAccount(kp.secret(), 'Cold');
    expect(meta.kind).toBe('imported');
    session.lock();
    await session.unlock(PW);
    const tx = session.signTransaction(dummyTx(kp.publicKey()), kp.publicKey());
    expect(kp.verify(tx.hash(), tx.signatures[0].signature)).toBe(true);
    const stored = JSON.stringify(await readVault());
    expect(stored).not.toContain(kp.secret());
  });

  it('changes password by rewrapping the master key', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    const before = session.getSession().vault as VaultRecordV2;
    await expect(session.changePassword('wrong', 'new password 123')).rejects.toBeInstanceOf(WrongPasswordError);
    await session.changePassword(PW, 'new password 123');
    const after = session.getSession().vault as VaultRecordV2;
    expect(after.wraps.password.salt).not.toBe(before.wraps.password.salt);
    expect(after.cipher).toEqual(before.cipher); // payload untouched
    session.lock();
    await expect(session.unlock(PW)).rejects.toBeInstanceOf(WrongPasswordError);
    await session.unlock('new password 123');
    expect(session.isUnlocked()).toBe(true);
  });

  it('reveals the phrase only with the password', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    await expect(session.revealSecrets('bad', ACCT0)).rejects.toBeInstanceOf(WrongPasswordError);
    const r = await session.revealSecrets(PW, ACCT0);
    expect(r.mnemonic).toBe(PHRASE);
    expect(r.secret.startsWith('S')).toBe(true);
  });

  it('hides accounts but never the default', async () => {
    const v = await session.createWalletFromPhrase(PHRASE, PW);
    const sav = await session.addDerivedAccount('Savings');
    await expect(session.hideAccount(v.accounts[0].id)).rejects.toThrow(/default/);
    await session.hideAccount(sav.id);
    expect(session.visibleAccounts(session.getSession().vault)).toHaveLength(1);
    expect(session.getSession().vault?.activeId).toBe(v.accounts[0].id);
  });

  it('migrates a v1 vault to the v2 envelope on first unlock', async () => {
    const v1: VaultRecordV1 = {
      version: 1,
      createdAt: 1,
      hasPhrase: true,
      accounts: [{ id: 'a1', name: 'Main account', publicKey: ACCT0, kind: 'derived', index: 0, createdAt: 1 }],
      activeId: 'a1',
      defaultId: 'a1',
      settings: { autoLockMinutes: 5, hideBalances: false },
      cipher: await encryptJson({ mnemonic: PHRASE, secrets: {} }, PW, FAST),
    };
    await writeVault(v1);
    session.__resetForTests();
    await session.initSession();
    expect(session.getSession().vault?.version).toBe(1);
    await expect(session.unlock('wrong wrong wrong')).rejects.toBeInstanceOf(WrongPasswordError);
    await session.unlock(PW);
    const v2 = session.getSession().vault as VaultRecordV2;
    expect(v2.version).toBe(2);
    expect(v2.wraps.password.kdf).toBe('PBKDF2-SHA256');
    expect((await readVault())?.version).toBe(2);
    const tx = session.signTransaction(dummyTx(ACCT0), ACCT0);
    expect(Keypair.fromPublicKey(ACCT0).verify(tx.hash(), tx.signatures[0].signature)).toBe(true);
    const stored = JSON.stringify(await readVault());
    expect(stored).not.toContain('illness');
  });

  it('refuses passkey unlock when none is set up', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    expect(session.hasPasskey(session.getSession().vault)).toBe(false);
    await expect(session.unlockWithPasskey()).rejects.toThrow(/not set up/);
  });

  it('removes the wallet', async () => {
    await session.createWalletFromPhrase(PHRASE, PW);
    await session.removeWallet();
    expect(session.getSession().status).toBe('none');
    expect(await readVault()).toBeNull();
  });
}, 60_000);

function dummyTx(source: string) {
  return new TransactionBuilder(new Account(source, '1'), { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: source, asset: Asset.native(), amount: '1' }))
    .setTimeout(60)
    .build();
}
