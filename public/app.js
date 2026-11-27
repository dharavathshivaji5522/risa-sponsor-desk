"use strict";
const $ = s=>document.querySelector(s);
const ico = name=>`<svg class="ico" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const e = value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const numeric = n=>n.toLocaleString("en-IN");
const slug = s=>s.toLowerCase().replaceAll(" ","-");
const status = s=>`<span class="tag ${slug(s)}"><i class="dot"></i>${e(s)}</span>`;
const prettyDate = s=>new Date(s+"T12:00:00+05:30").toLocaleDateString("en-IN",{month:"short",day:"numeric",timeZone:"Asia/Kolkata"});
const opts = (rows,value)=>rows.map(([id,name])=>`<option value="${e(id)}" ${id===value?"selected":""}>${e(name)}</option>`).join("");
const backend = new Worker(new URL("./workspace-worker.js",document.baseURI));
let requestID = 0;
const requests = new Map();
backend.addEventListener("message",({data})=>{
  const pending = requests.get(data.id);
  if(!pending) return;
  clearTimeout(pending.timer);
  requests.delete(data.id);
  if(data.error) pending.reject(new Error(data.error));
  else pending.resolve(data.result);
});
backend.addEventListener("error",()=>{
  for(const {reject,timer} of requests.values()){
    clearTimeout(timer);
    reject(new Error("The local workspace engine could not load. Reload the page and retry."));
  }
  requests.clear();
});
const api = (path,input)=>new Promise((resolve,reject)=>{
  const id=++requestID;
  const timer=setTimeout(()=>{
    requests.delete(id);
    reject(new Error("The local workspace took too long to respond. Please retry."));
  },15000);
  requests.set(id,{resolve,reject,timer});
  backend.postMessage({id,method:input===undefined?"GET":"POST",path,input});
});

let state=null, revision=0, mode="base", view="dashboard";
let historyOptions={date:historyDate,campaign:"",brand:""};
let historyPayload=null, historyRequest=0;
let filterTasks="All", askContext={}, pendingAsk=false, toastTimer;
let drafts=new Map();
const views=new Set(["dashboard","campaigns","tasks","history"]);
try {
  const url = new URL(window.location.href);
  const preferred = url.searchParams.get("view");
  if(views.has(preferred)) view=preferred;
  if(url.searchParams.get("case")==="stretch") mode="stretch";
}catch{}
function toast(message){
  const box=$("#toast");box.textContent=message;box.hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{box.hidden=true},3700);
}
function showError(message){
  const box=$("#status-error");box.querySelector("span").textContent=message;box.hidden=!message;
}

function card(title,value,note,icon) {
  return `<article class="kpi"><span class="kpi-label">${ico(icon)} ${title}</span><strong>${value}</strong><small>${note}</small></article>`;
}
function section(title,description,actions=""){
  return `<div class="section-head"><div><h2>${title}</h2><p>${description}</p></div>${actions}</div>`;
}
function modeToggle(){
  return `<div class="segments" role="group" aria-label="Planning scenario">
    <button data-mode="base" aria-pressed="${mode==="base"}">Base</button>
    <button data-mode="stretch" aria-pressed="${mode==="stretch"}">Stretch</button></div>`;
}
function bars(rows) {
  const largest=Math.max(1,...rows.map(row=>row.projection));
  return rows.map(r=>`<div class="channel-line"><span>${e(r.short)}</span><span class="bar-track"><i class="bar-fill ${r.tone}" style="width:${Math.round(100*r.projection/largest)}%"></i></span><strong>${lakhs(r.projection)}</strong></div>`).join("");
}
function dashboard(b){
  const t=b.totals, gap=b.target-b.projection;
  const stageKeys=["prospects","conversations","proposals","signed","paid"];
  const counts=stageKeys.map(k=>t[k]);
  const minRate=counts.slice(1).map((n,i)=>({idx:i,ratio:rate(n,counts[i])})).filter(x=>x.ratio!==null).sort((a,b)=>a.ratio-b.ratio)[0];
  return `${section("Cash performance","Simulated cash and campaign activity as of 27 Mar 2025",modeToggle())}
  <div class="kpis">
  ${card("Cash collected",lakhs(t.cash),`${t.paid} deals with receipts`,"wallet")}
  ${card("On-time forecast",lakhs(b.projection),`${lakhs(b.target)} scenario target`,"chart")}
  ${card(gap>0?"Forecast gap":"Forecast surplus",lakhs(Math.abs(gap)),gap>0?"To reach the target":"Above the target","target")}
  ${card("Acquisition spend",inr(t.spend),`${inr(b.budget)} budget`,"brief")}
  </div>
  <div class="dashboard-panels">
    <section class="surface">
      <div class="panel-head"><h3>Sponsor funnel</h3><span class="muted">${lakhs(t.signedValue)} signed</span></div>
      <div class="funnel">${counts.map((n,i)=>`<div class="funnel-row"><span class="funnel-bar" style="width:${counts[0]?n*100/counts[0]:0}%"></span><span>${stageLabels[i]}</span><b>${numeric(n)}</b></div>`).join("")}</div>
      <p class="funnel-note">${minRate?`Lowest conversion · ${stageLabels[minRate.idx]} to ${stageLabels[minRate.idx+1].toLowerCase()} (${pct(minRate.ratio)})`:"Need campaign data to calculate conversions."}</p>
    </section>
    <section class="surface">
      <div class="panel-head"><h3>Forecast by campaign</h3><span class="muted">Pre-festival cash</span></div>
      <div class="channel-bars">${bars([...b.details].sort((a,b)=>b.projection-a.projection))}</div>
      <p class="funnel-note">Forecast uses saved funnel counts, proposal pace, payment rates, and decision thresholds.</p>
    </section>
  </div>
  <section class="surface wide-panel">
    <div class="panel-head"><h3>Campaign decisions</h3><button type="button" class="btn secondary small" data-view="campaigns">Manage campaigns</button></div>
    <div class="table-wrap"><table class="table dash-table"><thead><tr><th>Campaign</th><th>Collected</th><th>Forecast / target</th><th>Decision</th></tr></thead><tbody>
    ${b.details.map(r=>`<tr><td><strong>${e(r.short)}</strong><small>${e(r.owner)}</small></td><td class="nowrap">${lakhs(r.actual.cash)}</td><td class="nowrap">${lakhs(r.projection)} / ${lakhs(r.plan.cash)}</td><td>${status(r.decision)}</td></tr>`).join("")}
    </tbody></table></div>
  </section>`;
}

function campaigns(b){
  return `${section("Campaigns","Edit current figures and see the forecast update.",modeToggle())}<div class="campaign-grid">
    ${b.details.map(r=>`<article class="surface campaign">
      <div class="panel-head"><div><h3>${e(r.name)}</h3><p class="muted">${e(r.owner)} · ${e(r.window)}</p></div>${status(r.decision)}</div>
      <p class="muted">${e(r.offer)}</p>
      <div class="campaign-data"><div><span>Simulated cash</span><strong>${lakhs(r.actual.cash)}</strong></div><div><span>Scenario target</span><strong>${lakhs(r.plan.cash)}</strong></div><div><span>Forecast</span><strong>${lakhs(r.projection)}</strong></div><div><span>Spent / budget</span><strong>${inr(r.actual.spend)} / ${inr(r.budget)}</strong></div></div>
      <span class="bar-track"><i class="bar-fill ${r.tone}" style="width:${Math.min(100,Math.round(100*r.actual.cash/r.plan.cash))}%"></i></span>
      <p class="muted">${e(r.metric)} · <strong>${pct(r.actual.signal)}</strong> (n = ${r.actual.sample})</p>
      <p class="muted">Scale ≥ ${r.scale}% · Change ≥ ${r.change}% · Min. n = ${r.min}</p>
      <div class="row"><span class="muted">Priority ${r.plan.priority.toFixed(2)} / 5</span><button type="button" class="btn secondary small" data-campaign="${r.id}">${ico("edit")} Edit figures</button></div>
    </article>`).join("")}</div>`;
}
function tasks(){
  const selected=state.tasks.filter(t=>filterTasks==="All"||filterTasks==="Open"&&t.status!=="Done"||filterTasks==="Done"&&t.status==="Done");
  return `${section("Tasks","Campaign follow-ups, owners and deadlines.",`<button data-new-task class="btn primary small">${ico("add")} New task</button>`)}
  <div class="segments" role="group" aria-label="Task status filter">${["All","Open","Done"].map(k=>`<button data-task-filter="${k}" aria-pressed="${k===filterTasks}">${k}</button>`).join("")}</div>
  <div class="task-list" style="margin-top:10px">${selected.length?selected.map(t=>`<article class="surface task-item"><div><h3>${e(t.title)}</h3><p class="muted">${e(PLAN.campaigns.find(c=>c.id===t.campaign)?.short)} · ${e(t.owner)} · Due ${prettyDate(t.due)}</p>${t.note?`<p class="muted">${e(t.note)}</p>`:""}</div><div class="row">${status(t.status)}<button class="icon-btn" data-task="${e(t.id)}" aria-label="Edit task">${ico("edit")}</button></div></article>`).join(""):"<p class='loading'>No tasks in this view.</p>"}</div>`;
}

async function fetchHistory(){
  const token=++historyRequest;
  const query=new URLSearchParams(historyOptions);
  try{
    const result=await api("/api/history?"+query);
    if(token!==historyRequest)return;
    historyPayload=result;
    if(view==="history")render();
  }catch(error){if(token===historyRequest)showError(error.message);}
}
const stateStage={prospecting:"Prospecting",contacted:"Contacted",proposal_sent:"Proposal sent",negotiating:"Negotiating",partner_confirmed:"Confirmed",lost:"Lost",withdrawn:"Withdrawn"};
function historyView(){
  if(!historyPayload)return `${section("Sources","Historical sponsorship workbook")}<p class="loading">Loading source tables…</p>`;
  const {snapshot:s,channels,brands,link,activities}=historyPayload;
  const deals=[...s.deals].sort((a,b)=>b.value-a.value);
  return `${section("Sources","Original workbook and as-of records in IST.")}<section class="surface history-panel">
  <div class="source-links"><a class="btn primary small" href="./sponsorship-original.xlsx" download="risa-sponsorship-original.xlsx">${ico("data")} Download original XLSX</a><a class="btn secondary small" href="${e(link)}" target="_blank" rel="noopener">Sponsorship on GitHub</a><a class="btn secondary small" href="./attendee-original.xlsx" download="risa-attendee-original.xlsx">Download attendee XLSX</a></div>
  <p class="muted">Historical cash amounts are confirmed commitments. The workbook has no payment receipts.</p>
  <form id="history-form" class="history-controls" style="margin-top:10px">
    <label>As of date<input name="date" type="date" min="2025-01-15" max="2025-04-20" value="${e(historyOptions.date)}" required></label>
    <label>Source campaign<select name="campaign">${opts([["","All source campaigns"],...channels.map(x=>[x.id,x.name])],historyOptions.campaign)}</select></label>
    <label>Brand<select name="brand">${opts([["","All brands"],...brands.map(x=>[x.id,x.name])],historyOptions.brand)}</select></label>
    <button class="btn secondary small" type="submit" style="align-self:end">Apply</button>
  </form>
  <div class="kpis">${card("Engaged brands",numeric(s.conversations),`${s.outreach} outreach attempts`,"brief")}
  ${card("Qualified brands",numeric(s.qualified),s.goals?.target_version||"Latest eligible status","target")}
  ${card("Confirmed deals",numeric(s.signed),`${s.cashDeals} cash deals`,"chart")}
  ${card("Cash commitments",lakhs(s.signedValue),`${lakhs(s.inKind)} in-kind`,"wallet")}</div>
  </section>
  <section class="surface history-panel"><div class="panel-head"><h3>Opportunity records</h3><span class="muted">${e(s.date)} EOD</span></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Brand / ID</th><th>Stage</th><th>Type</th><th>Confirmed value</th></tr></thead><tbody>
  ${deals.length?deals.map(d=>`<tr><td><strong>${e(d.brand)}</strong><small>${e(d.id)}</small></td><td>${e(stateStage[d.stage]||d.stage)}</td><td>${d.support==="cash"?"Cash":"In kind"}</td><td class="nowrap">${d.value?inr(d.value):"—"}</td></tr>`).join(""):"<tr><td colspan='4'>No opportunities in this view.</td></tr>"}
  </tbody></table></div></section>
  <section class="surface history-panel"><h3>Linked attendee activations</h3>
  ${activities.length?activities.map(a=>`<p class="muted"><strong>${e(a.brand)}</strong> · ${e(a.name)} · ${a.visitors} unique verified external check-ins by this date.</p>`).join(""):"<p class='muted'>No eligible activations in this view.</p>"}
  <p class="muted">The association does not estimate incremental attendance.</p></section>`;
}

function render(){
  for(const b of document.querySelectorAll("nav [data-view]")) b.setAttribute("aria-current",b.dataset.view===view?"page":"false");
  if(!state)return;
  const b=overview(state,mode);
  const funded=b.totals.cash/b.target;
  $("#hero-progress").textContent=Math.round(funded*100)+"%";
  $("#hero-target").textContent=`${lakhs(b.totals.cash)} of ${lakhs(b.target)}`;
  $("#main-view").innerHTML=view==="dashboard"?dashboard(b):view==="campaigns"?campaigns(b):view==="tasks"?tasks():historyView();
}
async function load(){
  try{const data=await api("/api/workspace");state=data.state;revision=data.revision;showError("");render();if(view==="history"&&!historyPayload)fetchHistory();}
  catch(error){showError(error.message);$("#main-view").innerHTML='<p class="loading">The workspace could not be loaded.</p>';}
}
function navigate(to){
  view=to;
  const url=new URL(window.location.href);
  if(view==="dashboard")url.searchParams.delete("view");else url.searchParams.set("view",view);
  if(mode==="stretch")url.searchParams.set("case","stretch");else url.searchParams.delete("case");
  window.history.replaceState(null,"",url);
  render();if(view==="history"&&!historyPayload)fetchHistory();
}
const controls = [
  ["prospects","Prospects"],["conversations","Conversations"],["proposals","Proposals"],["signed","Signed deals"],
  ["paid","Deals with receipts"],["signedValue","Signed value (INR)"],["cash","Cash received (INR)"],
  ["spend","Acquisition spend (INR)"],["signal","Leading signal (%)"],["sample","Signal observations"]
];
function modalSetup(markup,handler){
  $("#dialog-content").innerHTML=markup;
  $("#editor").showModal();
  $("#edit-form").addEventListener("submit",async ev=>{
    ev.preventDefault();
    const form=ev.currentTarget;
    const button=form.querySelector("button[type=submit]");
    const errors=$("#edit-error");
    button.disabled=true;errors.hidden=true;
    try{await handler(new FormData(form));$("#editor").close();}
    catch(error){errors.textContent=error.message;errors.hidden=false;}
    finally{button.disabled=false;}
  });
}
async function save(data){
  try {
    const result=await api("/api/workspace",{...data,revision});
    state=result.state;revision=result.revision;render();
  }catch(error){
    if(error.message.includes("another tab"))await load();
    throw error;
  }
}
const editFooter = label=>`<p class="error-text" id="edit-error" role="alert" hidden></p><button class="btn primary full" type="submit">${label}</button></form>`;
function editCampaign(id){
  const row=PLAN.campaigns.find(c=>c.id===id);
  if(!row||!state)return;
  const values=state.campaigns[id];
  modalSetup(`<h2 id="edit-title">${e(row.name)}</h2><p>Update the simulation. Separate signed agreements from cash received.</p><form id="edit-form"><div class="fields">
  ${controls.map(([key,label])=>`<label>${label}<input type="number" name="${key}" value="${values[key]}" min="0" step="${key==="signal"?"0.1":"1"}" ${key==="signal"?'max="100"':""} required></label>`).join("")}
  </div>${editFooter("Save campaign figures")}`,async data=>{
    await save({kind:"update-campaign",id,values:Object.fromEntries(controls.map(([key])=>[key,Number(data.get(key))]))});
    toast("Campaign saved. Dashboard and Copilot now use these figures.");
  });
}
function editTask(id,draft){
  if(!state)return;
  const t=id?state.tasks.find(task=>task.id===id):draft||{campaign:PLAN.campaigns[0].id,title:"",owner:"",due:"2025-03-29",status:"To do",note:""};
  if(!t)return;
  modalSetup(`<h2 id="edit-title">${id?"Edit task":draft?"Review Copilot draft":"New task"}</h2><p>${draft?"Confirm the details to add this action to the task list.":"Assign a measurable follow-up to a campaign owner."}</p>
  <form id="edit-form"><div class="fields">
  <label class="wide">Task title<input name="title" value="${e(t.title)}" maxlength="110" required></label>
  <label>Campaign<select name="campaign">${opts(PLAN.campaigns.map(row=>[row.id,row.short]),t.campaign)}</select></label>
  <label>Owner<input name="owner" value="${e(t.owner)}" maxlength="50" required></label>
  <label>Due date<input type="date" name="due" value="${e(t.due)}" required></label>
  <label>Status<select name="status">${opts(["To do","In progress","Done"].map(k=>[k,k]),t.status)}</select></label>
  <label class="wide">Notes<textarea name="note" maxlength="450">${e(t.note)}</textarea></label>
  </div>${editFooter(draft?"Confirm and save task":"Save task")}`,async data=>{
    await save({kind:id?"edit-task":"create-task",task:{...Object.fromEntries(data),id}});
    navigate("tasks");toast("Task saved.");
  });
}

const chat=$("#chat");
const chatGreeting=chat.firstElementChild.textContent;
function appendMessage(message){
  chat.append(message);
  const inset=parseFloat(getComputedStyle(chat).paddingTop);
  const fits=message.offsetHeight<=chat.clientHeight-inset*2;
  chat.scrollTop=fits?chat.scrollHeight:message.offsetTop-inset;
  return message;
}

function bubble(text,kind,refs=[],draft=null){
  const message=document.createElement("div");
  message.className="message is-new "+kind;
  const speaker=document.createElement("span");
  speaker.className="visually-hidden";
  speaker.textContent=kind==="answer"?"Sponsor Desk: ":"You: ";
  message.append(speaker);
  for(const part of text.split(/\n\n+/)){
    const paragraph=document.createElement("p");
    paragraph.textContent=part;
    message.append(paragraph);
  }
  for(const ref of refs){
    const note=document.createElement("small");
    if(ref.url&&ref.url.startsWith("https://github.com/dharavathshivaji5522/risa-sponsor-desk/")){
      const a=document.createElement("a");a.href=ref.url;a.target="_blank";a.rel="noopener";a.textContent=ref.label;note.append(a);
    }else note.textContent=ref.label;
    message.append(note);
  }
  if(draft){
    const key=crypto.randomUUID();drafts.set(key,draft);
    const button=document.createElement("button");button.type="button";button.className="btn secondary small";button.dataset.draft=key;button.textContent="Review task draft";message.append(button);
  }
  return appendMessage(message);
}

function typingBubble(){
  const message=document.createElement("div");
  message.className="message answer typing is-new";
  message.setAttribute("aria-hidden","true");
  for(let i=0;i<3;i++)message.append(document.createElement("span"));
  return appendMessage(message);
}

async function ask(question){
  if(pendingAsk||!question.trim())return;
  pendingAsk=true;
  const button=$("#ask-form button");
  const reset=$("#reset-chat");
  button.disabled=reset.disabled=true;
  bubble(question,"question");
  const loading=typingBubble();
  try {
    const payload={q:question,mode,context:askContext,...(view==="history"&&{scope:"history",date:historyOptions.date})};
    const delay=matchMedia("(prefers-reduced-motion: reduce)").matches?0:220;
    const [response]=await Promise.all([api("/api/ask",payload),new Promise(resolve=>setTimeout(resolve,delay))]);
    if(response.context)askContext=response.context;
    loading.remove();bubble(response.answer,"answer",response.refs,response.draft);
  }catch(err){loading.remove();bubble(err.message,"answer");}
  finally{pendingAsk=false;button.disabled=reset.disabled=false;}
}
document.addEventListener("click",ev=>{
  const button=ev.target.closest("button");
  if(!button)return;
  if(button.dataset.view)navigate(button.dataset.view);
  if(button.dataset.mode){mode=button.dataset.mode;navigate(view);}
  if(button.hasAttribute("data-new-task"))editTask();
  if(button.dataset.task)editTask(button.dataset.task);
  if(button.dataset.campaign)editCampaign(button.dataset.campaign);
  if(button.dataset.taskFilter){filterTasks=button.dataset.taskFilter;render();}
  if(button.dataset.preset){$("#ask-text").value="";ask(button.dataset.preset);}
  if(button.dataset.draft)editTask(null,drafts.get(button.dataset.draft));
});
document.addEventListener("submit",ev=>{
  if(ev.target.id!=="history-form")return;
  ev.preventDefault();
  historyOptions=Object.fromEntries(new FormData(ev.target));
  fetchHistory();
});
$("#retry-workspace").addEventListener("click",()=>{if(state&&view==="history")fetchHistory();else load();});
$("#reset-chat").addEventListener("click",()=>{
  if(pendingAsk)return;chat.replaceChildren();askContext={};drafts.clear();bubble(chatGreeting,"answer");
});
$("#ask-form").addEventListener("submit",ev=>{
  ev.preventDefault();if(pendingAsk)return;const entry=$("#ask-text");const question=entry.value.trim();if(question){entry.value="";ask(question);}
});
load();
