import { Keypair, type Transaction } from '@stellar/stellar-sdk';
import { SECURITY } from '@/config';
import { keypairFromPhrase, publicKeyFromPhrase } from '@/core/keys/derive';
import {
  decryptJson,
  deriveKey,
  fromBase64,
  generateMasterKey,
  openJson,
  randomBytes,
  sealJson,
  toBase64,
  unwrapMasterKey,
  wrapMasterKey,
  wrappingKeyFromPrf,
  WrongPasswordError,
} from './crypto';
import { assertPrf, createPasskey } from './passkey';
import { deleteVault, readVault, writeVault } from './storage';
import type { AccountMeta, AnyVaultRecord, PasswordWrap, VaultRecord, VaultRecordV1, VaultSecrets, VaultSettings } from './types';

/**
 * The session is the only place that ever holds a decrypted secret, and it
 * holds it in a module-level variable: never React state, never a devtools-
 * visible store, never storage. Screens ask the session to sign; they never
 * see a key.
 *
 * Vault layout (v2): payload sealed under a random master key; the master key
 * wrapped by the password (PBKDF2) and, optionally, by a passkey (WebAuthn PRF).
 */

export type SessionStatus = 'loading' | 'none' | 'locked' | 'unlocked';

export interface SessionState {
  status: SessionStatus;
  vault: AnyVaultRecord | null;
  fails: number;
  cooldownUntil: number; // epoch ms, 0 when not cooling down
  storageError: string | null;
}

export class LockedError extends Error {
  constructor() {
    super('Wallet is locked');
    this.name = 'LockedError';
  }
}

export class CooldownError extends Error {
  secondsLeft: number;
  constructor(secondsLeft: number) {
    super(`Too many tries. Wait ${secondsLeft} s.`);
    this.name = 'CooldownError';
    this.secondsLeft = secondsLeft;
  }
}

// ---- private state -------------------------------------------------------

let secrets: VaultSecrets | null = null;
/** The unwrapped master key, kept while unlocked so metadata/secret changes can be re-sealed without the password. */
let masterKey: CryptoKey | null = null;

let state: SessionState = { status: 'loading', vault: null, fails: 0, cooldownUntil: 0, storageError: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  emit();
}

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('stova-session') : null;

channel?.addEventListener('message', (ev: MessageEvent) => {
  const msg = ev.data as { type?: string } | undefined;
  if (msg?.type === 'lock') wipe(false);
  if (msg?.type === 'vault-changed') void refreshVault();
  if (msg?.type === 'removed') {
    wipe(false);
    setState({ status: 'none', vault: null });
  }
});

function wipe(broadcast: boolean) {
  secrets = null;
  masterKey = null;
  if (state.vault) setState({ status: 'locked' });
  if (broadcast) channel?.postMessage({ type: 'lock' });
}

/** PBKDF2 work factor. Production value from config; tests lower it to stay fast. */
let kdfIterations = SECURITY.pbkdf2Iterations;
export function __setKdfIterationsForTests(n: number) {
  kdfIterations = n;
}

// ---- public API ----------------------------------------------------------

export function getSession(): SessionState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function initSession(): Promise<void> {
  try {
    const vault = await readVault();
    setState({ status: vault ? 'locked' : 'none', vault, storageError: null });
  } catch (e) {
    setState({ status: 'none', vault: null, storageError: (e as Error).message });
  }
}

async function refreshVault() {
  try {
    const vault = await readVault();
    setState({ vault, status: vault ? (secrets ? 'unlocked' : 'locked') : 'none' });
  } catch {
    /* keep current state */
  }
}

export function isUnlocked(): boolean {
  return secrets !== null;
}

export function hasPasskey(vault: AnyVaultRecord | null): boolean {
  return !!vault && vault.version === 2 && !!vault.wraps.passkey;
}

export function cooldownSecondsLeft(): number {
  return Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));
}

function requireVault(): AnyVaultRecord {
  if (!state.vault) throw new Error('No wallet on this device');
  return state.vault;
}

function requireV2(): VaultRecord {
  const v = requireVault();
  if (v.version !== 2) throw new LockedError(); // a v1 vault is migrated on the first password unlock
  return v;
}

function noteFailure(e: unknown): never {
  if (e instanceof WrongPasswordError) {
    const fails = state.fails + 1;
    if (fails >= SECURITY.maxUnlockFails) {
      setState({ fails: 0, cooldownUntil: Date.now() + SECURITY.cooldownSeconds * 1000 });
      throw new CooldownError(SECURITY.cooldownSeconds);
    }
    setState({ fails });
  }
  throw e;
}

