const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sendHistory = new Map();

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function validateLead(lead) {
  return lead && typeof lead === 'object'
    && clean(lead.name, 100) && clean(lead.business, 160)
    && EMAIL_RE.test(clean(lead.email, 254)) && clean(lead.phone, 40)
    && lead.consent === true;
}
function rateLimited(request) {
  const key = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const recent = (sendHistory.get(key) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 40) return true;
  recent.push(now);
  sendHistory.set(key, recent);
  return false;
}
async function sendEmail(env, to, subject, text) {
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(env.AGENTMAIL_INBOX_ID)}/messages/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.AGENTMAIL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ to, subject, text, html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</div>` })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.message_id) throw new Error('The email provider rejected a message. Check the AgentMail inbox and sending permissions.');
  return result.message_id || null;
}
async function sendToRecipients(env, recipients, subject, body) {
  const unique = [...new Set(recipients.map((email) => clean(email, 254).toLowerCase()).filter((email) => EMAIL_RE.test(email)))];
  const settled = await Promise.allSettled(unique.map((email) => sendEmail(env, email, subject, body)));
  const sent = settled.filter((result) => result.status === 'fulfilled').length;
  const failures = settled.length - sent;
  return { sent, total: settled.length, partial: sent > 0 && failures > 0, messageIds: settled.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value) };
}
function internalFooter() {
  return '\n\nSent by the Aileen demo after the user requested a test email. This is a demonstration message; no calendar booking, phone call, or database update occurred.';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, emailConfigured: Boolean(env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID && EMAIL_RE.test(clean(env.DEMO_OBSERVER_EMAIL, 254))) });
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Cross-origin request rejected.' }, 403);
    if (!env.AGENTMAIL_API_KEY || !env.AGENTMAIL_INBOX_ID || !EMAIL_RE.test(clean(env.DEMO_OBSERVER_EMAIL, 254))) {
      return json({ error: 'Email is not configured yet. Set AGENTMAIL_API_KEY, AGENTMAIL_INBOX_ID and DEMO_OBSERVER_EMAIL as Worker secrets.' }, 503);
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 20000) return json({ error: 'Request is too large.' }, 413);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
    if (!body || typeof body !== 'object' || clean(body.website, 200)) return json({ error: 'Invalid request.' }, 400);
    if (!validateLead(body.lead)) return json({ error: 'Enter your name, practice, valid business email and phone, and confirm that demo emails may be sent.' }, 400);
    if (rateLimited(request)) return json({ error: 'Email demo limit reached for this network. Try again later.' }, 429);

    const lead = body.lead;
    const observer = clean(env.DEMO_OBSERVER_EMAIL, 254);
    const practice = clean(lead.email, 254);
    let subject;
    let detail;
    let patientEmail = '';
    if (url.pathname === '/api/summary') {
      patientEmail = clean(body.patientEmail, 254);
      if (!EMAIL_RE.test(patientEmail)) return json({ error: 'Enter your personal email for the customer summary.' }, 400);
      const transcript = clean(body.transcript, 6000) || 'No conversation yet.';
      const eventTitle = ({text: 'Text chat summary', voice: 'Voice call summary', demo: 'Complete demo summary'})[body.event] || 'Conversation summary';
      subject = `${eventTitle} · ${clean(lead.business, 160)}`;
      detail = `${subject}\n\nContact: ${clean(lead.name, 100)}\nPractice: ${clean(lead.business, 160)}\nBusiness email: ${practice}\nPhone: ${clean(lead.phone, 40)}\n\nConversation:\n${transcript}${internalFooter()}`;
    } else if (url.pathname === '/api/callback') {
      patientEmail = clean(body.patientEmail, 254);
      const phone = clean(body.phone, 40);
      if (!phone || !EMAIL_RE.test(patientEmail)) return json({ error: 'Enter a callback phone number and a valid email for the confirmation.' }, 400);
      subject = `Callback request · ${clean(lead.business, 160)}`;
      detail = `Callback requested through the Aileen demo\n\nPractice: ${clean(lead.business, 160)}\nPatient phone: ${phone}\nPatient email: ${patientEmail}\nReason: ${clean(body.reason, 300) || 'No reason provided'}${internalFooter()}`;
    } else if (url.pathname === '/api/booking') {
      patientEmail = clean(body.patientEmail, 254);
      const date = clean(body.date, 10), time = clean(body.time, 5);
      if (!EMAIL_RE.test(patientEmail) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || time < '10:00' || time > '18:00') {
        return json({ error: 'Enter a valid patient email, date and time between 10:00 and 18:00.' }, 400);
      }
      subject = `Appointment request · ${clean(lead.business, 160)}`;
      detail = `Appointment request received through the Aileen demo\n\nPractice: ${clean(lead.business, 160)}\nPatient email: ${patientEmail}\nPreferred date: ${date}\nPreferred time: ${time}\n\nThis is a request for the practice to confirm. No calendar was checked and no appointment was booked.${internalFooter()}`;
    } else {
      return json({ error: 'Not found.' }, 404);
    }

    const patientBody = url.pathname === '/api/booking'
      ? `Hello,\n\nWe received your appointment request for ${clean(lead.business, 160)} on ${clean(body.date, 10)} at ${clean(body.time, 5)}. The practice team will need to confirm the time.${internalFooter()}`
      : url.pathname === '/api/callback'
        ? `Hello,\n\nWe received your callback request for ${clean(lead.business, 160)}. The practice team will follow up using the phone number you provided.${internalFooter()}`
        : `Hello ${clean(lead.name, 100)},\n\nHere is the Aileen demo conversation summary you requested.\n\n${clean(body.transcript, 6000) || 'No conversation yet.'}${internalFooter()}`;

    try {
      const recipients = [practice];
      if (EMAIL_RE.test(observer) && observer.toLowerCase() !== practice.toLowerCase() && observer.toLowerCase() !== patientEmail.toLowerCase()) recipients.push(observer);
      const customerSubject = url.pathname === '/api/summary' ? subject : url.pathname === '/api/booking' ? `We received your appointment request · ${clean(lead.business, 160)}` : `We received your callback request · ${clean(lead.business, 160)}`;
      const [internalResult, patientResult] = await Promise.all([
        sendToRecipients(env, recipients, subject, detail),
        sendToRecipients(env, [patientEmail], customerSubject, patientBody)
      ]);
      const totalSent = internalResult.sent + patientResult.sent;
      if (!totalSent) return json({ error: 'No email was accepted by AgentMail. Check AgentMail recipient permissions and Worker secrets.' }, 502);
      return json({ ok: true, sent: totalSent, total: internalResult.total + patientResult.total, partial: totalSent < internalResult.total + patientResult.total, messageIds: [...internalResult.messageIds, ...patientResult.messageIds] });
    } catch {
      return json({ error: 'The email provider could not send the message. Check AgentMail configuration.' }, 502);
    }
  }
};
