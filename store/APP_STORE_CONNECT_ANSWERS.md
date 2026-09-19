# App Store Connect: what to enter

For whoever has the App Store Connect login. Each answer below was derived from
the code in this repo, and says where, so it can be re-checked if the app
changes. The listing text itself is in `store/metadata/en-CA/` and the reviewer
notes are in `store/REVIEW_NOTES.md`.

App Store Connect rewords its questions from time to time. Where a question on
screen does not match what is written here, answer from the facts in the right
hand column, not from the wording.

## App information

| Field | Value |
| --- | --- |
| Name | `Axis: Campus Marketplace`. "Axis" alone is very likely taken; names are unique across the store. |
| Subtitle | `Buy and sell with classmates` |
| Bundle ID | `com.axis.app` |
| Primary language | English (Canada) |
| Primary category | Shopping |
| Secondary category | Lifestyle, or leave empty |
| Privacy Policy URL | https://dataaxis.org/privacy |
| Support URL | https://dataaxis.org/support |
| Marketing URL | https://dataaxis.org |
| Price | Free. No in-app purchases. |
| Availability | **Canada only.** This is what keeps the export compliance answer below true; the reasoning is in `docs/STORE_READINESS.md` under "Export compliance". |

## App Privacy

**Do you or your third-party partners collect data from this app?** Yes.

**Is any data used to track users?** No. There is no advertising, analytics or
attribution SDK in `package.json`, and `NSPrivacyTracking` is `false`.

Declare exactly these eight types and no others. They mirror
`expo.ios.privacyManifests` in `app.json` one for one; a label that disagrees
with the manifest is the most common privacy rejection.

| App Store Connect data type | Linked to the user | Tracking | Purpose | Where it comes from |
| --- | --- | --- | --- | --- |
| Contact Info → Email Address | Yes | No | App Functionality | Sign-up, sign-in, verification code |
| Contact Info → Name | Yes | No | App Functionality | `profiles.name` |
| Identifiers → User ID | Yes | No | App Functionality | Supabase auth id |
| User Content → Photos or Videos | Yes | No | App Functionality | Listing photos, avatar |
| User Content → Emails or Text Messages | Yes | No | App Functionality | Buyer and seller messages |
| User Content → Other User Content | Yes | No | App Functionality | Listing title and description, bio, program, year, pickup location as free text, report reasons |
| Usage Data → Product Interaction | Yes | No | App Functionality | Listing views, saves, follows, read receipts |
| Diagnostics → Crash Data | **No** | No | App Functionality | Sentry, with `sendDefaultPii: false` and no `setUser()` call (`src/lib/sentry.ts`) |

Deliberately **not** declared, because the app does not collect them: phone
number, precise or coarse location (no location permission exists; pickup spots
are typed text), search history (never stored server side), payment or purchase
data (no payments), device or advertising identifiers, performance data
(`tracesSampleRate: 0`). Over-declaring is its own rejection risk.

## Age rating

Axis is a marketplace built on user-generated content with private messaging.
Answer the content questions "None" throughout, **except**:

| Question | Answer | Why |
| --- | --- | --- |
| User-generated content | Yes | Listings, profiles and photos are all written by users |
| Messaging or chat | Yes | Buyer and seller direct messages |
| Does the app include social media capabilities? | **Yes** | Apple's definition is the ability to "interact with user-generated content through a social feed or similar discovery method that visibly spreads content to many users". The Home feed shows every user's listings to every other user, and users can save, follow and message from it. Answering yes sets a 13+ minimum, which costs nothing here. |
| Are those capabilities disabled for under-13s? | Not applicable | Accounts require a university email; the Privacy Policy excludes under-13s |
| Unrestricted web access | No | Links out only to dataaxis.org and mailto |
| Gambling, contests, alcohol, tobacco, drugs, violence, sexual content, horror, medical | None | No such content is built in. User content that contained it would breach the Community Guidelines and is handled by filtering, reporting and removal. |
| In-app controls: parental controls, age assurance | No | None exist |

Expect a result of at least 13+. Do not try to steer it lower.

## Export compliance

| Question | Answer |
| --- | --- |
| Does your app use encryption? | Yes |
| Does it qualify for any exemption listed? / Which algorithms? | Standard encryption algorithms **in addition to** those in Apple's operating system. The app encrypts the stored session with AES-256 from a bundled library (`src/lib/supabase.ts`). Nothing proprietary. |
| Will the app be available in France? | **No**, given Canada-only availability |

With those answers no document upload is asked for, and
`ITSAppUsesNonExemptEncryption: false` in `app.json` is accurate. If availability
is ever widened to include France, stop and read "Export compliance" in
`docs/STORE_READINESS.md` first.

## Content rights, advertising identifier, sign-in

| Question | Answer |
| --- | --- |
| Does your app contain, show or access third-party content? | No. All content is created by its users, who grant the rights in the Terms of Service. |
| Does this app use the Advertising Identifier (IDFA)? | No |
| Sign-in required | Yes. Put both demo accounts in Sign-In Information. |

## Screenshots

6.9" and 6.5" iPhone. Show the app in use: the Home feed, a listing, a
conversation, the create flow, a profile. Never the welcome, sign-in or splash
screen. No iPad set is needed while `supportsTablet` is `false`.
