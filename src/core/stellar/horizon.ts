import { Horizon } from '@stellar/stellar-sdk';
import { APP, NETWORK } from '@/config';

/** One Horizon client for the whole app. Testnet only in this build. */
export const horizon = new Horizon.Server(NETWORK.horizonUrl, {
  appName: APP.name,
  appVersion: APP.version,
});

export function explorerTxUrl(hash: string): string {
  return `${NETWORK.explorerUrl}/tx/${hash}`;
}

export function explorerAccountUrl(publicKey: string): string {
  return `${NETWORK.explorerUrl}/account/${publicKey}`;
}

export function explorerAssetUrl(code: string, issuer: string): string {
  return `${NETWORK.explorerUrl}/asset/${code}-${issuer}`;
}
