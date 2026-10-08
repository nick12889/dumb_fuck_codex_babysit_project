const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
let lead = null;
const messages = $('#messages');
const conversation = [];
let finished = false;
let channel = 'text';
let voiceEnding = false;
const summaryCursor = {text: 0, voice: 0};

function toast(text) {
  const node = $('#toast');
  node.textContent = text;
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 3000);
}
function activity(title, detail) {
  const row = document.createElement('div'); row.className = 'activity-row';
  const dot = document.createElement('div'); dot.className = 'dot';
  const copy = document.createElement('div'); copy.append(document.createTextNode(title));
  const small = document.createElement('small'); small.textContent = detail; copy.append(small);
  row.append(dot, copy); $('#activity').prepend(row);
}
function addMsg(text, who) {
  const node = document.createElement('div'); node.className = `msg ${who === 'you' ? 'you' : ''}`;
  const label = document.createElement('div'); label.className = 'who'; label.textContent = who === 'you' ? 'YOU' : 'AILEEN';
  node.append(label, document.createTextNode(text)); messages.append(node); messages.scrollTop = messages.scrollHeight;
  conversation.push({ who: who === 'you' ? 'Visitor' : 'Aileen', text, channel });
}
function reply(question) {
  const q = question.toLowerCase();
  if (/hour|open|close|time/.test(q)) return 'Our practice can help with appointment requests between 10:00 and 18:00. Would you like me to find a time?';
  if (/new patient|accept|register/.test(q)) return 'We’d be happy to welcome new patients. I can take your details and ask the practice team to follow up.';
  if (/toothache|pain|emergency|swollen/.test(q)) return 'I’m sorry you’re dealing with that. For severe swelling, heavy bleeding, or trouble breathing, seek urgent medical help. Otherwise, I can ask the dental team to contact you.';
  if (/book|appointment|visit/.test(q)) return 'Use the Book a visit tab to choose a preferred date and a time between 10:00 and 18:00. I’ll prepare request and confirmation emails for the practice to review.';
  if (/price|cost|insurance/.test(q)) return 'The practice team can confirm current fees and insurance details. I can ask them to contact you.';
  return 'I can help with opening hours, new patient enquiries, and appointment requests. For treatment advice, I’ll connect you with the dental team.';
}
async function sendEmail(kind, data, statusNode) {
  statusNode.textContent = 'Sending email…';
  try {
    const response = await fetch(`/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, website: $('#website').value }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Email could not be sent.');
    statusNode.textContent = result.partial ? `Partially sent: ${result.sent} of ${result.total} email messages. Check the AgentMail inbox.` : `AgentMail accepted email for ${result.sent} recipient${result.sent === 1 ? '' : 's'}.`;
    activity('Email accepted by AgentMail', `${kind} · ${new Date().toLocaleTimeString()}`);
    return !result.partial;
  } catch (error) {
    statusNode.textContent = error.message || 'Email could not be sent.';
    activity('Email not sent', 'Check Worker email settings');
    return false;
  }
}
$('#leadForm').addEventListener('submit', (event) => {
  event.preventDefault();
  lead = { name: $('#name').value.trim(), business: $('#business').value.trim(), email: $('#email').value.trim(), phone: $('#phone').value.trim(), customerEmail: $('#customerEmail').value.trim(), consent: $('#emailConsent').checked };
  $('#gateStatus').textContent = `Demo unlocked for ${lead.business}. Play the customer. Chat endings, bookings and the final demo summary each send three emails.`;
  $('#callbackPhone').value = lead.phone; $('#callbackEmail').value = lead.customerEmail; $('#patientEmail').value = lead.customerEmail;
  finished = false; conversation.length = 0; summaryCursor.text = 0; summaryCursor.voice = 0; $('#summaryDraftButton').disabled = false; $('#summaryDraftButton').textContent = 'Finish demo & email all three';
  const greeting = messages.firstElementChild; greeting.replaceChildren();
  const label = document.createElement('div'); label.className = 'who'; label.textContent = 'AILEEN';
  greeting.append(label, document.createTextNode(`Hi ${lead.name.split(' ')[0]}! I’m Aileen, the virtual receptionist for ${lead.business}. How can I help today?`));
  conversation.push({ who: 'Aileen', text: `Welcome to ${lead.business}. How can I help today?` });
  activity('Demo started', `${lead.name} · ${lead.business}`);
});
$('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault(); const input = $('#chatInput'); const text = input.value.trim();
  if (text && lead) { channel = 'text'; input.value = ''; addMsg(text, 'you'); addMsg(reply(text), 'ai'); activity('Text conversation', 'Aileen replied to a patient question'); }
  else if (!lead) toast('Enter your details to start the demo');
});
$$('.suggestions button').forEach((button) => button.addEventListener('click', () => {
  if (!lead) return toast('Enter your details to start the demo');
  channel = 'text'; addMsg(button.textContent, 'you'); addMsg(reply(button.textContent), 'ai'); activity('Text conversation', 'Aileen replied to a patient question');
}));
$$('.tab').forEach((button) => button.addEventListener('click', () => {
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab === button));
  $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === button.dataset.panel));
}));
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.lang = 'en-IE'; recognition.interimResults = true;
  recognition.onresult = (event) => {
    let text = ''; for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
    $('#transcript').textContent = `You: ${text}`;
    if (event.results[event.results.length - 1].isFinal) {
      const answer = reply(text); $('#transcript').textContent = `You: ${text}\nAileen: ${answer}`;
      channel = 'voice'; addMsg(text, 'you'); addMsg(answer, 'ai');
      if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer));
      activity('Voice conversation', 'Transcript captured in this browser session');
    }
  };
  recognition.onerror = () => { $('#transcript').textContent = 'Microphone access was unavailable. Check browser permissions.'; };
  recognition.onend = async () => { $('#voiceStart').disabled = false; if (voiceEnding) { voiceEnding = false; await endChannel('voice', $('#voiceEmailStatus'), $('#voiceStop')); } };
}
$('#voiceStart').addEventListener('click', () => {
  if (!lead) return toast('Enter your details to start the demo');
  if (!recognition) { $('#transcript').textContent = 'Voice recognition is not supported in this browser. Try Chrome or Edge.'; return; }
  try { recognition.start(); $('#voiceStart').disabled = true; $('#voiceStop').disabled = false; $('#transcript').textContent = 'Listening…'; }
  catch { $('#transcript').textContent = 'Voice input could not start. Check microphone permission and try again.'; }
});
$('#voiceStop').addEventListener('click', async () => {
  if (!lead) return toast('Start the demo first');
  if ($('#voiceStart').disabled && recognition) { voiceEnding = true; recognition.stop(); }
  else await endChannel('voice', $('#voiceEmailStatus'), $('#voiceStop'));
});
for (let hour = 10; hour <= 18; hour++) for (const minute of ['00', '30']) {
  if (hour === 18 && minute !== '00') continue;
  const value = `${String(hour).padStart(2, '0')}:${minute}`; const option = document.createElement('option'); option.value = value; option.textContent = value; $('#time').append(option);
}
$('#date').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$('#callbackForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!lead) return toast('Enter your details to start the demo');
  const status = $('#callbackStatus');
  lead.customerEmail = $('#callbackEmail').value.trim();
  conversation.push({ who: 'Customer callback request', text: `Phone: ${$('#callbackPhone').value.trim()}; reason: ${$('#callbackReason').value.trim()}` });
  const button = event.submitter; button.disabled = true;
  await sendEmail('callback', {lead, patientEmail: lead.customerEmail, phone: $('#callbackPhone').value.trim(), reason: $('#callbackReason').value.trim()}, status);
  button.disabled = false;
});
$('#bookingForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!lead) return toast('Enter your details to start the demo');
  const date = $('#date').value, time = $('#time').value, patientEmail = $('#patientEmail').value.trim();
  if (!date || !time || time < '10:00' || time > '18:00') return;
  const status = $('#bookingStatus');
  lead.customerEmail = patientEmail;
  conversation.push({ who: 'Customer appointment request', text: `${date} at ${time}. Demonstration request; no real booking made.` });
  const button = event.submitter; button.disabled = true;
  await sendEmail('booking', {lead, patientEmail, date, time}, status);
  button.disabled = false;
});
fetch('/api/health').then((response) => response.json()).then((health) => {
  $('#summaryStatus').textContent = health.emailConfigured ? 'Email sender is configured. Each completed chat, booking and final demo summary sends three emails.' : 'Email sender is not configured yet. The demo provider needs to configure the email sender.';
}).catch(() => { $('#summaryStatus').textContent = 'Email service status is unavailable. Make sure this demo is opened from its Cloudflare Worker URL.'; });
$('#summaryDraftButton').addEventListener('click', async () => {
  if (!lead) return toast('Enter your details to start the demo');
  const status = $('#summaryStatus');
  const transcript = conversation.map((line) => `${line.who}: ${line.text}`).join('\n') || 'No conversation yet.';
  if (finished) return;
  const button = $('#summaryDraftButton'); button.disabled = true;
  recognition?.stop();
  finished = await sendEmail('summary', { lead, patientEmail: lead.customerEmail, transcript, event: 'demo' }, status);
  button.disabled = finished;
  if (finished) button.textContent = 'Demo finished — emails submitted';
});

async function endChannel(kind, status, button) {
  if (!lead) return toast('Enter your details to start the demo');
  const end = conversation.length;
  const transcript = conversation.slice(summaryCursor[kind], end).filter(line => line.channel === kind).map(line => `${line.who}: ${line.text}`).join('\n');
  if (!transcript) { status.textContent = 'Start a conversation before ending this chat.'; return; }
  button.disabled = true;
  const accepted = await sendEmail('summary', {lead, patientEmail: lead.customerEmail, transcript, event: kind}, status);
  if (accepted) summaryCursor[kind] = end;
  button.disabled = false;
}
$('#endTextChat').addEventListener('click', () => endChannel('text', $('#textEmailStatus'), $('#endTextChat')));
