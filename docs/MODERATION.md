# Moderation

Axis publishes a 24-hour response commitment in three places a user can read:
`CommunityGuidelinesScreen`, `TermsOfServiceScreen`, and
[dataaxis.org/guidelines](https://dataaxis.org/guidelines). It is also stated in
the App Store Review notes.

This document is the process behind that promise. It exists because Guideline
1.2 makes the developer responsible for removing violating content, and App
Review can ask how compliance will improve when violating content is found —
which is much easier to answer from a written process than to invent under time
pressure.

## What is enforced automatically

These run in Postgres, not the client, so a modified client or a direct
PostgREST call cannot skip them.

| Control | Where | Covers |
| --- | --- | --- |
| Objectionable-text filter | `BEFORE` triggers (`0032`) | `listings.title`, `listings.description`, `messages.body`, `profiles.name`, `profiles.bio`, `reviews.body` |
| Message rate limit | `trg_messages_rate_limit` (`0036`) | One account flooding another's inbox |
| Report rate limit | `trg_reports_rate_limit` (`0036`) | Burying the queue in noise |
| Mutual blocking | RLS `is_blocked()` (`0002`) | Feed, search, profile and inbox, both directions |

The term list lives in `banned_terms` and is editable in Studio with no code
change or deploy. It is revoked from client roles, so an abuser cannot read the
list to work around it.

**Images are not automatically screened.** Listing photos and avatars are
moderated reactively, through the flow below. This is a known gap, stated in the
App Store Review notes, and the reason the response time below matters more than
it otherwise would.

## Reading the queue

Reports land in `public.reports` and are triaged through the `reports_queue`
view (`0012`), which joins in the reporter and target names and emails plus the
listing title, ordered open-first.

Open it in the **Supabase Studio SQL editor**:

```sql
select * from public.reports_queue;
```

> **`service_role` will not work for this**, despite the name. It holds only
> `REFERENCES, TRIGGER, TRUNCATE` on `reports`, `listings` and `profiles` — no
> `SELECT` — so a service-key REST call fails on privileges. Studio works
> because it connects as `postgres`. If moderation ever moves off Studio, that
> role needs grants first.

## The commitment

**Every report gets a decision within 24 hours of being filed.**

One person owns the queue. Until there is a second, that is the project owner.

- **Check:** once each morning, and again in the evening.
- **Escalate immediately, outside the schedule:** anything describing a threat
  of violence, sexual content involving minors, or a credible risk to someone's
  physical safety. These do not wait for the next check.

A 24-hour clock with two checks a day leaves room for one missed check without
breaking the promise. If checks are missed for more than a day, the honest fix
is to change the number published in the app and on the site — not to let the
published figure drift away from what actually happens.

## Acting on a report

1. **Read the reported content** via the queue row. It carries enough context
   to decide without contacting either party.
2. **Decide.** Weigh it against the published
   [community guidelines](https://dataaxis.org/guidelines), not personal taste —
   those are what the user agreed to and what Apple will be shown.
3. **Act:**

   | Severity | Action |
   | --- | --- |
   | Clear violation | Delete the content, then suspend or ban the account |
   | Borderline | Remove the content, leave the account, note the reason |
   | No violation | Dismiss |
   | Threat / minor safety | Ban immediately, preserve the evidence, then consider law enforcement |

4. **Record it.** Move `status` from `open` to `resolved` or `dismissed`. The
   status column is the audit trail — an App Review response is much stronger
   with timestamps showing reports being closed inside the window than with an
   assertion that they are.
5. **Do not reveal the reporter.** Reports are confidential; the app tells users
   so.

### Removing content

```sql
-- A single listing (its storage objects go with it, via the 0030 trigger).
delete from public.listings where id = '<listing_id>';

-- Profile text only, leaving the account and its listings intact.
update public.profiles set bio = '', name = '<neutral placeholder>'
where id = '<user_id>';
```

**Never `delete from public.profiles` to remove one bad listing.** That cascades
to every listing, message, review and block the account owns. Removing a
profile row is account termination, not content removal — reach for it only when
that is the intended outcome.

### Banning an account

Deleting the `auth.users` row cascades the entire graph. It also writes a
SHA-256 of the address into `deleted_account_cooldowns` (`0031`), which blocks
re-signup from the same address for 14 days — so a banned user cannot
immediately return through the front door.

That is a 14-day speed bump, not a permanent ban. A determined abuser with a
second `@uwo.ca` address can still return. Permanent enforcement needs a
persistent blocklist, which does not exist yet.

## Adding a banned term

```sql
insert into public.banned_terms (term) values ('<term>');
```

Matching is whole-word (`\m…\M`) and case-insensitive, so ordinary marketplace
copy is not caught by accident — "Cocker Spaniel" and "Dickens" are safe. Prefer
specific terms over broad stems for the same reason. Adding a term takes effect
on the next insert; no deploy is needed.

## Known gaps

Tracked honestly, because a plan that names its own gaps is more credible than
one that does not:

- **No automated image moderation.** The largest gap. Photos are the primary
  content of a listing and nothing screens them before they go live.
- **No in-app moderator tooling.** Everything above is hand-run SQL in Studio.
- **No persistent ban list.** Enforcement is a 14-day cooldown keyed to an
  email hash.
- **No appeal path.** A user whose content is removed has no route back except
  emailing the published contact.
