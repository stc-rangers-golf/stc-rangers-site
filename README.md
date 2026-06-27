# STC Rangers Standalone Build

This is the non-Wix standalone build for the STC Rangers Golf League site.

## Current Preview

Run locally:

```sh
cp .env.example .env
npm install
node server.js
```

Open:

```text
http://127.0.0.1:8790
```

## What Is Built

- Public homepage with the golf-course hero, Rangers logo, Peter McBride memorial, June 17 prize winners, and current league news.
- Rules tab for Rangers rules.
- Member login gate with forgot password, forgot email, and create account controls in the UI.
- Member accounts seeded from the private contact export. Imported members set their own password by reset link; old Wix passwords are not imported.
- Password reset, forgot-email lookup, and account-request API routes.
- Protected standings with A/B/C flight tabs.
- Standings player click expands weekly scores directly under that player.
- Protected match brackets for A, B, C, and Club Championship.
- Match player hover displays phone and email for arranging matches.
- Protected Rant page with title and message composer.
- Protected Tournaments page with 2026 dates and Going/Maybe/Not Going controls.

## Privacy Shape

The app now has a small Node server instead of being only static files.

- Public files are served normally.
- Direct access to `data/private/*` is blocked.
- Private standings, matches, contacts, rant, and tournament data are served through `/api/private/*`.
- `/api/private/*` requires a login session.

The login now uses a temporary production-test account file at `data/private/users.local.json`.
This is good enough for a temporary private test URL, but before final public launch it should be replaced with managed auth, magic links, or a full member account system.

## Data Sources

Data was generated from the existing Wix rebuild package and Rangers Rick match handoff backups:

- Standings: `LeagueStandings-import-2026-06-03.json`
- Weekly results: `WeeklyResults-import-2026-06-03.json`
- Matches: `work/wix-audit/matchresults-cms-upsert-20260619.json`
- Rant posts: `RantPosts-import-2026.json`
- Tournaments: `TournamentEvents-import-2026.json`
- Contacts: `contact-email-export-2026-06-10.private.json`

Regenerate data:

```sh
node scripts/build-data.js
```

## Deployment Path Once Domain Credentials Are Available

1. Pick hosting that can run the Node server, or convert the API routes to serverless functions.
2. Connect real outgoing email so password reset and tournament RSVP emails are delivered instead of only logged. Use `.env.example` as the required environment variable checklist.
3. Move private data storage from JSON files to a database or protected persistent file store.
4. Point DNS for the new domain to the new host only after the temporary host passes testing.
5. Keep Wix unchanged until the new host is tested on a temporary domain.
6. Cut DNS over only after homepage, login, password reset, forgot email, standings, matches, tournaments, rant, profile, and logout are verified.

## Temporary Production Login Test

The temporary test login requires an email and password. Bad passwords are rejected, private API routes return `401` while logged out, and the session cookie is `HttpOnly`.

For a real migration away from Wix, existing members do not need to re-register from scratch. We can import names, emails, and phone numbers, then ask members to set a new password or use a magic login link. Wix cannot export existing member passwords, which is normal and protects the members.

Password reset emails are generated into `data/private/email-outbox.local.json` until a real mail provider is connected. Do not launch member access publicly until outgoing email is connected and tested.

## Do Not Forget

The working Wix login path remains the emergency fallback. Do not disturb it while this standalone build is being prepared.
