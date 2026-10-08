import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Node 20+ exposes globalThis.crypto already; make sure subtle is there for
// the vault tests in any environment.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
