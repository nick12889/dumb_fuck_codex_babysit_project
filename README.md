# Aileen dental demo

A standalone, browser-based walkthrough of the NC AI dental patient-access offer.

## Run locally

Open `index.html` in a modern browser. Browser voice requires browser support and microphone permission. If voice is unavailable, the text-chat demo still works.

## Demo behavior

- Collects practice contact details before opening the walkthrough.
- Demonstrates scripted dental chat, native browser voice with start/stop and transcript, callback requests, direct appointment requests, and three proposed times (A/B/C).
- Restricts sample booking times to 10:00–18:00.
- Generates visible practice and patient email drafts. “Open email draft” opens a `mailto:` draft in the visitor’s email application; it does not send mail by itself.
- Shows activity and email drafts in the owner-side demo panel. Data remains in page memory only and disappears on reload.
- Describes the four commercial packages. Package cards are offer descriptions, not proof that every production capability is connected.

## Explicit demo limits

This demo does not use a database, Cloudflare D1, CRM, external email API, live calendar, telephone provider, or paid AI service. It does not send messages, book a real appointment, place a callback, or save activity across browser sessions. Generated email drafts are clearly labelled as drafts. Do not enter real patient or clinical information.

For deployment as a static Cloudflare Worker asset, review `wrangler.toml` and run Wrangler from this directory with the appropriate account access. Deploy only this separate demo. Do not point it at or modify the live NC AI site or worker.
