# STOVA Wallet

A non-custodial Stellar **Testnet** wallet that runs entirely in your browser. The secret key is created, encrypted and used only on your device; the app talks straight to Stellar's Horizon and Friendbot. There is no STOVA server, no database and no sign-up.

**The one rule:** the secret key never leaves the device. The only thing that leaves the browser is a transaction that is already signed.

## Run it

```bash
npm install
npm run dev        # https://localhost:5173 (self-signed cert: accept the warning once)
                   # WebCrypto needs a secure page, so dev serves HTTPS; phones on the LAN use https://<your-ip>:5173
npm test           # Vitest unit tests (keys, vault, maths, error mapping)
npm run build      # static build in dist/
npm run e2e        # Playwright end-to-end run against real Testnet (needs network)
```

Deploy the `dist/` folder anywhere static. `vercel.json` carries the Content Security Policy and security headers; keep them when hosting elsewhere.

## What it does

1. **Create or import.** Create makes a 12-word BIP-39 phrase in the browser. Import accepts a 12/24-word phrase or an S… secret key and shows the derived G… address before saving.
2. **Set a password.** The secrets are encrypted with it (PBKDF2-SHA256, 600k iterations → AES-256-GCM) and stored in IndexedDB. Every later visit starts with Unlock.
3. **Fund.** New accounts don't exist on Stellar until they hold XLM; one tap asks Friendbot.
4. **Balances.** XLM plus every asset the account holds, with spendable XLM (balance − reserve − liabilities), auto-refresh every 15 s and a Refresh button.
5. **Add an asset.** USDC preset (Circle's Testnet issuer), a browsable Testnet directory (search by code, name or issuer; holder counts and rating from Stellar Expert's public API; logo tiles coloured per issuer), plus a custom code + issuer form. Checks the XLM reserve first.
6. **Receive.** Address with copy, QR code, share, and a SEP-7 request link with an amount.
7. **Send.** Recipient (or a pasted SEP-7 link), asset, amount with Max, memo with a byte counter. Recipient is checked on Testnet as you type; unfunded recipients get `createAccount`; missing trustlines block before signing.
8. **Review, sign, submit.** The key is used in memory to sign; the signed XDR goes to Horizon. On a 504 the app polls by hash and never resends blindly.
9. **Confirm and history.** Hash, ledger and a Stellar Expert link; the payment appears in Activity with Load older and a detail sheet.
10. **Several accounts.** One recovery phrase, many accounts on the SEP-5 path `m/44'/148'/n'`, plus imported secret-key accounts. Switch from the account chip; manage in Settings.

## Code layout

```
src/
  core/keys/      generate, SEP-5 derive (SLIP-0010 on @noble/hashes), import, validate
  core/vault/     WebCrypto, IndexedDB storage, in-memory session, auto-lock, cross-tab lock
  core/stellar/   horizon client, account + spendable maths, assets, payments, history, errors, SEP-7
  app/            router, session hooks, queries, drafts, toast
  features/       onboarding, dashboard, send, receive, assets, history, settings, scan
  ui/             shared components (logo, orb avatar, sheet, step loader, QR, chrome)
  config.ts       network URLs, passphrase, presets, security constants
```

`core/` has no React in it, so key and transaction logic is unit-tested on its own against the official SEP-5 vectors.

## Security notes

- Vault envelope (v2): a random AES-256 master key seals the secrets; the master key is wrapped by the password (PBKDF2, 600k) and optionally by a passkey (WebAuthn PRF → HKDF). Fingerprint / face / PIN can unlock; export, change password and remove wallet always ask for the password. Passkeys need a real domain (localhost or the deployed site), not a LAN IP. v1 vaults migrate on the first password unlock.
- Asset logos come from Stellar Expert's public-network directory, matched by code (Testnet issuers publish none). A logo is a picture, not proof: trust is the issuer address.
- Secrets exist in plain form only in a module-level variable while unlocked. Auto-lock wipes it after 1/5/15 minutes idle, when the tab is hidden for that long, or on Lock now. Lock is broadcast to every tab.
- Wrong password is a GCM authentication failure; five failures start a 30-second cooldown.
- Export needs the password again, blurs the phrase until tapped, hides it after 30 s and clears the clipboard 60 s after a copy.
- Strict CSP: scripts only from self, connections only to Horizon Testnet, Friendbot and the read-only Stellar Expert directory API, no framing. Fonts are self-hosted. No analytics or third-party scripts.
- Sending honours SEP-29: a recipient flagged "memo required" is refused before anything is sent, with a plain explanation.
- Clearing site data deletes the wallet from that browser. STOVA cannot recover a lost phrase.

## Deviation from the plan

The architecture document lists `ed25519-hd-key` for SEP-5 derivation. That package needs Node `Buffer` polyfills in the browser, so STOVA implements the same SLIP-0010 derivation (about 30 lines) on `@noble/hashes`, which `@scure/bip39` already depends on. It is verified against the official SEP-0005 test vectors in `src/core/keys/keys.test.ts`.
