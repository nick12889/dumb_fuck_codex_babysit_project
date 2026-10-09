import {buildEmails, VERSION, titles} from './email-templates.js';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recent = new Map(), events = new Map();
const json = (v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const clean = (s,n=1000)=>typeof s==='string'?s.trim().slice(0,n):'';
function validate(data) {
  if (!data || !titles[data.kind] || !/^[a-zA-Z0-9-]{10,100}$/.test(data.id||'')) return 'Invalid email event.';
  const l=data.lead;
  if (!l || !clean(l.name,100)||!clean(l.business,160)||!clean(l.phone,40)||!EMAIL.test(l.email||'')||!EMAIL.test(l.customerEmail||'')||l.consent!==true) return 'Enter both email addresses, name, business, phone and consent.';
  if ([l.name,l.business,l.email,l.customerEmail,l.phone,l.timezone].some(v=>typeof v!=='string'||v.length>254)) return 'Invalid contact information.';
  try {new Intl.DateTimeFormat('en',{timeZone:l.timezone});} catch {return 'Select a valid timezone.';}
  if (!Array.isArray(data.lines)||data.lines.length>600||data.lines.some(l=>!['Customer','Aileen','System'].includes(l.who)||typeof l.text!=='string'||l.text.length>2000||!['text','voice','demo'].includes(l.channel))) return 'Conversation is too large or invalid.';
  if (!Array.isArray(data.bookings)||data.bookings.length>50||data.bookings.some(b=>!b||!Array.isArray(b.choices)||b.choices.some(v=>typeof v!=='string')||typeof b.status!=='string'||typeof b.service!=='string')) return 'Invalid booking history.';
  if (!Array.isArray(data.callbacks)||data.callbacks.length>50||data.callbacks.some(c=>!c||['service','urgency','reason','phone'].some(k=>typeof c[k]!=='string'))) return 'Invalid callback history.';
  const slots=data.kind==='choices'?data.choices:['booking','reschedule','reminder','cancel'].includes(data.kind)?[data.selected]:[];
  if (!Array.isArray(slots)||data.kind==='choices'&&(slots.length!==3||new Set(slots).size!==3)) return 'Provide three distinct preferred times.';
  for(const slot of slots){
    if(typeof slot!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:1[0-7]:(?:00|30)|18:00)$/.test(slot)) return 'Use half-hour slots from 10:00 to 18:00.';
    const [date]=slot.split('T'); const d=new Date(date+'T12:00:00Z');
    if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==date) return 'Invalid date.';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:l.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const today=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
    if(!['cancel','reminder'].includes(data.kind)&&date<today) return 'Choose today or a future date.';
  }
  if(['callback','booking','choices','reschedule','cancel','reminder'].includes(data.kind)&&!clean(data.service,100))return 'Select a service.';
  if(data.kind==='callback'&&(!clean(data.phone,40)||!['Routine','Urgent'].includes(data.urgency)))return 'Provide callback details.';
  return null;
}
async function send(env,mail,key){
 const r=await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(env.AGENTMAIL_INBOX_ID)}/messages/send`,{method:'POST',headers:{authorization:`Bearer ${env.AGENTMAIL_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({to:mail.to,subject:mail.subject,text:mail.body}),signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>({})); if(!r.ok||!data.message_id)throw new Error('Provider rejected this message.'); return data.message_id;
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 const configured=Boolean(env.AGENTMAIL_API_KEY&&env.AGENTMAIL_INBOX_ID&&EMAIL.test(env.DEMO_OBSERVER_EMAIL||''));
 if(request.method==='GET'&&url.pathname==='/api/health')return json({version:VERSION,emailConfigured:configured,observerEmail:env.DEMO_OBSERVER_EMAIL||''});
 if(request.method!=='POST'||url.pathname!=='/api/email')return json({error:'Not found'},404);
 if(request.headers.get('origin')!==url.origin)return json({error:'Same-origin request required.'},403);
 const raw=await request.text();if(raw.length>160000)return json({error:'This demo session is too large. End shorter conversations separately.'},413);
 let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 if(data.website)return json({error:'Invalid request.'},400);
 const error=validate(data);if(error)return json({error},400);
 if(!configured)return json({error:'The demo email sender needs configuration.'},503);
 const now=Date.now();for(const [k,v]of events)if(now-v.created>3600000)events.delete(k);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';const times=(recent.get(ip)||[]).filter(t=>now-t<3600000);if(times.length>=60)return json({error:'Demo email limit reached. Try again later.'},429);times.push(now);recent.set(ip,times);
 const mails=buildEmails(data,env.DEMO_OBSERVER_EMAIL);
 const key=ip+':'+data.id;const fingerprint=JSON.stringify(mails);let record=events.get(key);
 if(record&&record.fingerprint!==fingerprint)return json({error:'Event changed. Create a new event.'},409);
 if(!record){record={created:now,fingerprint,accepted:{},pending:{}};events.set(key,record);}
 const skipped=new Set(Array.isArray(data.acceptedRoles)?data.acceptedRoles:[]);
 const statuses=await Promise.all(mails.map(async mail=>{
  if(record.accepted[mail.role]||skipped.has(mail.role))return {role:mail.role,to:mail.to,status:'accepted',messageId:record.accepted[mail.role]||null};
  try{
   if(!record.pending[mail.role])record.pending[mail.role]=send(env,mail,key).then(id=>{record.accepted[mail.role]=id;return id;}).finally(()=>delete record.pending[mail.role]);
   const id=await record.pending[mail.role];return {role:mail.role,to:mail.to,status:'accepted',messageId:id};
  }catch{return {role:mail.role,to:mail.to,status:'failed',error:'Not confirmed by the email provider. A timeout can have an uncertain outcome.'};}
 }));
 return json({ok:statuses.every(s=>s.status==='accepted'),statuses});
}};
