# STC Rangers Render Deployment

## Why Render

Render is the best fit for this build because it runs the existing Node server and supports a persistent disk for member data, profile photos, RSVP records, rant posts, reset tokens, and account requests.

GoDaddy should stay as the domain registrar. The app should run on Render, then GoDaddy DNS points `stcrangers.ca` to Render after testing passes.

## Render Service Settings

- Type: Web Service
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Instance type: Starter or higher
- Disk: enabled
- Disk mount path: `/var/data/stc-rangers`

## Environment Variables

Set these on Render:

```text
NODE_ENV=production
STC_PUBLIC_URL=https://stcrangers.ca
STC_DATA_DIR=/var/data/stc-rangers
STC_ADMIN_EMAIL=stcrangersgolf@gmail.com
STC_SESSION_SECRET=<long random value>
```

Email can be added using either:

```text
STC_EMAIL_WEBHOOK_URL=<Google Apps Script web app URL>
STC_EMAIL_WEBHOOK_SECRET=<matching secret>
SMTP_FROM=STC Rangers Golf League <stcrangersgolf@gmail.com>
```

or:

```text
RESEND_API_KEY=<resend key>
SMTP_FROM=STC Rangers Golf League <info@stcrangers.ca>
```

## Data Safety

The server uses `STC_DATA_DIR` for all mutable private data. On first boot, it seeds missing files from the bundled `data/` folder, then keeps future changes on the persistent disk.

Do not cut DNS over until:

- `/api/health` returns ok.
- Login works with a test member.
- Forgot password sends or cleanly records a reset.
- Password setup link works.
- Standings, matches, tournaments, rant, profile, and RSVP flows work.
- Profile photo upload survives restart.
- RSVP attendee list survives restart.