async function passwordWrap(master: CryptoKey, password: string): Promise<PasswordWrap> {
  const salt = randomBytes(16);
  const wrappingKey = await deriveKey(password, salt, kdfIterations);
  const sealed = await wrapMasterKey(master, wrappingKey);
  return { kdf: 'PBKDF2-SHA256', iterations: kdfIterations, salt: toBase64(salt), ...sealed };
}

async function unwrapWithPassword(vault: VaultRecord, password: string): Promise<CryptoKey> {
  const w = vault.wraps.password;
  const wrappingKey = await deriveKey(password, fromBase64(w.salt), w.iterations);
  return unwrapMasterKey(w, wrappingKey);
}

/** v1 → v2: decrypt with the password, seal under a fresh master key, wrap it. Persisted on the spot. */
async function migrateV1(vault: VaultRecordV1, password: string): Promise<{ record: VaultRecord; payload: VaultSecrets; master: CryptoKey }> {
  const payload = await decryptJson<VaultSecrets>(vault.cipher, password);
  const master = await generateMasterKey();
  const record: VaultRecord = {
    version: 2,
    createdAt: vault.createdAt,
    hasPhrase: vault.hasPhrase,
    accounts: vault.accounts,
    activeId: vault.activeId,
    defaultId: vault.defaultId,
    settings: vault.settings,
    cipher: await sealJson(master, payload),
    wraps: { password: await passwordWrap(master, password) },
  };
  await writeVault(record);
  return { record, payload, master };
}

/** Decrypts into memory. Wrong password → GCM auth failure → WrongPasswordError. 5 fails → 30 s cooldown. */
export async function unlock(password: string): Promise<void> {
  const vault = requireVault();
  const left = cooldownSecondsLeft();
  if (left > 0) throw new CooldownError(left);
  try {
    if (vault.version === 1) {
      const m = await migrateV1(vault, password);
      secrets = m.payload;
      masterKey = m.master;
      setState({ vault: m.record, status: 'unlocked', fails: 0, cooldownUntil: 0 });
      channel?.postMessage({ type: 'vault-changed' });
      return;
    }
    const master = await unwrapWithPassword(vault, password);
    secrets = await openJson<VaultSecrets>(master, vault.cipher);
    masterKey = master;
    setState({ status: 'unlocked', fails: 0, cooldownUntil: 0 });
  } catch (e) {
    noteFailure(e);
  }
}

/** Fingerprint / face / PIN unlock through the passkey wrap. Password cooldown applies here too. */
export async function unlockWithPasskey(): Promise<void> {
  const vault = requireVault();
  if (vault.version !== 2 || !vault.wraps.passkey) throw new Error('Passkey unlock is not set up on this device.');
  const left = cooldownSecondsLeft();
  if (left > 0) throw new CooldownError(left);
  const pk = vault.wraps.passkey;
  const prf = await assertPrf(pk.credentialId, pk.prfSalt);
  const wrappingKey = await wrappingKeyFromPrf(prf);
  prf.fill(0);
  const master = await unwrapMasterKey(pk, wrappingKey);
  secrets = await openJson<VaultSecrets>(master, vault.cipher);
  masterKey = master;
  setState({ status: 'unlocked', fails: 0, cooldownUntil: 0 });
}

/** Wipes the in-memory key and tells other tabs to do the same. */
export function lock(): void {
  wipe(true);
}

/** Verifies the password without changing session state (export, remove, passkey setup). */
export async function verifyPassword(password: string): Promise<boolean> {
  const vault = state.vault;
  if (!vault) return false;
  try {
    if (vault.version === 1) await decryptJson<VaultSecrets>(vault.cipher, password);
    else await unwrapWithPassword(vault, password);
    return true;
  } catch {
    return false;
  }
}

function requireSecrets(): VaultSecrets {
  if (!secrets) throw new LockedError();
  return secrets;
}

/** Builds the keypair for one account, in memory, for immediate use only. */
function keypairFor(publicKey: string): Keypair {
  const s = requireSecrets();
  const meta = requireVault().accounts.find((a) => a.publicKey === publicKey);
  if (!meta) throw new Error('Unknown account');
  if (meta.kind === 'derived') {
    if (!s.mnemonic) throw new Error('No recovery phrase in this wallet');
    return keypairFromPhrase(s.mnemonic, meta.index ?? 0);
  }
  const secret = s.secrets[publicKey];
  if (!secret) throw new Error('No key for this account');
  return Keypair.fromSecret(secret);
}

/** Signs a built transaction with the account's key. The key is used here and nowhere else. */
export function signTransaction(tx: Transaction, publicKey: string): Transaction {
  const kp = keypairFor(publicKey);
  tx.sign(kp);
  return tx;
}

