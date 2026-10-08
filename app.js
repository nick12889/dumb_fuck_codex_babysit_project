const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
let lead = null;
const messages = $('#messages');
const conversation = [];

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
  conversation.push({ who: who === 'you' ? 'Visitor' : 'Aileen', text });
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
    return true;
  } catch (error) {
    statusNode.textContent = error.message || 'Email could not be sent.';
    activity('Email not sent', 'Check Worker email settings');
    return false;
  }
}
$('#leadForm').addEventListener('submit', (event) => {
  event.preventDefault();
  lead = { name: $('#name').value.trim(), business: $('#business').value.trim(), email: $('#email').value.trim(), phone: $('#phone').value.trim(), consent: $('#emailConsent').checked };
  $('#gateStatus').textContent = `Demo unlocked for ${lead.business}. Use the email actions to send a message.`;
  $('#callbackPhone').value = lead.phone; $('#callbackEmail').value = lead.email; $('#patientEmail').value = lead.email;
  const greeting = messages.firstElementChild; greeting.replaceChildren();
  const label = document.createElement('div'); label.className = 'who'; label.textContent = 'AILEEN';
  greeting.append(label, document.createTextNode(`Hi ${lead.name.split(' ')[0]}! I’m Aileen, the virtual receptionist for ${lead.business}. How can I help today?`));
  conversation.push({ who: 'Aileen', text: `Welcome to ${lead.business}. How can I help today?` });
  activity('Demo started', `${lead.name} · ${lead.business}`);
});
$('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault(); const input = $('#chatInput'); const text = input.value.trim();
  if (text && lead) { input.value = ''; addMsg(text, 'you'); addMsg(reply(text), 'ai'); activity('Text conversation', 'Aileen replied to a patient question'); }
  else if (!lead) toast('Enter your details to start the demo');
});
$$('.suggestions button').forEach((button) => button.addEventListener('click', () => {
  if (!lead) return toast('Enter your details to start the demo');
  addMsg(button.textContent, 'you'); addMsg(reply(button.textContent), 'ai'); activity('Text conversation', 'Aileen replied to a patient question');
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
      addMsg(text, 'you'); addMsg(answer, 'ai');
      if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(answer));
      activity('Voice conversation', 'Transcript captured in this browser session');
    }
  };
  recognition.onerror = () => { $('#transcript').textContent = 'Microphone access was unavailable. Check browser permissions.'; };
  recognition.onend = () => { $('#voiceStart').disabled = false; $('#voiceStop').disabled = true; };
}
$('#voiceStart').addEventListener('click', () => {
  if (!lead) return toast('Enter your details to start the demo');
  if (!recognition) { $('#transcript').textContent = 'Voice recognition is not supported in this browser. Try Chrome or Edge.'; return; }
  try { recognition.start(); $('#voiceStart').disabled = true; $('#voiceStop').disabled = false; $('#transcript').textContent = 'Listening…'; }
  catch { $('#transcript').textContent = 'Voice input could not start. Check microphone permission and try again.'; }
});
$('#voiceStop').addEventListener('click', () => recognition?.stop());
for (let hour = 10; hour <= 18; hour++) for (const minute of ['00', '30']) {
  if (hour === 18 && minute !== '00') continue;
  const value = `${String(hour).padStart(2, '0')}:${minute}`; const option = document.createElement('option'); option.value = value; option.textContent = value; $('#time').append(option);
}
$('#date').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$('#callbackForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!lead) return toast('Enter your details to start the demo');
  const status = $('#callbackStatus');
  await sendEmail('callback', { lead, phone: $('#callbackPhone').value.trim(), patientEmail: $('#callbackEmail').value.trim(), reason: $('#callbackReason').value.trim() }, status);
});
$('#bookingForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!lead) return toast('Enter your details to start the demo');
  const date = $('#date').value, time = $('#time').value, patientEmail = $('#patientEmail').value.trim();
  if (!date || !time || time < '10:00' || time > '18:00') return;
  const status = $('#bookingStatus');
  await sendEmail('booking', { lead, patientEmail, date, time }, status);
});
fetch('/api/health').then((response) => response.json()).then((health) => {
  $('#summaryStatus').textContent = health.emailConfigured ? 'Email sender is configured. Actions send real emails after consent.' : 'Email sender is not configured yet. Add the three Worker secrets listed in the repository README.';
}).catch(() => { $('#summaryStatus').textContent = 'Email service status is unavailable. Make sure this demo is opened from its Cloudflare Worker URL.'; });
$('#summaryDraftButton').addEventListener('click', async () => {
  if (!lead) return toast('Enter your details to start the demo');
  const status = $('#summaryStatus');
  const transcript = conversation.map((line) => `${line.who}: ${line.text}`).join('\n') || 'No conversation yet.';
  await sendEmail('summary', { lead, transcript }, status);
});
