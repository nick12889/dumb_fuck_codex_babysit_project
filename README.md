# Aileen demo v2 — implementation pending user testing

Preserves the original cream/green layout. Adds owner and email-preview tabs, floating navigation, four-package comparison, urgency and after-hours routing, direct/A-B-C demo booking, owner selection, downloadable illustrative calendar entry, reminder example, reschedule and cancel.

Email events: end text chat, end voice conversation, booking choices, confirmation, callback, reminder example, reschedule, cancellation and final demo summary. Each sends business-owner, customer and provider role copies. Preview templates are shared between browser and Worker. Status is individual per role; accepted means provider acceptance, not inbox delivery. Retries skip acknowledged roles. In-memory server deduplication is best effort; ambiguous timeouts and Worker restarts can still duplicate a message.

Cloudflare Production: AGENTMAIL_API_KEY as Secret; AGENTMAIL_INBOX_ID=ncai-hermes@agentmail.to; DEMO_OBSERVER_EMAIL=nishant.chaudhary@ncaistrategypartners.com. keep_vars preserves dashboard configuration on deployment. Never add the API key to repository files.

Sessions are memory-only. Ending locks new activity and waits for voice input to finish before the final summary. Restart clears visible and internal session history. No real CRM, calls, calendar connection, automatic scheduled reminders or clinical advice. Responses are scripted; browser voice needs a compatible browser and permission. User-led functional and email tests remain pending.
