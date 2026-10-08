STOVA Wallet — Architecture & Build Plan
7 Oct 2026 · @Timmy
How it works
STOVA is a web wallet: the user's secret key is created, encrypted and used only inside their own browser, and the app talks straight to Stellar Testnet. There is no STOVA server, no database and no account to sign up for.
The one rule: the secret key never leaves the device. It is never sent over the network, logged, put in a URL, saved unencrypted or included in an error report. The only thing that leaves the browser is a transaction that is already signed.
The MVP flow David asked for, end to end:
1. Create or import. Create makes a new keypair in the browser and shows a 12-word recovery phrase. Import accepts a recovery phrase or an S… secret key.
2. Set a password. The secret is encrypted with it and stored on the device. Every later visit starts with Unlock.
3. Fund (new wallets only). A new account does not exist on Stellar until it holds XLM, so STOVA asks Friendbot to fund it with Testnet XLM.
4. View balances. XLM plus every asset the account holds, read from Horizon, with a Refresh button.
5. Add an asset. To hold USDC the account needs a trustline. One tap adds it (a small signed transaction).
6. Receive. Address with copy button and QR code.
7. Send. Recipient, asset, amount, optional memo, then a review screen showing the fee and what the recipient gets.
8. Sign and submit. The key is used in memory to sign, then the signed transaction goes to Testnet.
9. Confirm. The hash, status and ledger show on screen with a Stellar Expert link, and the payment appears in history.
Architecture
STOVA is a static single-page app: all logic runs in the browser, and the only outside services are Stellar's own. With no backend there is nothing to hack server-side and no server bill; hosting is free on Vercel.
The screens never touch the key directly. They ask the session to sign; the session holds the decrypted key only while unlocked, and the vault only ever stores ciphertext.
Layer
Choice
Why
App
Vite + React + TypeScript
Static build, no server code to secure
Styling
Tailwind CSS
Fast to build the designed screens
Stellar
@stellar/stellar-sdk
Official SDK: Horizon client, transaction builder, address checks
Recovery phrase
@scure/bip39 + ed25519-hd-key (SEP-5 path)
Audited, small, same phrases as Freighter and Lobstr
Encryption
Web Crypto (PBKDF2 + AES-GCM)
Built into the browser, nothing hand-rolled
Storage
IndexedDB via idb-keyval
Survives reloads, holds ciphertext only
Data
TanStack Query
Caching, refresh and retries for Horizon calls
QR
qrcode
Receive screen
Tests
Vitest + Playwright
Unit tests for keys and maths, end-to-end on Testnet
Hosting
Vercel, CSP and security headers in vercel.json
Free, HTTPS, preview URL per change
Key management and security
The secret is stored only as ciphertext and exists in plain form only in memory while the wallet is unlocked. Everything below is browser-native (Web Crypto), so no crypto code is hand-rolled.
Step
How
Notes
Create
128-bit entropy → 12-word BIP-39 phrase → SEP-5 path m/44'/148'/0' → ed25519 keypair
Same derivation as Freighter and Lobstr, so a STOVA phrase works in them
Import
12/24-word phrase (checksum validated) or S… secret (StrKey checksum validated)
Show the derived G… address before saving so the user can confirm it is theirs
Password
Minimum 10 characters, strength meter, confirm field
It only unlocks this device; it is not a recovery method
Encrypt
PBKDF2-SHA256, 600,000 iterations, random 16-byte salt → AES-256-GCM, random 12-byte IV
Store {version, salt, iv, ciphertext, publicKey}; the public key stays readable so the dashboard can load while locked
Store
IndexedDB, one vault record per wallet
Nothing secret in localStorage, cookies or the URL
Unlock
Decrypt into memory (a module-level variable, never React state or devtools-visible stores)
Wrong password = GCM auth failure → "Wrong password"; 5 fails → 30-second cooldown
Auto-lock
Wipe the in-memory key after 5 minutes idle, on tab hide for 5 minutes, and on Lock now
Re-unlock is asked again right before signing if locked
Export
Re-enter password → warning screen → reveal phrase or secret, blurred until pressed
Never copied automatically; clipboard cleared after 60 seconds
Remove wallet
Type the address ending to confirm → delete the vault record
Warn that without the phrase the funds are gone
Browser hardening
• Strict Content Security Policy: default-src 'self', connect-src only Horizon Testnet and Friendbot, no inline scripts, frame-ancestors 'none' so STOVA can't be framed for clickjacking.
• No analytics, ads, chat widgets or third-party scripts. Fonts self-hosted.
• Dependencies pinned with a lockfile; only well-known packages (@stellar/stellar-sdk, @scure/bip39).
• React only, no dangerouslySetInnerHTML; every user string (memo, asset code) rendered as text.
• Error reporting, if ever added, strips anything that looks like S…, a phrase or XDR.
• HTTPS only, HSTS on the host.
What we tell users honestly: STOVA cannot recover a lost phrase, and a browser wallet is only as safe as the device. Clearing site data deletes the wallet from that browser.
Stellar integration
Everything goes through @stellar/stellar-sdk to Horizon Testnet (https://horizon-testnet.stellar.org, passphrase Networks.TESTNET). Both URLs live in one config file so a Mainnet switch later is a config change, not a rewrite.
Account and balances
• server.loadAccount(G…) returns balances. A 404 means "not activated yet": show a Fund button that calls Friendbot (https://friendbot.stellar.org?addr=G…), then reload.
• Show native XLM first, then each asset as code plus a shortened issuer, so a fake "USDC" from another issuer looks different.
• Spendable XLM = balance − minimum reserve − selling liabilities. Reserve = (2 + subentries) × 0.5 XLM. Send screens use spendable, never the raw balance.
• Refresh button, plus auto-refresh every 15 seconds while the tab is visible.
Trustlines (Add asset)
• Preset list for Testnet USDC (issuer GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5) plus a custom code + issuer form.
• Operation.changeTrust signed locally; it locks 0.5 XLM of reserve, so check spendable XLM first.
• Remove asset only when its balance is 0 (changeTrust with limit 0).
Sending
1. Validate the recipient with StrKey.isValidEd25519PublicKey. Muxed M… and federation name*domain are out of MVP scope and get a clear message.
2. Load the recipient. If it doesn't exist: XLM of 1 or more → build createAccount instead of payment; anything else → block with "This account isn't activated yet".
3. Non-XLM asset → confirm the recipient has a trustline for that exact code + issuer, else block before signing.
4. Amount: more than 0, at most 7 decimals, at most spendable.
5. Build with fetchBaseFee(), optional text memo (28 bytes max) and a 60-second timeout, then show the review screen.
6. On Confirm: sign in memory, submit, keep the signed XDR.
7. If Horizon times out (504), the transaction may still land. Poll /transactions/{hash} until it shows up or the 60 seconds pass. Never rebuild and resend blindly, which could double-pay.
Paste a payment link. The recipient field also accepts a SEP-7 link (web+stellar:pay?destination=…&amount=…&asset_code=…&memo=…) and prefills the form. That lets STOVA pay a PayBridge request in one paste.
History and details
• server.payments().forAccount(G…).order('desc').limit(20) with a cursor for Load more. Shows payments, account creations and path payments as in or out.
• Detail view from /transactions/{hash}: status, ledger, time, fee, memo, operations, and a link to https://stellar.expert/explorer/testnet/tx/{hash}.
Horizon errors, in plain words
Result code
User sees
App does
op_underfunded / tx_insufficient_balance
Not enough balance after the XLM reserve
Show spendable amount, offer Max
op_low_reserve
You need more XLM to keep this account open
Show how much XLM is short
op_no_destination
Recipient account isn't activated
Suggest sending at least 1 XLM
op_no_trust
Recipient can't receive this asset yet
Explain they must add it first
op_line_full
Recipient's limit for this asset is full
Stop, nothing sent
op_not_authorized / op_src_not_authorized
This asset's issuer hasn't authorised the account
Stop, nothing sent
tx_bad_seq
Something changed, retrying
Reload account, rebuild, ask to confirm again
tx_insufficient_fee
Network is busy
Rebuild with a higher fee, ask to confirm
tx_too_late
The review took too long
Rebuild, ask to confirm again
Network error / 504
Checking whether it went through
Poll by hash before any retry
Screens and states
Fourteen screens, mobile-first (most users will open STOVA on a phone), with a yellow "Testnet" badge in the header on every screen after onboarding.
Screen
What's on it
Loading / empty / error
Welcome
Create wallet, Import wallet, one line on what non-custodial means
—
Create: back up phrase
12 words in a grid, blurred until "Reveal", copy button, "I wrote it down" checkbox
Warning if the user screenshots or skips
Create: confirm phrase
Pick words 3, 7 and 11 from shuffled options
Wrong pick → retry, no lockout
Import
Toggle: recovery phrase / secret key. Shows the derived G… before saving
Invalid checksum, wrong word count, an address pasted instead of a secret
Set password
Password, confirm, strength meter
Too short, mismatch
Unlock
Address ending, password, "Forgot password? Re-import with your phrase"
Wrong password, cooldown timer
Dashboard
Address with copy, balances list, Send, Receive, Add asset, last 5 transactions
Skeleton while loading, "Not activated: Fund with Friendbot", Horizon unreachable banner with retry
Add asset
USDC preset, custom code + issuer form
Already added, not enough XLM for reserve, invalid issuer
Receive
QR code, full address, copy, share
—
Send: form
Recipient (or paste SEP-7 link), asset picker showing spendable, amount with Max, memo
Field errors inline, recipient checks run on blur with a spinner
Send: review
To, asset + issuer, amount, memo, network fee, "Testnet" badge, Confirm and sign
Unlock prompt if locked; button disabled after one tap
Send: result
Submitting → success (hash, ledger, Stellar Expert link) or failure (plain reason, Try again)
"Checking whether it went through" on timeout
History + detail
In/out list, Load more; detail with status, hash, fee, memo, operations
Empty "No transactions yet", load error with retry
Settings
Lock now, Export phrase/secret, Remove wallet, auto-lock time, network (Testnet, read-only)
Password re-check before export/remove
Edge cases
Each case below gets a test and a plain-language message; nothing fails silently.
Area
Case
Handling
Keys
User pastes a G… address into Import
"That's a public address. Import needs your secret key or phrase"
Keys
Phrase with extra spaces, capitals or a typo'd word
Normalise spacing and case; flag the unknown word by position
Keys
24-word phrase from another wallet
Supported, same SEP-5 path
Keys
Two tabs open, one locks
Lock is broadcast to every tab (BroadcastChannel)
Keys
User clears site data or uses private browsing
Warn on Welcome that private mode forgets the wallet on close
Keys
IndexedDB unavailable or full
Block create with a clear message, never fall back to plain storage
Account
Account not funded
"Not activated" state with Friendbot button
Account
Friendbot fails or rate-limits
Retry button plus a link to the Stellar Lab faucet
Account
Horizon down or slow
Banner, cached last balances marked "as of HH:MM", retry
Send
Sending to your own address
Block: "That's this wallet"
Send
Amount like 1.12345678 or .5 or 1,000
8+ decimals rejected; .5 read as 0.5; commas rejected with a hint
Send
Max button for XLM
Uses spendable minus the fee, so the reserve stays intact
Send
Recipient is the asset issuer
Allowed; skip the trustline check
Send
Memo over 28 bytes (emoji count as more)
Byte counter, block above 28
Send
Double tap on Confirm
Button disabled at first tap; one signed XDR per review
Send
Balance changed between review and confirm
op_underfunded mapped; reload balances
Send
Lock timer fires on the review screen
Ask for password, then sign the same reviewed transaction
Send
Timeout after submit
Poll by hash; never auto-resend a new transaction
Assets
Two assets with the same code, different issuers
Always show issuer; picker groups by code + issuer
Assets
Remove asset with balance > 0
Blocked with the reason
Assets
Asset requires issuer authorisation
Show "Waiting for issuer approval" on the balance row
History
Payments the app doesn't recognise (path payments, claimable balances)
Show as "Other operation" with the Stellar Expert link
Network
Someone sets a Mainnet URL
Network is fixed to Testnet in this build; the badge can't be hidden
Build plan
Seven days, with the riskiest part (keys and vault) first, so it gets the most testing time. Designs are done before Day 1, as with PayLink.
Day
Build
Done when
Deliverable
1
Vite + React + TypeScript + Tailwind setup, routing, Testnet config, CSP headers, Vercel deploy pipeline. core/keys: generate, SEP-5 derive, import and validation
Unit tests pass against the official SEP-5 test vectors; preview URL live
D1
2
core/vault: encrypt, decrypt, IndexedDB, unlock, auto-lock, cross-tab lock. Onboarding screens: Welcome, Back up, Confirm phrase, Import, Set password, Unlock
Create → reload → unlock works; wrong password rejected; no secret in storage or network log
D1
3
core/stellar account: load, Friendbot fund, balances, spendable XLM. Dashboard, Receive with QR, Add asset (USDC trustline)
New wallet funded and showing XLM; USDC trustline added; balances refresh
D1, D3
4
Transaction engine: send form, recipient checks, payment or createAccount, review, local sign, submit, result, timeout polling, error mapping
XLM and USDC sends between two test wallets succeed; every error in the table has a test
D2
5
History with Load more, transaction detail, SEP-7 paste, Settings (lock, export, remove), loading and error states on every screen
Full MVP flow works without dev tools
D2, D3
6
End-to-end tests on Testnet, security pass, mobile polish, accessibility pass
All tests green; checklist below signed off
All
7
Fix list from Day 6, README, 2-minute demo video, production deploy, handover call
David runs the MVP flow himself on the live URL
Handover
Code layout
src/
  core/keys/      generate, derive (SEP-5), import, validate
  core/vault/     crypto (Web Crypto), storage (IndexedDB), session, autolock
  core/stellar/   horizon client, account, assets, payments, history, errors
  features/       onboarding, dashboard, send, receive, assets, history, settings
  ui/             shared components
  config.ts       network URLs and passphrase
core/ has no React in it, so the key and transaction logic is unit-tested on its own.
Testing and acceptance
STOVA is accepted when David can run the MVP flow on the live URL and every box below is ticked.
Automated
• Unit (Vitest): SEP-5 derivation against the official vectors, phrase and secret validation, vault round-trip, wrong-password failure, amount parsing, spendable-XLM maths, error-code mapping.
• Integration on real Testnet: fund two fresh wallets with Friendbot, add USDC trustlines, send XLM and USDC both ways, createAccount to a new address, every blocking case (no trustline, unfunded recipient, over-balance).
• End-to-end (Playwright, phone and desktop sizes): create → back up → unlock → fund → add USDC → receive → send → see hash → history.
MVP flow checklist (manual, on the live URL)
[ ] Create a wallet, back up and confirm the phrase
[ ] Import the same wallet in another browser with the phrase; same G… address
[ ] Import with an S… secret key
[ ] Fund with Friendbot and see the XLM balance
[ ] Add USDC and receive test USDC from the Circle faucet
[ ] Send XLM and USDC; hash and status shown; Stellar Expert link opens
[ ] Transaction appears in history with correct direction
[ ] Invalid address, insufficient balance and no-trustline errors show plain messages
[ ] Testnet badge visible on every screen
Security checks
[ ] Browser network tab: no request ever contains the secret, phrase or password
[ ] IndexedDB and localStorage hold only ciphertext and the public key
[ ] Auto-lock wipes the key; signing after lock asks for the password
[ ] CSP blocks an injected inline script and any non-Horizon request
[ ] npm audit clean of high and critical issues
Open questions for David
[ ] Recovery phrase (12/24 words) plus secret key, or secret key only? The plan assumes both.
[ ] One wallet per browser, or several accounts in one STOVA? The plan assumes one.
[ ] Any assets beyond XLM and Testnet USDC he wants preset?
[ ] Domain or subdomain for the live URL?

Several account with Stova 

U can add multiple testnet 