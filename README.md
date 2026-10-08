# Aileen dental demo

Standalone dental front-desk demo with scripted text chat, browser voice, callback and appointment requests, and email delivery through AgentMail. It does not use a database or CRM and does not place phone calls or book a real calendar appointment.

## Email setup

Add these as **Worker secrets/variables in Cloudflare**. Never commit their values to GitHub.

- `AGENTMAIL_API_KEY` — AgentMail API key with permission to send from the chosen inbox.
- `AGENTMAIL_INBOX_ID` — the inbox ID shown by AgentMail.
- `OWNER_EMAIL` — the address that receives practice notifications and conversation summaries.

The demo asks users to consent before unlocking. Callback and booking actions send notifications to `OWNER_EMAIL`, the entered practice email, and the patient confirmation address. The summary button sends the conversation summary to `OWNER_EMAIL` and the practice contact. The page reports send status.

## Deploy

The Worker serves the repository's static files; `/api/*` requests are handled by `worker.js`. Configure the three email secrets on the Cloudflare Worker named `dumb-fuck-codex-babysit-project` before testing delivery.

## Limits

- No database, CRM, local storage, or persistent conversation history.
- Appointment times are limited to 10:00–18:00, but availability is not checked and no appointment is booked.
- Callback requests send email only; no phone call is placed.
- Browser voice depends on microphone permission and browser support.
- The demo sends real emails only after the visitor checks the consent box and submits an email action. Do not enter real clinical information.
