# STC Rangers Deployment Checklist

## Current Safe State

- GoDaddy is the target live host for `stcrangers.ca`.
- The standalone Node build is ready in this folder.
- Private member data is not served directly from `/data/private`.
- Private API routes return `401` unless logged in.
- Member accounts are seeded from the contact export.
- Imported members must set their own password by reset link.
- Committee page loads phone/email from the public committee list and profile photos from the matching account when present.

## Host Requirements

The host must support:

- Node.js 20 or newer
- `npm install`
- `npm start`
- Persistent private file storage or a database for member/profile/RSVP/rant changes
- Environment variables
- HTTPS

## Required Environment Variables

Use `.env.example` as the starting point.

- `STC_PUBLIC_URL=https://stcrangers.ca`
- `STC_ADMIN_EMAIL=stcrangersgolf@gmail.com`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Do Not Cut Over Until These Pass

- `/api/health` returns `ok: true`
- Homepage loads publicly
- Rules and Committee load publicly
- Logged-out `/api/private/standings` returns `401`
- Password reset email sends to a real mailbox
- Reset link opens `/reset-password?token=...`
- Reset link lets a member set a password
- Member login works after reset
- Standings load after login
- Player weekly scores expand directly under the clicked player
- Matches load after login
- Bracket notes do not create repeated bye lanes
- Tournaments load after login
- RSVP writes successfully and sends confirmation email
- Rant post submits successfully
- Profile photo upload updates the profile page
- Committee page displays uploaded profile photo for committee members
- Logout returns user to public state

## DNS Cutover Shape

- Keep a zipped backup of the standalone build and exported private data before every GoDaddy upload.
- Deploy code updates without overwriting live `.local.json` files for users, reset tokens, profile photos, RSVP data, and email outbox.
- Verify `stcrangers.ca` after every publish because it is now the live member URL.
