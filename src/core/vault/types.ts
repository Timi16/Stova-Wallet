import type { Ciphertext, Sealed } from './crypto';

/**
 * One wallet per browser, several accounts inside it.
 *
 * - Derived accounts come from the one recovery phrase at m/44'/148'/{index}'.
 * - Imported accounts carry their own secret key (and have their own backup).
 *
 * The public half (names, addresses, settings) is stored in the clear so the
 * dashboard can render while locked. Every secret lives inside `cipher`.
 */
export interface AccountMeta {
  id: string;
  name: string;
  publicKey: string;
  kind: 'derived' | 'imported';
  /** SEP-5 account index for derived accounts. */
  index?: number;
  createdAt: number;
  hidden?: boolean;
}

export interface VaultSettings {
  autoLockMinutes: number;
  hideBalances: boolean;
}

interface VaultBase {
  createdAt: number;
  /** Does the cipher payload contain a mnemonic (phrase-created wallet)? */
  hasPhrase: boolean;
  accounts: AccountMeta[];
  activeId: string;
  defaultId: string;
  settings: VaultSettings;
}

/** v1: payload encrypted directly under the password-derived key. Migrated to v2 on the next unlock. */
export interface VaultRecordV1 extends VaultBase {
  version: 1;
  cipher: Ciphertext;
}

/** The master key wrapped under PBKDF2(password). */
export interface PasswordWrap extends Sealed {
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64, 16 bytes
}

/** The master key wrapped under HKDF(passkey PRF output). Lets a fingerprint / face / PIN unlock. */
export interface PasskeyWrap extends Sealed {
  credentialId: string; // base64url
  prfSalt: string; // base64, 32 bytes, fed to the PRF extension
  createdAt: number;
}

/**
 * v2 envelope: a random AES-256 master key encrypts the payload; the master key
 * is wrapped once per unlock method. Changing the password rewraps the key
 * without touching the payload; a passkey is just a second wrap.
 */
export interface VaultRecordV2 extends VaultBase {
  version: 2;
  cipher: Sealed;
  wraps: {
    password: PasswordWrap;
    passkey?: PasskeyWrap;
  };
}

export type VaultRecord = VaultRecordV2;
export type AnyVaultRecord = VaultRecordV1 | VaultRecordV2;

/** What `cipher` decrypts to. Exists only in memory, only while unlocked. */
export interface VaultSecrets {
  mnemonic?: string;
  /** publicKey → S… secret, for imported accounts. */
  secrets: Record<string, string>;
}
