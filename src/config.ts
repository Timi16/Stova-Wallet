import { Networks } from '@stellar/stellar-sdk';

/**
 * Network configuration. Both URLs and the passphrase live here so a Mainnet
 * switch later is a config change, not a rewrite. This build is fixed to
 * Testnet: the UI reads `NETWORK.name` and shows the badge on every screen.
 */
export const NETWORK = {
  id: 'testnet' as const,
  name: 'Testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  friendbotUrl: 'https://friendbot.stellar.org',
  passphrase: Networks.TESTNET,
  explorerUrl: 'https://stellar.expert/explorer/testnet',
  /** Public, read-only asset directory used by the Add asset browser. */
  directoryApi: 'https://api.stellar.expert/explorer/testnet',
  /** Public-network directory, used only to find a logo for an asset code (Testnet assets carry none). */
  logoApi: 'https://api.stellar.expert/explorer/public',
  /** Faucet users can fall back to when Friendbot is rate-limited. */
  labFaucetUrl: 'https://lab.stellar.org/account/fund?$=network$id=testnet',
  usdcFaucetUrl: 'https://faucet.circle.com',
};

/** Assets offered as one-tap presets on the Add asset screen. */
export const PRESET_ASSETS = [
  {
    code: 'USDC',
    name: 'USD Coin',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    issuerName: 'Circle',
    symbol: '$',
    color: '#2775CA',
  },
] as const;

/** Vault and session rules from the architecture document. */
export const SECURITY = {
  minPasswordLength: 10,
  pbkdf2Iterations: 600_000,
  maxUnlockFails: 5,
  cooldownSeconds: 30,
  defaultAutoLockMinutes: 5,
  autoLockOptions: [1, 5, 15] as const,
  revealSeconds: 30,
  clipboardClearSeconds: 60,
};

export const STELLAR = {
  /** Minimum balance maths: (2 + subentries) × base reserve. */
  baseReserve: 0.5,
  /** Horizon submit timeout and the window in which we poll by hash. */
  txTimeoutSeconds: 60,
  memoMaxBytes: 28,
  maxDecimals: 7,
  historyPageSize: 20,
  balanceRefreshMs: 15_000,
};

export const APP = {
  name: 'STOVA',
  version: '1.0.0',
};
