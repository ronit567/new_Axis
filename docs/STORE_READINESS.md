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
| R03 | B3 | you | open | Demo accounts, restarted 2026-09-20. The previous `axis.app@outlook.com` auth user was deleted by hand; `signup_email_exceptions` was never touched, so `0035`'s whitelist row for it is still live. `0050` upserts both demo addresses (`axis.app@outlook.com`, `axis.app2@outlook.com`) so one migration lists the pair. Apply `0050` **before** creating either user — the `0018` before-user-created hook fires on dashboard-created users too. Then: Add user twice with *Auto Confirm User* ticked, insert a `public.profiles` row for each (nothing auto-creates one, so the reviewer would otherwise land in `SetupProfile`), then sign in on a real build and seed listings, photos and a conversation between them. Note both demo logins share the published support mailbox, which R27 would rather they did not; accepted deliberately. `store/REVIEW_NOTES.md` already promises App Review two working accounts — not true until this row closes. |
| R04 | H1 / LIVE | you | open | Dashboard-only auth settings need reviewing before launch. Details are kept out of this public repository, in the maintainer's private launch notes. |
| R05 | H3 | agent | done | Export compliance worked through against Apple's own matrix; see "Export compliance" below. `app.json:19` stays `false`, which is accurate only under the condition recorded there. The declaration itself is R13. |
| R06 | GUARD / L1 | agent | done | Removed the `axis` scheme from `app.json`: nothing handled it (no `linking` config, no `Linking` listener, share sheets send plain text). The guard finding stays because Expo registers the bundle id as a scheme; see the waiver. |
| R07 | G3 | agent | done | expo-doctor 18/18. `expo`, `jest-expo`, `@types/react` aligned to SDK 54; `expo-constants` de-duplicated; `babel-preset-expo` declared as a dev dependency because `babel.config.js` names it and it had only been reachable through npm hoisting. |
| R08 | GUARD | agent | done | Accessibility. The skill's `accessibility-audit.py` reports clean but only scans native files (7 here) and never opens a `.tsx`, so it proves nothing for this app; the pass was done by hand. `textMuted` 2.6:1 → 5.0:1 (`src/constants/theme.ts`). 37 tappable controls that had no role now have role, name and state, including icon-only buttons VoiceOver could not name and the terms checkbox, which announced no checked state. Tests added for the shared primitives. **Not done:** a Dynamic Type strategy (sizes are fixed), and a VoiceOver pass on a device, which belongs to R17. |
| R09 | G6 | agent | done | Listing drafted in `store/metadata/en-CA/`; the metadata audit is clean on all eight fields and the three URLs resolve. Every claim was checked against the code (report targets, notification types, both accepted email domains). Name is `Axis: Campus Marketplace` because a bare "Axis" is almost certainly taken. Nothing has been pushed to App Store Connect. |
| R10 | G6 | agent | done | `store/REVIEW_NOTES.md` written and fact-checked against the code. No credentials in it. Its header lists the two statements that are not true until R01 and R03 are done; do not paste it before then. |
| R11 | L4 | agent | done | `src/types/database.ts` checked against a fresh generation from production: every client table matches column for column (Row, Insert, Update), all five called RPCs are typed, no review types remain. The body was already right; only the header was stale, so the ten "pending regen" notes were replaced with what was verified and why the file differs from raw generator output on purpose (tightened views, server-only tables left out). Not pasted over wholesale, which would have loosened the views. |
| R12 | L3 | agent | done | `PRODUCTION_AUDIT.md`, `AI_context.md` and `PROJECT_ROADMAP.md` carry a dated banner pointing here for release status. Confirmed while there that no rating or star UI survives the removal of reviews. |
| R13 | H3 | you | open | Export compliance answer in App Store Connect, **and** set availability so France is excluded (recommended: Canada only). The two go together; see "Export compliance" below. Answers to enter: `store/APP_STORE_CONNECT_ANSWERS.md`. |
| R14 | 5.1.1 | you | open | App Privacy labels, matching the eight types in `app.json` `privacyManifests` exactly. Not exposed by the API. Table is in `PRODUCTION_AUDIT.md` under "Privacy manifest — done". Exact table to enter: `store/APP_STORE_CONNECT_ANSWERS.md`. |
| R15 | M5 | you | open | Age rating questionnaire, including the social media capability questions. Recommended answers, including "yes" to social media capabilities with Apple's definition quoted: `store/APP_STORE_CONNECT_ANSWERS.md`. |
| R16 | 2.3.3 | you | open | Screenshots at 6.9" and 6.5" showing the app in use, never the login or splash screen. |
| R17 | B2 / M4 | you | open | `eas build --profile preview`, install on a physical iPhone, walk every flow. Check iPad too: `supportsTablet` is false, so it runs in compatibility mode, and App Review tests on one. |
| R18 | CHECKLIST | you | open | Account and program readiness: membership active, latest agreements accepted, banking and tax not blocking. Walk that section of `PRE-SUBMISSION-CHECKLIST.md`. |
| R19 | LIVE | agent | done | Migration drift. Production has all 46 local migrations, `0001`–`0047` (there is no `0027` on either side). Read via Supabase MCP 2026-09-19. |
| R20 | LIVE | agent | done | Security advisors reviewed 2026-09-19: no ERROR-level findings. The warnings are tracked privately. |
| R21 | M1 M2 M3 M6 H2 | agent | done | Closed by commits since the docket: Free/Trade rendering, 8-char passwords, reviews removed, drift guard fixed. |
| R22 | 2.1 | agent | done | Dead control removed: the chat input bar had an "Add emoji" button with no handler. Found during the accessibility pass; no other no-op handlers exist in `src/`. |
| R23 | M1 | agent | done | The docket's "$0" fix missed the chat banner, which printed `$0` for Free and Trade listings. It now prints a price only when there is one. Chat is handed a bare number; passing the Free/Trade flags through would need a change to the `conversation_list` view in production. |
| R24 | 1.2 | you | open | Image moderation. Text is filtered server-side (`0032`); photos are not screened at all, and `listing-images` is a public bucket, so a photo is world-readable the moment it posts. `store/REVIEW_NOTES.md:64` discloses this and `docs/MODERATION.md` carries the reactive process, but no row records the decision. Decide before submitting: ship as disclosed, or add screening (Rekognition / Vision SafeSearch / Hive in an edge function on the upload path). Most likely 1.2 rejection vector. |
| R25 | 2.3.6 | you | open | `TermsOfServiceScreen` sets eligibility by email domain only and states no minimum age; the privacy policy's under-13 line is a COPPA statement, not a term. Add a minimum-age clause matching whatever R15 answers. |
| R26 | 5.2.1 | you | open | Be ready to evidence the use of the university's name and email domain. The non-affiliation clause is in the terms and pinned by `src/screens/__tests__/nonAffiliation.test.tsx`, but App Review sometimes asks apps built around a named institution for authorization, and the university's own brand or IT policy may bear on third-party use of its domain. No action unless asked; keep the answer ready. |
| R27 | 1.2 | you | open | Confirm mail to the published contact address (`axis.app@outlook.com`, in the three legal screens and two Settings rows) actually reaches whoever watches the report queue. `report-alert` sends to `reports@dataaxis.org`, a different mailbox. Guideline 1.2 requires contact information users can reach, and a reviewer may email it. |
| R28 | 5.1.1 | you | open | Sentry source maps. The Expo plugin warns `Missing config for organization, project`; without those, or `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` in the EAS environment, maps never upload and crash reports arrive minified. Set them as secrets in the `production` and `preview` environments; the auth token belongs there regardless. |
| R29 | 2.1 | agent | done | `@sentry/react-native` was declared and registered as a config plugin but absent from `node_modules`, so `tsc --noEmit` failed with three `TS2307` plus a consequent `TS7006`, and the plugin would first have executed on an EAS production build. Clean `npm ci` at current `main` (expo 54.0.37): typecheck exits 0, 331 tests in 32 suites pass, architecture guard passes, `expo config --type prebuild` resolves the plugin without throwing. Remaining config is R28; that a crash reaches Sentry is unverified and belongs to R17. |

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
| BOTH-SUBSCRIPTION-HARD-CANCEL | `src/lib/fetchWithTimeout.ts:32` | `caller's signal (React Query cancelling` | Axis sells nothing: no subscriptions, no in-app purchases, no payments. The rule pairs the word "subscribe" with "call ... cancel" anywhere in the source. Here "subscribe" is realtime channel and AppState subscriptions, and the cited line is a comment about a caller's AbortSignal cancelling a request. |

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
| `@expo/vector-icons` | no | Icon fonts, bundled at build time. Was a transitive dependency of `expo` before SDK 57 and is now declared directly; nothing about its behaviour changed. |
| `expo-asset` | no | Resolves bundled assets. Required by `expo-font` under `@expo/vector-icons`. Production assets ship in the binary; no runtime fetch. |
| `expo-font` | no | Loads the bundled DM Sans faces and the icon fonts behind `@expo/vector-icons`. A required peer of the latter since SDK 57; without it the app crashes outside Expo Go. Fonts ship in the binary, so nothing is fetched. |
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
5. **R24** — decide on image moderation: ship as disclosed, or add screening.
6. **R25** — add a minimum-age clause to the Terms of Service.
7. **R27** — confirm the published contact address reaches the report queue.
8. **R28** — Sentry org, project and auth token into the EAS environments.
9. **R26** — no action unless App Review asks; keep the institutional-name answer ready.

### Needs the App Store Connect account

The account holder does these, or invites you so you can. In the order App
Store Connect asks for them.

10. **R18** — account and program readiness.
11. **R02** — create the app record (name `Axis: Campus Marketplace`, since a bare "Axis" is almost certainly taken; confirm `com.axis.app` is free), then the three identifiers into `eas.json`.
12. **R14** — App Privacy labels, exactly the eight manifest types. The table to enter is in `store/APP_STORE_CONNECT_ANSWERS.md`, as are the answers for the next two.
13. **R15** — age rating questionnaire with the social media questions.
14. **R13** — export compliance answer, and availability set to Canada only so that answer is true.
15. **R17** — preview build on a real iPhone and an iPad, every flow, once with VoiceOver on. Signing a device build needs the Apple team.

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
