# Reply to the Guideline 2.1 information request

Apple rejected 1.0.0 (4) on 2026-09-24 with **Guideline 2.1 - Information Needed
- New App Submission**. This is the questionnaire sent to developer accounts
with limited review history, not a defect report: nothing in the app was found
to be broken. It asks for six things, and for the same information to be added
to **App Review Information → Notes** for future submissions.

Part 1 below is written to be pasted into the Resolution Center reply. Part 2 is
the recording it refers to. Part 3 is what has to be true before either is sent.

`store/REVIEW_NOTES.md` carries the same answers for the Notes field.

---

## Part 1 — paste into the Resolution Center reply

Thank you for the review. The information requested is below, and has also been
added to App Review Information → Notes.

1. SCREEN RECORDING

A screen recording made on a physical iPhone running the current iOS, beginning
with the app launching from the Home screen, is attached. It shows, in order:
account registration with a university email and the 6-digit verification code,
sign-in, browsing and searching listings, posting a listing with a photo,
messaging another user, reporting content, blocking a user, unblocking from
Settings, and deleting the account from Settings.

The app has no paid content, features or subscriptions, so no purchase flow
appears in the recording.

2. PURPOSE AND TARGET AUDIENCE

Axis is a buy-and-sell marketplace for students and alumni of Western University
in London, Ontario, Canada -- roughly 40,000 students plus alumni. They list
second-hand items they no longer need, such as textbooks, furniture and
electronics, message each other in the app, and hand the item over in person on
or near campus.

The problem it solves is that this trade currently happens in large, unmoderated
social media groups where buyers cannot tell who they are dealing with. Axis
verifies that every account belongs to a university email address, and gives
every listing, conversation and profile a report and block control.

Axis is independent. It is not affiliated with, endorsed by or operated by
Western University.

3. SETTING UP AND ACCESSING FEATURES

Sign-up is restricted to @uwo.ca and @alumni.uwo.ca addresses and confirmed by a
6-digit code emailed to that address, so a reviewer cannot self-register. Please
sign in with the demo account in App Review Information → Sign-In Information.
It is pre-loaded with listings, photos and a conversation, and has no two-factor
authentication. A second demo account is at the end of the Notes field, so that
messaging, reporting and blocking can be exercised between two real users.

- Browse and search: Home tab; the search bar opens category, condition and
  maximum-price filters.
- Post a listing: centre "+" tab. Camera and photo-library permission are
  requested there, at the moment a photo is added, and nowhere else.
- Message a seller: open a listing, then "Message seller".
- Report or block: the "..." button at the top right of any listing,
  conversation or profile. Blocking does not require filing a report first.
- Blocked users: Profile tab → Settings → Blocked users, where a block can be
  undone.
- Delete account: Profile tab → Settings → Danger zone → Delete account, then
  type DELETE. This permanently removes the account, its listings, messages and
  uploaded photos.

Deleting a demo account is safe: both demo addresses are exempt from the 14-day
re-registration rule, and we will recreate either on request.

4. EXTERNAL SERVICES

- Supabase (supabase.com) -- authentication (sign-up, sign-in, email
  verification), the database (listings, profiles, messages), file storage
  (listing photos and profile photos), and realtime message delivery.
- Resend (resend.com) -- transactional email: the confirmation sent to a user
  who files a report, and the alert sent to our moderation address.
- Sentry (sentry.io) -- crash reports only. No user identifier, no IP address
  and no performance tracing are collected.
- Expo Application Services -- build and distribution tooling only; it is not
  contacted by the shipped app at runtime.

There are no payment processors, no advertising, analytics or attribution SDKs,
no AI services, and no third-party data providers. The app does not track users
and requests no tracking permission.

5. REGIONAL DIFFERENCES

There are none. The app is offered in Canada only, and behaves identically
wherever it is available: the same features, the same content and the same
moderation rules. Nothing is gated by region or by IP address, and the app never
requests location permission. The only eligibility rule is the university email
domain, which is not a geographic restriction.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL

Axis does not operate in a highly regulated industry. It processes no payments,
offers no financial, medical, gambling or cannabis-related services, and sells
nothing itself.

It includes no third-party or licensed material. Every listing, photo, profile
and message is created by the verified account that posted it, under Terms of
Service and Community Guidelines accepted at sign-up that prohibit objectionable
content and material the user has no right to post. Listing and profile text and
messages are filtered against a server-side blocklist before they are saved;
anything reported is reviewed and removed, and the responsible account banned.

---

## Part 2 — the screen recording

Apple's requirements: a **physical device**, **current iOS**, and the recording
**must begin with the app launching**. Keep it under about five minutes, in one
take if possible, and do not speed it up.

Before recording, sign in as demo account 2 on a second device or simulator so
there is a real person on the other end of the conversation, and have a real
@uwo.ca inbox open for the registration shot.

| # | Shot | What must be visible |
| --- | --- | --- |
| 1 | Launch | Tap the icon on the Home screen. Welcome screen appears. |
| 2 | Registration | Create account → name, a real @uwo.ca address, password, confirm, tick the Terms box → Continue. Show the 6-digit code arriving in the inbox, enter it, complete the profile step, land on Home. |
| 3 | Sign in | Sign out from Settings, then sign back in with the demo account, to show login separately from registration. |
| 4 | Browse and search | Home feed, tap a category chip, open search, apply a filter, open a listing. |
| 5 | Post a listing | "+" tab → add a photo (show the permission prompt) → title, price, category, condition, pickup → Post → the listing appears. |
| 6 | Messaging | Open a listing posted by demo account 2 → Message seller → send a message → show the reply arriving. |
| 7 | Reporting | On that listing, "..." → Report or block → choose a reason → Submit report → the confirmation. |
| 8 | Blocking | "..." → Block → the confirmation dialog → confirm → their listings are gone from the feed. |
| 9 | Unblocking | Settings → Blocked users → unblock, to show it is reversible. |
| 10 | Account deletion | Settings → Danger zone → Delete account → type DELETE → confirm → the app returns to the Welcome screen. |

Use a throwaway account created in shot 2 for the deletion in shot 10, so the
demo accounts survive. Attach the file in the Resolution Center; if it is too
large, upload it somewhere stable and put the link in the reply.

---

## Part 3 — before sending

1. **R01 — report email must actually work.** Parts 1 and 4 above, and the Notes
   field, state that a reporter receives a confirmation and that moderation is
   alerted. Finish that setup first, then file a test report and confirm both
   messages arrive. Do not send a reply that describes behaviour the build does
   not have.
2. **R03 — both demo accounts must exist, be seeded and be signed into once.**
   The reviewer will sign in, and shots 6 to 9 need the second account.
3. **R13 — availability must be Canada only**, or answer 5 is not true.
4. **Upload a build that matches the recording.** Whatever is recorded must be
   the binary under review; record from the build that is submitted.
5. Paste the same answers into App Review Information → Notes, per Apple's
   instruction, and keep the Sign-In Information fields current.
