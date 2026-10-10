# Aileen dental demo

This repository contains a clinic sales walkthrough for the NC AI Strategy Partners dental demo. It starts with clinic discovery, demonstrates scripted text chat, browser voice, callback and appointment flows, and ends with one tools feedback question. Patient and clinic activity is clearly labelled as demo data; the booking flow does not connect to a live calendar.

## Provider connections

The Cloudflare Worker source can send email through AgentMail when `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, and `DEMO_OBSERVER_EMAIL` are configured. It can initiate an Aileen callback through Vapi when `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, and `VAPI_PHONE_NUMBER_ID` are configured. Credentials belong in the Cloudflare environment and must not be committed. A successful callback request means Vapi accepted the request; it does not prove that a call was answered.

Text replies are scripted. Browser voice uses the visitor's browser speech recognition and speech synthesis. There is no live calendar, CRM, durable session store, or automatic reminder service. Email provider acceptance is not proof of inbox delivery.

## Checks

Run the local safety tests with Node.js:

```sh
node --test tests/submission-safety.test.mjs
```

The app and Worker are browser modules. Syntax checks can be run with:

```sh
node --input-type=module --check < app.js
node --input-type=module --check < worker.js
node --input-type=module --check < email-templates.js
```

The submission guard blocks duplicate direct bookings, A/B/C confirmations, and callback requests after acceptance or an uncertain result. A definitive rejection can be retried. Uncertain provider outcomes require external reconciliation before retrying the same request.

## Deployment

Deployment is a separate step. These repository changes do not deploy or alter the live Cloudflare Worker.
