# Store readiness ledger (iOS)

The single list of what stands between this repo and an App Store submission.
`npm run check:store` reads this file; the tables below are parsed, so keep the
column order and the `## ` headings as they are.

A green gate means every machine-checkable item is proven. It is **not** a
clearance to submit — the rows owned by `you` cannot be seen from a terminal.

Guard checksum: `b44349d61b39115e17e154e3fe7cc22d26f55f8821bc3c7a6532d69c8b89a791`

That is `~/.claude/hooks/app-store-compliance-guard.sh` with its two local
patches. If the guard is deliberately updated, re-run its own test suite and
record the new checksum here in the same commit.

## Items

Owner is `agent` or `you`. Status is `open`, `done` or `waived`. Sources: `B/H/M/L`
ids are from the 11 Sept docket (`Axis Submission ToDo.html`), `GUARD` is the
compliance guard, `LIVE` was read from the production Supabase project,
`CHECKLIST` is the skill's `PRE-SUBMISSION-CHECKLIST.md`.

| Id | Source | Owner | Status | What and evidence |
| --- | --- | --- | --- | --- |
| R01 | B4 / LIVE | you | open | Report handling: one server-side piece is not set up yet. Details are kept out of this public repository, in the maintainer's private launch notes. |
| R02 | B2 | you | open | `eas.json` still carries the three `REPLACE_WITH_` Apple identifiers. Needs the App Store Connect app record first. |
| R03 | B3 | you | open | Demo accounts. `0035_review_demo_account.sql:37` whitelists `axis.app@outlook.com`, which is also the published support address. Create two accounts on a non-support mailbox, seed listings, photos and a conversation. |
| R04 | H1 / LIVE | you | open | Dashboard-only auth settings need reviewing before launch. Details are kept out of this public repository, in the maintainer's private launch notes. |
| R05 | H3 | agent | done | Export compliance worked through against Apple's own matrix; see "Export compliance" below. `app.json:19` stays `false`, which is accurate only under the condition recorded there. The declaration itself is R13. |
| R06 | GUARD / L1 | agent | done | Removed the `axis` scheme from `app.json`: nothing handled it (no `linking` config, no `Linking` listener, share sheets send plain text). The guard finding stays because Expo registers the bundle id as a scheme; see the waiver. |
| R07 | G3 | agent | done | expo-doctor 18/18. `expo`, `jest-expo`, `@types/react` aligned to SDK 54; `expo-constants` de-duplicated; `babel-preset-expo` declared as a dev dependency because `babel.config.js` names it and it had only been reachable through npm hoisting. |
| R08 | GUARD | agent | done | Accessibility. The skill's `accessibility-audit.py` reports clean but only scans native files (7 here) and never opens a `.tsx`, so it proves nothing for this app; the pass was done by hand. `textMuted` 2.6:1 → 5.0:1 (`src/constants/theme.ts`). 37 tappable controls that had no role now have role, name and state, including icon-only buttons VoiceOver could not name and the terms checkbox, which announced no checked state. Tests added for the shared primitives. **Not done:** a Dynamic Type strategy (sizes are fixed), and a VoiceOver pass on a device, which belongs to R17. |
| R09 | G6 | agent | open | Draft the listing into `store/metadata/`: name, subtitle, keywords, description, promotional text, privacy and support URLs. Claim only what the app does; no other-platform mentions. Local only, nothing pushed. |
| R10 | G6 | agent | open | Write `store/REVIEW_NOTES.md` from the skill template: the `@uwo.ca` gate, where report / block / blocked users / guidelines live, the image-moderation gap from `docs/MODERATION.md`, external services. No credentials in the repo. |
| R11 | L4 | agent | open | `src/types/database.ts` still has ten `MANUAL ADDITION (pending regen)` blocks. Production is migrated through `0047`, so regenerate and drop them. |
| R12 | L3 | agent | open | `PRODUCTION_AUDIT.md` (2026-07-12) and `AI_context.md` (2026-07-01) describe blockers that are long closed. Mark them superseded by this ledger. |
| R13 | H3 | you | open | Export compliance answer in App Store Connect, **and** set availability so France is excluded (recommended: Canada only). The two go together; see "Export compliance" below. |
| R14 | 5.1.1 | you | open | App Privacy labels, matching the eight types in `app.json` `privacyManifests` exactly. Not exposed by the API. Table is in `PRODUCTION_AUDIT.md` under "Privacy manifest — done". |
| R15 | M5 | you | open | Age rating questionnaire, including the social media capability questions. |
| R16 | 2.3.3 | you | open | Screenshots at 6.9" and 6.5" showing the app in use, never the login or splash screen. |
| R17 | B2 / M4 | you | open | `eas build --profile preview`, install on a physical iPhone, walk every flow. Check iPad too: `supportsTablet` is false, so it runs in compatibility mode, and App Review tests on one. |
| R18 | CHECKLIST | you | open | Account and program readiness: membership active, latest agreements accepted, banking and tax not blocking. Walk that section of `PRE-SUBMISSION-CHECKLIST.md`. |
| R19 | LIVE | agent | done | Migration drift. Production has all 46 local migrations, `0001`–`0047` (there is no `0027` on either side). Read via Supabase MCP 2026-09-19. |
| R20 | LIVE | agent | done | Security advisors reviewed 2026-09-19: no ERROR-level findings. The warnings are tracked privately. |
| R21 | M1 M2 M3 M6 H2 | agent | done | Closed by commits since the docket: Free/Trade rendering, 8-char passwords, reviews removed, drift guard fixed. |
| R22 | 2.1 | agent | done | Dead control removed: the chat input bar had an "Add emoji" button with no handler. Found during the accessibility pass; no other no-op handlers exist in `src/`. |
| R23 | M1 | agent | done | The docket's "$0" fix missed the chat banner, which printed `$0` for Free and Trade listings. It now prints a price only when there is one. Chat is handed a bare number; passing the Free/Trade flags through would need a change to the `conversation_list` view in production. |

