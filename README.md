# Aileen demo: three recipients per event

The visitor plays both roles. Their business email receives the owner summary or booking notification; their personal email receives the customer summary or confirmation. The demo provider receives a third copy.

Triggers: End text chat, End voice chat, Submit appointment request, Submit callback request, and Finish demo. The final demo summary includes text, voice and requested bookings/callbacks. Each trigger submits three separate messages when the addresses differ. Duplicate provider addresses are not sent another copy.

## Cloudflare Production runtime settings
- AGENTMAIL_API_KEY (Secret): AgentMail sender key.
- AGENTMAIL_INBOX_ID: ncai-hermes@agentmail.to.
- DEMO_OBSERVER_EMAIL: provider's email for the third copy (required).

OWNER_EMAIL is obsolete. The owner's address comes from the visitor's business-email field. GitHub secrets do not automatically populate Cloudflare runtime settings.

No real calendar, calls, CRM, or persistent storage. Booking confirmations explicitly describe a demonstration appointment request. Provider acceptance is reported, not claimed inbox delivery. Partial failures are shown; retrying a partial send may duplicate messages already accepted.
