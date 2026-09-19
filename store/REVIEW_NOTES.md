# App Review notes

Everything below the line is written to be pasted into **App Store Connect → App
Review Information → Notes**. The demo sign-in goes in the **Sign-In
Information** fields on that same page, never in this file or anywhere in the
repo.

These notes describe the app as it must be on the day it is submitted. Do not
paste them until ledger items R01 and R03 in `docs/STORE_READINESS.md` are
closed.

---

APP PURPOSE

Axis is a buy-and-sell marketplace for students at Western University (London,
Ontario, Canada). Students list items they no longer need, such as textbooks,
furniture and electronics, message each other in the app, and exchange items in
person. Axis is independent and is not affiliated with Western University.

SIGNING IN: PLEASE USE THE DEMO ACCOUNT

Sign-up is restricted to verified Western University email addresses (@uwo.ca
and @alumni.uwo.ca), confirmed with a 6-digit code sent to that address. A
reviewer cannot create an account, so please sign in with the demo account in
the Sign-In Information fields. It has no two-factor authentication and is
pre-loaded with listings, photos and a conversation.

A second demo account is provided in the same fields, so that messaging,
reporting and blocking can be tested between two real users.

Deleting the demo account is safe. Accounts normally cannot re-register for 14
days after deletion; both demo accounts are exempt from that rule. If you delete
one, the other still works, and we will recreate the deleted one on request.

WHERE TO FIND THINGS

1. Browse and search: Home tab. Tap the search bar for filters (category,
   condition, maximum price).
2. Post a listing: the centre "+" tab. Camera and photo library permission are
   requested here, only when you add a photo.
3. Message a seller: open any listing, then "Message seller".
4. Account deletion (Guideline 5.1.1(v)): Profile tab, Settings, Danger zone,
   Delete account. Type DELETE to confirm. This permanently deletes the account,
   its listings, messages and uploaded photos.

USER-GENERATED CONTENT (GUIDELINE 1.2)

- Terms: creating an account requires agreeing to the Terms of Service, Privacy
  Policy and Community Guidelines, which prohibit objectionable content and
  state that violating content is removed and the account banned.
- Filtering: listing titles and descriptions, profile names and bios, and
  messages are checked against a blocklist in the database before they are
  saved. This runs on the server and cannot be bypassed by a modified client.
- Reporting: the "..." button at the top right of any listing, any conversation
  and any seller profile opens "Report or block". Listings, conversations and
  users can each be reported. The reporter receives an email confirmation.
- Blocking: the same "..." menu. Blocking takes effect immediately and in both
  directions: the two users no longer see each other in the feed, search,
  profiles or messages. Blocks can be reviewed and undone in Settings, Blocked
  users.
- Moderation: the moderator is emailed the moment a report is filed. Every
  report is reviewed, and violating content is removed and the account banned.
- Photos are not screened automatically. They are moderated through the report
  flow above.
- Contact: axis.app@outlook.com, also reachable in the app from Settings, Help
  and support.

PAYMENTS

Axis does not process payments and sells no digital goods or services. Buyers
and sellers agree on a price in chat and exchange physical items in person, so
there are no in-app purchases.

EXTERNAL SERVICES

- Supabase: authentication, database, photo storage, realtime messaging.
- Sentry: crash reports only. No user identifiers, no IP address, no performance
  tracing.
- Resend: transactional email for report confirmations.

There are no advertising, analytics or attribution SDKs, and the app does not
track users.

REGIONAL DIFFERENCES

The app behaves the same everywhere it is available. It is only useful to people
with a Western University email address.