## Guard waivers

A HIGH finding that is wrong about this app, with the line that proves it. The
gate checks that the cited line still holds the text in the third column, so a
citation that drifts fails loudly. Never clear a finding by editing the guard or
by seeding keywords into source.

| Pattern | Evidence | Line contains | Why it does not apply |
| --- | --- | --- | --- |
| APPLE-ACCOUNT-DELETION-WEAK | `supabase/migrations/0029_delete_account_storage.sql:48` | `delete from auth.users where id = uid` | Fires when "delete account" and `mailto:` both appear anywhere. Deletion is real: Settings calls the `delete_own_account()` RPC (`src/repositories/ProfileRepository.ts:58`), which deletes the `auth.users` row and cascades. The `mailto:` links are support contacts on the legal screens. |
| WEB-TRACKING-TECHNOLOGIES | `package-lock.json:5296` | `es-set-tostringtag` | The `gtag` pattern matches `es-set-tostringtag` in the lockfile and the saved docket HTML in the repo root. `package.json` has no analytics, advertising or attribution SDK. |
| BOTH-UNSAFE-DEEPLINK | `app.json:16` | `"bundleIdentifier": "com.axis.app"` | Expo registers the bundle identifier as a URL scheme on every prebuild, so this fires for any Expo app. No handler exists for any scheme and no token, reset link or credential is ever passed through one; auth uses emailed codes. Revisit if deep links are ever wired. |

## Export compliance

