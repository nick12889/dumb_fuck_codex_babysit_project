export const VERSION = '2026-10-09-demo-v2';
export const titles = {text:'Text chat summary',voice:'Voice conversation summary',demo:'Complete demo summary',booking:'Demo booking confirmation',choices:'Three appointment choices received',callback:'Callback request',cancel:'Demo booking cancelled',reschedule:'Demo booking rescheduled',reminder:'Demo appointment reminder'};
export function classify(text, afterHours = false) {
  const urgent = /pain|urgent|emergency|swollen|swelling|bleed|breath|toothache/i.test(text);
  const intent = /book|appointment|visit/i.test(text) ? 'Appointment enquiry' : /callback|call me|phone/i.test(text) ? 'Callback enquiry' : /price|cost|insurance/i.test(text) ? 'Fees enquiry' : /hour|open|close/i.test(text) ? 'Opening hours enquiry' : /new patient|register/i.test(text) ? 'New patient enquiry' : 'General enquiry';
  return {intent, urgency:urgent?'Urgent — staff review required':'Routine',route:urgent?'Urgent dental team':afterHours?'Next opening — reception follow-up':'Reception',next:urgent?'Contact the dental team promptly. Emergency symptoms require emergency care.':afterHours?'Reception to review at the next opening.':'Reception to review and respond where needed.'};
}
export function buildEmails(event, observer) {
  const {lead, kind} = event;
  const lines = event.lines || [];
  const questions = lines.filter(l=>l.who==='Customer').map(l=>l.text).join('\n');
  const classification = classify(questions + '\n' + (event.reason || ''), event.afterHours);
  const transcript = lines.map(l=>`[${l.channel || 'demo'}] ${l.who}: ${l.text}`).join('\n');
  const appointments = (event.bookings || []).map(b=>`${b.status}: ${b.selected || b.choices.join(' | ')} (${b.service})`).join('\n');
  const callbacks = (event.callbacks || []).map(c=>`${c.service}; ${c.urgency}; ${c.reason}; ${c.phone}`).join('\n');
  const summary = `Intent: ${classification.intent}\nUrgency: ${classification.urgency}\nRoute: ${classification.route}\nNext action: ${classification.next}\nOpening scenario: ${event.afterHours?'After hours':'During opening hours'}\nTimezone: ${lead.timezone}`;
  let detail = `${summary}\n\nCustomer questions:\n${questions || 'No customer questions recorded.'}`;
  if (['booking','reschedule','cancel','reminder'].includes(kind)) detail = `Service: ${event.service}\nTime: ${event.selected}\nTimezone: ${lead.timezone}\nStatus: ${kind==='cancel'?'Cancelled in this demo':'Confirmed in this demo'}\n\n${kind==='reminder'?'Illustration of a reminder; no automatic reminder was scheduled.':'No real calendar availability was checked. This is a simulated booking.'}`;
  if (kind==='choices') detail = `Service: ${event.service}\nPreferred times:\n${event.choices.map((v,i)=>`${'ABC'[i]}: ${v}`).join('\n')}\nTimezone: ${lead.timezone}\nNext action: the business owner selects A, B or C in the Owner view.`;
  if (kind==='callback') detail = `Service: ${event.service}\nUrgency: ${event.urgency}\nCallback number: ${event.phone}\nReason: ${event.reason}\nRoute: ${event.urgency==='Urgent'?'Urgent dental team':event.afterHours?'Reception at next opening':'Reception'}\nNo phone call was placed.`;
  if (kind==='demo') detail += `\n\nBooking history:\n${appointments || 'None'}\n\nCallback history:\n${callbacks || 'None'}\n\nEmail event history:\n${event.emailHistory || 'None'}`;
  if (['text','voice','demo'].includes(kind)) detail += `\n\nConversation record:\n${transcript || 'No conversation recorded.'}`;
  const subject = `${titles[kind]} · ${lead.business}`;
  const footer = '\n\nAileen sales demonstration. Booking/calendar/reminder actions are illustrative. No real appointment, call, CRM entry or clinical advice is provided. Emails are real; session data is kept only in this browser until reset.';
  return [
    {role:'business',to:lead.email,subject,body:`Business-owner copy\n${lead.business}\nContact: ${lead.name}\nCustomer email: ${lead.customerEmail}\nPhone: ${lead.phone}\n\n${detail}${footer}`},
    {role:'customer',to:lead.customerEmail,subject,body:`Hello ${lead.name},\n\nHere is your ${titles[kind].toLowerCase()} for ${lead.business}.\n\n${detail}${footer}`},
    {role:'provider',to:observer,subject,body:`Demo-provider copy\nBusiness: ${lead.business}\nBusiness contact: ${lead.email}\nCustomer role: ${lead.customerEmail}\n\n${detail}${footer}`}
  ];
}