/** Used by Settings › Export after a password re-check. Always needs the password, never the passkey. */
export async function revealSecrets(password: string, publicKey: string): Promise<{ mnemonic?: string; secret: string }> {
  const vault = requireVault();
  let payload: VaultSecrets;
  if (vault.version === 1) payload = await decryptJson<VaultSecrets>(vault.cipher, password);
  else payload = await openJson<VaultSecrets>(await unwrapWithPassword(vault, password), vault.cipher);
  const meta = vault.accounts.find((a) => a.publicKey === publicKey);
  if (!meta) throw new Error('Unknown account');
  if (meta.kind === 'derived') {
    if (!payload.mnemonic) throw new Error('No recovery phrase in this wallet');
    return { mnemonic: payload.mnemonic, secret: keypairFromPhrase(payload.mnemonic, meta.index ?? 0).secret() };
  }
  return { secret: payload.secrets[publicKey] };
}

// ---- writes ---------------------------------------------------------------

async function persist(vault: VaultRecord) {
  await writeVault(vault);
  setState({ vault });
  channel?.postMessage({ type: 'vault-changed' });
}

/** Re-seals the payload under the in-memory master key (no password needed while unlocked). */
async function resealSecrets(payload: VaultSecrets) {
  if (!masterKey) throw new LockedError();
  const vault = requireV2();
  const cipher = await sealJson(masterKey, payload);
  secrets = payload;
  return { ...vault, cipher };
}

function newId(): string {
  return toBase64(randomBytes(9)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}

const defaultSettings = (): VaultSettings => ({ autoLockMinutes: SECURITY.defaultAutoLockMinutes, hideBalances: false });

async function createVault(payload: VaultSecrets, password: string, first: Omit<AccountMeta, 'id' | 'createdAt'>, hasPhrase: boolean): Promise<VaultRecord> {
  const master = await generateMasterKey();
  const id = newId();
  const vault: VaultRecord = {
    version: 2,
    createdAt: Date.now(),
    hasPhrase,
    accounts: [{ ...first, id, createdAt: Date.now() }],
    activeId: id,
    defaultId: id,
    settings: defaultSettings(),
    cipher: await sealJson(master, payload),
    wraps: { password: await passwordWrap(master, password) },
  };
  await writeVault(vault);
  secrets = payload;
  masterKey = master;
  setState({ vault, status: 'unlocked', fails: 0, cooldownUntil: 0 });
  channel?.postMessage({ type: 'vault-changed' });
  return vault;
}

/** Create a brand-new wallet from a phrase (or import one by phrase). Unlocks on success. */
export function createWalletFromPhrase(mnemonic: string, password: string, accountName = 'Main account'): Promise<VaultRecord> {
  return createVault({ mnemonic, secrets: {} }, password, { name: accountName, publicKey: publicKeyFromPhrase(mnemonic, 0), kind: 'derived', index: 0 }, true);
}

/** Import a wallet by S… secret only (no phrase). */
export function createWalletFromSecret(secret: string, password: string, accountName = 'Imported account'): Promise<VaultRecord> {
  const publicKey = Keypair.fromSecret(secret).publicKey();
  return createVault({ secrets: { [publicKey]: secret } }, password, { name: accountName, publicKey, kind: 'imported' }, false);
}

export function nextDerivedIndex(): number {
  const used = requireVault().accounts.filter((a) => a.kind === 'derived').map((a) => a.index ?? 0);
  let i = 0;
  while (used.includes(i)) i++;
  return i;
}

/** New account from the same recovery phrase. One backup covers all of them. */
export async function addDerivedAccount(name: string): Promise<AccountMeta> {
  const s = requireSecrets();
  if (!s.mnemonic) throw new Error('This wallet was imported with a secret key, so it has no phrase to derive from.');
  const vault = requireV2();
  const index = nextDerivedIndex();
  const meta: AccountMeta = {
    id: newId(),
    name: name.trim() || `Account ${vault.accounts.length + 1}`,
    publicKey: publicKeyFromPhrase(s.mnemonic, index),
    kind: 'derived',
    index,
    createdAt: Date.now(),
  };
  await persist({ ...vault, accounts: [...vault.accounts, meta], activeId: meta.id });
  return meta;
}

/** Import another wallet's secret key into this vault as its own account. */
export async function addImportedAccount(secret: string, name: string): Promise<AccountMeta> {
  const s = requireSecrets();
  const vault = requireV2();
  const publicKey = Keypair.fromSecret(secret).publicKey();
  const existing = vault.accounts.find((a) => a.publicKey === publicKey);
  if (existing) {
    if (existing.hidden) {
      await persist({ ...vault, accounts: vault.accounts.map((a) => (a.id === existing.id ? { ...a, hidden: false } : a)), activeId: existing.id });
      return { ...existing, hidden: false };
    }
    throw new Error('That account is already in this wallet.');
  }
  const resealed = await resealSecrets({ ...s, secrets: { ...s.secrets, [publicKey]: secret } });
  const meta: AccountMeta = { id: newId(), name: name.trim() || 'Imported account', publicKey, kind: 'imported', createdAt: Date.now() };
  await persist({ ...resealed, accounts: [...vault.accounts, meta], activeId: meta.id });
  return meta;
}

/** Import by phrase into an existing wallet: adds the phrase's account 0 as an imported secret. */
export async function addImportedPhraseAccount(mnemonic: string, name: string): Promise<AccountMeta> {
  return addImportedAccount(keypairFromPhrase(mnemonic, 0).secret(), name);
}

export async function setActiveAccount(id: string): Promise<void> {
  const vault = requireV2();
  if (!vault.accounts.some((a) => a.id === id)) throw new Error('Unknown account');
  await persist({ ...vault, activeId: id });
}

export async function renameAccount(id: string, name: string): Promise<void> {
  const vault = requireV2();
  await persist({ ...vault, accounts: vault.accounts.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name } : a)) });
}