Worked through on 2026-09-20 against Apple's
[export compliance documentation matrix](https://developer.apple.com/help/app-store-connect/reference/export-compliance-documentation-for-encryption/)
and [Complying with Encryption Export Regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).
This is a legal declaration, so the account holder makes it; this is the
reasoning and a recommendation, not the decision.

**What the app does.** HTTPS and the keychain are Apple's. On top of that,
`src/lib/supabase.ts` encrypts the stored session with AES-256-CTR from `aes-js`,
because a Supabase session overflows SecureStore's 2 KB cap. AES is an industry
standard algorithm, but that copy of it is ours, not the operating system's.

**Where that lands in Apple's matrix.** "Your app uses an industry standard
algorithm, not provided within the Apple operating system" → a French encryption
declaration must be uploaded, and the footnote limits that to apps "distributing
... on the App Store in France". No CCATS is needed; nothing here is proprietary.

**What `ITSAppUsesNonExemptEncryption: false` claims.** Apple: set it to `NO` if the
app "only uses forms of encryption that are exempt from export compliance
documentation requirements". With `aes-js` in the binary that is true **only if
the app is not distributed in France**. Sold in France with the flag at `false`,
the declaration would be wrong.

**Recommendation: make Axis available in Canada only.** It is gated to `@uwo.ca`
addresses, so nobody outside the Western community can sign in anyway, and
Apple's own page notes that export rules attach to distribution "outside the
U.S. or Canada". With that, the flag is accurate as it stands and no document
is owed to anyone. In App Store Connect's encryption questions the honest
answers are: uses encryption → yes; standard algorithms in addition to the
operating system's → yes; available in France → no.

**If worldwide availability is ever wanted**, pick one before widening it:
file the ANSSI declaration and switch the flag to `true` with the compliance
code Apple returns; or remove `aes-js` by splitting the session across several
SecureStore entries under 2 KB each, which leaves only operating-system
encryption and takes the app out of this matrix entirely. The second is a change
to session storage and should not be made in a hurry before a launch.

Not verified here: whether a year-end self-classification report to the US BIS
applies. Apple says exempt encryption "might" require one. It is an EAR question
for whoever owns the developer account, and it does not arise for Canada-only
distribution.

## Reviewed dependencies

Every runtime dependency, and whether it moves data off the device. A new row
here means the privacy manifest, the App Store labels and the published policy
have been re-checked against it.

| Package | Off device | Note |
| --- | --- | --- |
| `@supabase/supabase-js` | yes | The backend. Everything in the privacy manifest except crash data goes here. |
| `@sentry/react-native` | yes | Crash data only. `sendDefaultPii: false`, `setUser()` never called, `tracesSampleRate: 0`, query strings stripped. |
| `expo-image` | yes | Fetches listing and avatar images from Supabase Storage. Sends nothing of its own. |
| `@expo-google-fonts/dm-sans` | no | Font files are bundled at build time; no runtime request to Google. |
| `@react-native-async-storage/async-storage` | no | Local storage. |
| `@react-native-masked-view/masked-view` | no | UI. |
| `@react-navigation/native` | no | UI. |
| `@react-navigation/native-stack` | no | UI. |
| `@tanstack/react-query` | no | In-memory cache; requests go through the Supabase client. |
| `aes-js` | no | Encrypts the session at rest, around SecureStore's 2KB cap. See R05. |
| `expo` | no | Runtime. No `expo-updates`, so no update server is contacted. |
| `expo-blur` | no | UI. |
| `expo-crypto` | no | Local randomness: the session key and client-generated ids. |
| `expo-haptics` | no | UI. |
| `expo-image-manipulator` | no | Resizes photos on device before upload. |
| `expo-image-picker` | no | Camera and photo library; the two permission strings are in `app.json`. |
| `expo-linear-gradient` | no | UI. |
| `expo-secure-store` | no | Keychain. |
| `expo-splash-screen` | no | UI. |
| `expo-status-bar` | no | UI. |
| `react` | no | Runtime. |
| `react-native` | no | Runtime. |
| `react-native-safe-area-context` | no | UI. |
| `react-native-screens` | no | UI. |
| `react-native-url-polyfill` | no | Polyfill for the Supabase client. |

## NEEDS YOU

Keep this in step with the `you` rows above. `check:store` lists these as
reminders; `check:store:submit` fails until every one is marked `done`.

### No App Store Connect access needed

These are yours and can happen any time, in this order.

1. **R01** — finish the report-handling setup (see the private launch notes).
2. **R04** — review the dashboard-only auth settings (see the private launch notes).
3. **R03** — two demo accounts on a non-support mailbox, seeded with real content.
4. **R16** — capture the screenshots (simulator is fine). Uploading them is in the next list.

### Needs the App Store Connect account

The account holder does these, or invites you so you can. In the order App
Store Connect asks for them.

5. **R18** — account and program readiness.
6. **R02** — create the app record, then the three identifiers into `eas.json`.
7. **R14** — App Privacy labels, exactly the eight manifest types.
8. **R15** — age rating questionnaire with the social media questions.
9. **R13** — export compliance answer, and availability set to Canada only so that answer is true.
10. **R17** — preview build on a real iPhone and an iPad, every flow. Signing a device build needs the Apple team.

## Hand-off for the account holder

Better than sharing a login: in App Store Connect, **Users and Access → invite**
the developer's own Apple ID with the **App Manager** role. Shared logins break
on two-factor prompts, and an individual role can be removed later.

If they would rather do it themselves, this is everything needed from them:

1. Confirm the Developer Program membership is active and the latest agreement is accepted (R18).
2. Create the app: platform iOS, name `Axis`, bundle ID `com.axis.app`, primary language English. If that bundle ID is taken, say so before anything else — it changes `app.json`.
3. Send back three values for `eas.json`: the Apple ID email on the account, the numeric Apple ID of the new app (App Information → General), and the Team ID (Membership details).
4. Create an API key: Users and Access → Integrations → App Store Connect API, role App Manager. Send the issuer ID, key ID and the `.p8` file over a private channel. The `.p8` downloads once, and must never be committed (`*.p8` is gitignored).
5. Leave the listing text, privacy labels, age rating and export answers — those will be filled from `store/metadata/`, `store/REVIEW_NOTES.md` and this ledger once access exists.
