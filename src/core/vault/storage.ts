import { createStore, del, get, set } from 'idb-keyval';
import type { AnyVaultRecord } from './types';

/**
 * IndexedDB via idb-keyval. One record per wallet. Nothing secret ever goes to
 * localStorage, cookies or the URL; the record holds ciphertext plus public
 * metadata only.
 */
const DB_NAME = 'stova';
const STORE_NAME = 'vault';
const KEY = 'wallet';

let store: ReturnType<typeof createStore> | null = null;
function s() {
  if (!store) store = createStore(DB_NAME, STORE_NAME);
  return store;
}

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("This browser wouldn't let STOVA store anything. Private browsing and full storage do this.");
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

export async function storageAvailable(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    await get('__probe__', s());
    return true;
  } catch {
    return false;
  }
}

export async function readVault(): Promise<AnyVaultRecord | null> {
  try {
    const v = await get<AnyVaultRecord>(KEY, s());
    return v && (v.version === 1 || v.version === 2) ? v : null;
  } catch (e) {
    throw new StorageUnavailableError(e);
  }
}

export async function writeVault(record: AnyVaultRecord): Promise<void> {
  try {
    await set(KEY, record, s());
  } catch (e) {
    throw new StorageUnavailableError(e);
  }
}

export async function deleteVault(): Promise<void> {
  try {
    await del(KEY, s());
  } catch (e) {
    throw new StorageUnavailableError(e);
  }
}

/** Best-effort detection of private browsing, for the Welcome screen warning. */
export async function looksLikePrivateMode(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || !navigator.storage?.estimate) return false;
    const est = await navigator.storage.estimate();
    // Private windows commonly report a tiny quota (well under 200 MB).
    return typeof est.quota === 'number' && est.quota < 200 * 1024 * 1024;
  } catch {
    return false;
  }
}
