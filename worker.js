import {buildEmails, VERSION, titles} from './email-templates.js';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recent = new Map(), events = new Map();
const json = (v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const clean = (s,n=1000)=>typeof s==='string'?s.trim().slice(0,n):'';
function validate(data) {
  if (!data || !titles[data.kind] || !/^[a-zA-Z0-9-]{10,100}$/.test(data.id||'')) return 'Invalid email event.';
  const l=data.lead;
  const needsPatient=['booking','choices','callback','reschedule','cancel','reminder'].includes(data.kind);
  if (!l || !clean(l.name,100)||!clean(l.business,160)||!clean(l.phone,40)||!EMAIL.test(l.email||'')||(l.customerEmail&&!EMAIL.test(l.customerEmail))||(needsPatient&&!EMAIL.test(l.customerEmail||''))||l.consent!==true) return 'Enter clinic contact details, patient email for patient-facing events, and consent.';
  if ([l.name,l.business,l.email,l.phone,l.timezone].some(v=>typeof v!=='string'||v.length>254)||l.customerEmail!=null&&(typeof l.customerEmail!=='string'||l.customerEmail.length>254)) return 'Invalid contact information.';
  try {new Intl.DateTimeFormat('en',{timeZone:l.timezone});} catch {return 'Select a valid timezone.';}
  if (!Array.isArray(data.lines)||data.lines.length>600||data.lines.some(l=>!['Customer','Aileen','System'].includes(l.who)||typeof l.text!=='string'||l.text.length>2000||!['text','voice','demo'].includes(l.channel))) return 'Conversation is too large or invalid.';
  if (!Array.isArray(data.bookings)||data.bookings.length>50||data.bookings.some(b=>!b||!Array.isArray(b.choices)||b.choices.some(v=>typeof v!=='string')||typeof b.status!=='string'||typeof b.service!=='string')) return 'Invalid booking history.';
  if (!Array.isArray(data.callbacks)||data.callbacks.length>50||data.callbacks.some(c=>!c||['service','urgency','reason','phone'].some(k=>typeof c[k]!=='string'))) return 'Invalid callback history.';
  const slots=data.kind==='choices'?data.choices:['booking','reschedule','reminder','cancel'].includes(data.kind)?[data.selected]:[];
  if (!Array.isArray(slots)||data.kind==='choices'&&(slots.length!==3||new Set(slots).size!==3)) return 'Provide three distinct preferred times.';
  for(const slot of slots){
    if(typeof slot!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot)) return 'Use a valid date and time.';
    const hours=l.clinicHours||{open:'09:00',close:'17:00',step:30};
    if(!/^\d{2}:\d{2}$/.test(hours.open||'')||!/^\d{2}:\d{2}$/.test(hours.close||''))return 'Clinic hours are invalid.';
    const mins=Number(slot.slice(11,13))*60+Number(slot.slice(14,16)),start=Number(hours.open.slice(0,2))*60+Number(hours.open.slice(3)),end=Number(hours.close.slice(0,2))*60+Number(hours.close.slice(3)),step=Number(hours.step||30);
    if(start>=end||mins<start||mins>=end||![15,30,60].includes(step)||(mins-start)%step!==0)return 'Choose a time within the clinic’s configured hours and appointment interval.';
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
 if(request.method==='GET'&&url.pathname==='/api/health')return json({version:VERSION,emailConfigured:configured,callbackConfigured:Boolean(env.VAPI_API_KEY&&env.VAPI_ASSISTANT_ID&&env.VAPI_PHONE_NUMBER_ID),observerEmail:env.DEMO_OBSERVER_EMAIL||''});
 if(request.method!=='POST'||!['/api/email','/api/callback'].includes(url.pathname))return json({error:'Not found'},404);
 if(request.headers.get('origin')!==url.origin)return json({error:'Same-origin request required.'},403);
 const raw=await request.text();if(raw.length>160000)return json({error:'This demo session is too large. End shorter conversations separately.'},413);
 let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 if(url.pathname==='/api/callback'){
  if(!env.VAPI_API_KEY||!env.VAPI_ASSISTANT_ID||!env.VAPI_PHONE_NUMBER_ID)return json({error:'The supplied Aileen callback tool is not configured for this demo environment.'},503);
  if(!/^\+[1-9]\d{7,14}$/.test(data.phone||''))return json({error:'Enter the patient phone in international format.'},400);
  if(!data.lead||data.lead.consent!==true||!clean(data.lead.business,160)||!clean(data.lead.website||'',500))return json({error:'Clinic context or demo-email consent is missing.'},400);
  const call=await fetch('https://api.vapi.ai/call',{method:'POST',headers:{authorization:`Bearer ${env.VAPI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({assistantId:env.VAPI_ASSISTANT_ID,phoneNumberId:env.VAPI_PHONE_NUMBER_ID,customer:{number:data.phone},assistantOverrides:{variableValues:{clinic_name:data.lead.business,official_website:data.lead.website||'',scenario:data.lead.scenario||'open'}}}),signal:AbortSignal.timeout(20000)});
  if(!call.ok)return json({error:'The supplied callback tool could not initiate the Aileen call. Check the demo Vapi assistant and number.'},502);
  const callData=await call.json().catch(()=>({}));return json({requested:true,callId:callData.id||null});
 }
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