export async function setDefaultAccount(id: string): Promise<void> {
  const vault = requireV2();
  await persist({ ...vault, defaultId: id });
}

/** Hiding only removes it from the list; the same phrase brings it back. */
export async function hideAccount(id: string): Promise<void> {
  const vault = requireV2();
  if (id === vault.defaultId) throw new Error("The default account can't be hidden. Make another one default first.");
  const accounts = vault.accounts.map((a) => (a.id === id ? { ...a, hidden: true } : a));
  const activeId = vault.activeId === id ? vault.defaultId : vault.activeId;
  await persist({ ...vault, accounts, activeId });
}

export async function updateSettings(patch: Partial<VaultSettings>): Promise<void> {
  const vault = requireV2();
  await persist({ ...vault, settings: { ...vault.settings, ...patch } });
}

/** Rewraps the master key under the new password. The payload and any passkey wrap stay as they are. */
export async function changePassword(current: string, next: string): Promise<void> {
  const vault = requireV2();
  const master = await unwrapWithPassword(vault, current); // throws WrongPasswordError
  await persist({ ...vault, wraps: { ...vault.wraps, password: await passwordWrap(master, next) } });
  masterKey = master;
}

/**
 * Turns on fingerprint / face / PIN unlock: verifies the password, creates a
 * passkey with PRF, and wraps the master key under the PRF-derived key.
 */
export async function enablePasskey(password: string, label = 'STOVA wallet'): Promise<void> {
  const vault = requireV2();
  const master = await unwrapWithPassword(vault, password); // throws WrongPasswordError
  const { credentialId, prfSalt, secret } = await createPasskey(label);
  const wrappingKey = await wrappingKeyFromPrf(secret);
  secret.fill(0);
  const sealed = await wrapMasterKey(master, wrappingKey);
  await persist({ ...vault, wraps: { ...vault.wraps, passkey: { credentialId, prfSalt, createdAt: Date.now(), ...sealed } } });
}

/** Removes the passkey wrap. The passkey itself stays in the OS until the user deletes it there. */
export async function disablePasskey(): Promise<void> {
  const vault = requireV2();
  const { passkey: _drop, ...rest } = vault.wraps;
  void _drop;
  await persist({ ...vault, wraps: rest });
}

/** Deletes the vault record. Funds stay on Stellar; the phrase brings the wallet back. */
export async function removeWallet(): Promise<void> {
  await deleteVault();
  secrets = null;
  masterKey = null;
  setState({ status: 'none', vault: null, fails: 0, cooldownUntil: 0 });
  channel?.postMessage({ type: 'removed' });
}

/** Visible accounts in creation order. */
export function visibleAccounts(vault: AnyVaultRecord | null): AccountMeta[] {
  return vault ? vault.accounts.filter((a) => !a.hidden) : [];
}

export function activeAccount(vault: AnyVaultRecord | null): AccountMeta | null {
  if (!vault) return null;
  return vault.accounts.find((a) => a.id === vault.activeId && !a.hidden) ?? visibleAccounts(vault)[0] ?? null;
}

/** Test-only helper to reset module state between cases. */
export function __resetForTests() {
  secrets = null;
  masterKey = null;
  state = { status: 'loading', vault: null, fails: 0, cooldownUntil: 0, storageError: null };
}
