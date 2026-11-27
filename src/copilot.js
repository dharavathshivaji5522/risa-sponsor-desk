const training = {
  collection: [
    "amount cash received deposited collected payments bank receipts take money funded",
    "how much sponsorship cash have we got so far amount paid",
    "are we on track cash forecast expected projected goal target gap",
    "estimate the outstanding collection deadline sponsorship cash"
  ],
  funnel: [
    "where pipeline leaking bottleneck conversions drop stage stages funnel",
    "how many prospects conversations proposals signed meetings outreach attempts",
    "count number distinct brands replied unique response qualification leads",
    "diagnose problem falling conversion which stage loses the most"
  ],
  rank: [
    "which campaign best worst top strongest weakest channel outperform performance",
    "what should we prioritize stop scale change next recommendation",
    "which channels contributed biggest largest highest cash and compare",
    "where invest assign budget leading signals decisions"
  ],
  historical: [
    "original dataset history historical from sheet evidence workbook recorded as of before event",
    "what happened to Beardo sponsor opportunity qualification partner deal",
    "show past historic signed confirmed amounts engagement old result data",
    "qualification status and latest stage opportunity at cutoff original source"
  ],
  activation: [
    "activation visitor attendance alumni creator partner ticket check-in footfall admitted",
    "attendee linked campaign link sponsors activation incremental impact uplift attribution",
    "how many verified unique external people showed up"
  ],
  budget: [
    "budget spending expenses cost utilisation over unspent remaining",
    "cost per campaign paid cost per proposal financial efficiency roi"
  ],
  tasks: [
    "create draft add assign task for team to follow up action owner due deadline",
    "who is doing open pending tasks overdue completed action item"
  ]
};

function words(input) { return input.toLowerCase().match(/[a-z0-9]+/g) || []; }
function trainCorpus(samples) {
  const vocabulary = new Set();
  const models = Object.entries(samples).map(([intent,examples]) => {
    const counts = new Map();
    const tokens = examples.flatMap(words);
    for (const token of tokens) { vocabulary.add(token); counts.set(token,(counts.get(token) || 0) + 1); }
    return {intent,counts,count:tokens.length};
  });
  return {vocabulary,models};
}
const model = trainCorpus(training);

function classify(input) {
  const tokens = words(input).filter(token=>model.vocabulary.has(token));
  if (!tokens.length) return null;
  return model.models.map(row=>({intent:row.intent,score:tokens.reduce((n,token)=>
    n + Math.log(((row.counts.get(token)||0)+1)/(row.count+model.vocabulary.size)),0)}))
    .sort((a,b)=>b.score-a.score)[0].intent;
}

const months = Object.fromEntries(["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].map((m,i)=>[m,String(i+1).padStart(2,"0")]));
function parseDates(q) {
  const matches = [...q.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/gi)].map(m=>m[1]);
  for (const m of q.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:[ ,]+(20\d{2}))?/gi)) {
    matches.push(`${m[3] || "2025"}-${months[m[1].slice(0,3).toLowerCase()]}-${m[2].padStart(2,"0")}`);
  }
  for (const m of q.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?[ -]+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:[ ,]+(20\d{2}))?/gi)) {
    matches.push(`${m[3] || "2025"}-${months[m[2].slice(0,3).toLowerCase()]}-${m[1].padStart(2,"0")}`);
  }
  return [...new Set(matches)];
}

const operatingSource = "Workspace · simulated campaign records";
const formatDate = raw => raw.slice(0,10);
const stageNames = {prospecting:"Prospecting",contacted:"Contacted",proposal_sent:"Proposal sent",negotiating:"Negotiating",partner_confirmed:"Partner confirmed",lost:"Lost",withdrawn:"Withdrawn"};
const has = (q,re) => re.test(q);

function brandMatches(q) {
  const lower = q.toLowerCase();
  const key = lower.match(/\ba\d{3}\b/g) || [];
  const items = DATA.sponsor.Brands.filter(b => key.includes(b.brand_id.toLowerCase()) || lower.includes(b.brand_name.toLowerCase()));
  return items;
}

const aliases = {
  creator:/creator|sc05/, warm:/warm|alumni|sc02/, inbound:/inbound|triage|interest form|sc04/,
  revival:/revival|dormant|sc06/, cold:/cold|discovery email|sc01/
};

function historicalAnswer(q, date, cid, brandId, dates) {
  const s = getHistorySnapshot(date,{campaign:cid,brand:brandId});
  const selected = [s.brand,s.campaign].filter(Boolean).join(" / ") || "All sponsors";
  const label = `Sponsorship workbook · ${date} EOD IST`;
  const refs = [{label,url:DATA.links.sponsorship}];
  if (has(q,/\b(roi|cac|budget|spend|cost|receipt|deposited|cash (?:(?:was|has been|had been) )?(collected|received|paid)|paid in|payment date|payments were|payment received|bank|actual receipts)\b/)) {
    return {answer:`The historical workbook records ${lakhs(s.signedValue)} in confirmed cash agreements for ${selected} by ${date}. It provides no bank receipts, cash collection totals, payment dates, or campaign spend. Collection and spend shown in the workspace are simulated.`,refs};
  }
  if (dates.length >= 2) {
    const [start,end] = dates.slice(0,2).sort();
    const earlier = getHistorySnapshot(start,{campaign:cid,brand:brandId}), later = getHistorySnapshot(end,{campaign:cid,brand:brandId});
    return {answer:`${selected}, ${start} vs ${end} (day end). Qualified brands: ${earlier.qualified} vs ${later.qualified}. Confirmed deals: ${earlier.signed} vs ${later.signed}. Confirmed cash value: ${lakhs(earlier.signedValue)} vs ${lakhs(later.signedValue)} (${inr(later.signedValue-earlier.signedValue)} change).`,refs};
  }
  if (has(q,/activation|check.?in|attend|footfall|visitor|uplift|attribut/)) {
    const links = s.activations.map(a=>`${a.brand} linked to ${a.name} (${a.id}), with ${attendance(a.id,date)} unique verified external visitors associated with that campaign by this date.`);
    return {answer:links.length?`${links.join("\n")}\nThe activation links establish association. The sheets lack a control group or baseline for estimating sponsor-caused incremental visits.`:`No confirmed linked activation matches this scope by ${date}. The attendee workbook counts verified admissions on festival dates.`,
      refs:[...refs,{label:"Attendee workbook · verified external check-ins",url:DATA.links.attendee}]};
  }
  if (brandId || has(q,/\bo\d{3}\b/)) {
    const target = q.match(/\bo\d{3}\b/i)?.[0].toUpperCase();
    const deals = s.deals.filter(d=>!target||d.id===target);
    const qualification = s.qualification[0];
    if (!deals.length && !qualification) return {answer:`No eligible source record was available for ${target || selected} at ${date}.`,refs};
    const lines = deals.slice(0,5).map(d=>`${d.id} ${d.brand}: ${stageNames[d.stage]} (${d.support==="cash"?"cash":"in-kind"}), ${inr(d.value)} confirmed, ${inr(d.proposed)} proposed. Updated ${formatDate(d.asOf)}.`);
    return {answer:`${selected} · ${date}. ${qualification ? `Qualification: ${qualification.status}. ${qualification.reason} `:""}${lines.length?"\n"+lines.join("\n"):"No opportunity state yet."}`,refs};
  }
  if (has(q,/which|rank|top|best|highest|most|strongest|largest/) && !cid && !brandId) {
    const metrics = has(q,/outreach|attempt|sent/) ? "outreach" : has(q,/qualif/) ? "qualified" : has(q,/reply|replies/) ? "replyBrands" : has(q,/convers|engag/) ? "conversations" : "signedValue";
    const rows = DATA.sponsor["Sponsor campaigns"].map(c=>getHistorySnapshot(date,{campaign:c.sponsor_campaign_id})).sort((a,b)=>b[metrics]-a[metrics]);
    return {answer:`Top historical campaigns by ${{outreach:"outreach attempts",qualified:"latest qualified brands",replyBrands:"replying brands",conversations:"engaged brands",signedValue:"confirmed cash value"}[metrics]} at ${date}.\n${rows.slice(0,3).map(r=>`${r.campaign}: ${metrics==="signedValue"?lakhs(r[metrics]):r[metrics]}`).join("\n")}\nCampaign association is observational. Brands may appear in more than one campaign.`,refs};
  }
  if (has(q,/rate|percent|conversion|ratio/)) {
    return {answer:`${selected} at ${date}. Positive-reply share is ${pct(rate(s.positive,s.replies))} (${s.positive}/${s.replies} reply events). ${pct(rate(s.cashDeals,s.signed))} of confirmed opportunities are cash (${s.cashDeals}/${s.signed}). ${s.proposals ? `${pct(rate(s.signed,s.proposals))} of opportunities that ever reached proposal are currently confirmed.`:"No proposal-stage opportunity is available for a deal conversion."}`,refs};
  }
  if (has(q,/target|goal|vs plan/)) return {answer:s.goals ? `${s.goals.target_version} is in effect. ${s.qualified} qualified brands vs a goal of ${s.goals.qualified_brands_goal}. ${s.signed} confirmed partnerships vs a goal of ${s.goals.confirmed_partnerships_goal}. These goals cover the overall source program.`:"No historical target was effective on that date.",refs};
  return {answer:`${selected} through ${date}. ${s.brands} brand records, ${s.outreach} distinct outreach attempts to ${s.contacted} brands, ${s.replyBrands} replying brands, ${s.positiveBrands} positive-reply brands, ${s.conversations} brands with engagement, and ${s.meetings} held meetings.\n${s.qualified} brands had latest status qualified. ${s.proposals} opportunities reached a proposal stage and ${s.signed} were currently confirmed. ${s.cashDeals} cash deals totalled ${lakhs(s.signedValue)} in confirmed value. In-kind value was ${lakhs(s.inKind)}.`,refs};
}

function answerQuestion(input,state) {
  const question = input.q;
  const q = question.toLowerCase();
  const mode = input.mode === "stretch" ? "stretch" : "base";
  const dates = parseDates(question);
  if (has(q,/before (the )?(festival|fest|event)|pre.fest/)&&!dates.length) dates.push(historyDate);
  const board = overview(state,mode);
  const brand = brandMatches(question)[0];
  const namedHistorical = DATA.sponsor["Sponsor campaigns"].find(c=>q.includes(c.campaign_name.toLowerCase()) || q.includes(c.sponsor_campaign_id.toLowerCase()));
  const requested = board.details.filter(row=>aliases[row.id].test(q));
  const context = input.context || {};
  const explicitLive = has(q,/workspace|current (campaign|workspace|simulation)|simulation|simulated|live (desk|plan|dashboard)|today's plan/);
  const followup = has(q,/^(and|what about|what if|how about|then)\b|\b(it|that campaign|same campaign|same brand|same date|that date|those deals)\b/);
  const explicitHistory = input.scope === "history" || has(q,/histor|original|dataset|workbook|source sheet/) || brand || namedHistorical ||
    has(q,/opportunity o\d{3}|activat|check.?in|attendee/);
  const historical = !explicitLive && (explicitHistory || dates.length > 0 || (followup && context.scope === "history"));
  const date = dates[0] || input.date || (followup && context.date) || historyDate;
  const historyCid = namedHistorical?.sponsor_campaign_id || requested[0]?.source || (followup && context.scope === "history" ? context.campaign : undefined);
  const brandId = brand?.brand_id || (followup && context.scope === "history" && !namedHistorical ? context.brand : undefined);
  const cls = classify(q);
  if (has(q,/weather|rain|hotel|cricket score|phone number|mobile number|personal email|personal address|bank account|stock price|insurance|who is the ceo|who founded|instagram followers|profit margin/)) {
    return {answer:"This workspace has insufficient evidence to answer that. It covers sponsor acquisition, commitments, simulated cash and spend, and linked festival check-ins.",refs:[]};
  }
  if (has(q,/\b(generat|caus|why did|attribut|uplift|incremental impact)\w*\b/) && has(q,/attend|visitor|footfall|ticket|activat/)) {
    return {...historicalAnswer(q,date,historyCid,brandId,dates),context:{scope:"history",date,campaign:historyCid,brand:brandId}};
  }
  if (historical && !(has(q,/create|draft|add|assign/) && has(q,/task|action|follow.?up/))) {
    if (!/^2025-\d\d-\d\d$/.test(date) || [date,...dates].some(d=>d<"2025-01-15"||d>"2025-04-20"||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)) {
      return {answer:"The workbook covers January 15 through April 20, 2025 in Asia/Kolkata. Select a date in that range.",refs:[]};
    }
    return {...historicalAnswer(q,date,historyCid,brandId,dates),context:{scope:"history",date,campaign:historyCid,brand:brandId}};
  }
  let selected = requested[0] || (followup ? board.details.find(r=>r.id===context.campaign) : undefined);
  const refs = [{label:operatingSource}];
  const ctx = x => ({scope:"live",campaign:x?.id,mode});
  const sorted = [...board.details].sort((a,b)=>b.gap-a.gap);
  const weakest = sorted[0];
  if (has(q,/\b(create|draft|add|assign|turn)\b/) && has(q,/\b(task|action|follow.?up)\b/)) {
    selected ||= context.scope === "history" ? board.details.find(r=>r.source===context.campaign) : null;
    selected ||= weakest;
    const target = selected.decision === "Scale" ? `Review and scale ${selected.short}` : `Review ${selected.short.toLowerCase()} and fix the next step`;
    const due = q.match(/\b20\d\d-\d\d-\d\d\b/)?.[0] || "2025-03-29";
    return {answer:`I drafted a task for ${selected.name}. Its latest signal is ${pct(selected.actual.signal)} across ${selected.actual.sample} records. Suggested action: ${selected.next} Confirm below to save it.`,refs,
      draft:{title:target,campaign:selected.id,owner:selected.owner,due,status:"To do",note:selected.next},context:ctx(selected)};
  }
  if ((cls === "tasks" && !has(q,/recommend|prioriti|suggest/)) || has(q,/open tasks|who owns|task list|overdue tasks/)) {
    const list = state.tasks.filter(t=>(!selected||t.campaign===selected.id)&&(!has(q,/open|pending|overdue/)||t.status!=="Done")&&(!has(q,/overdue/)||t.due<PLAN.today));
    return {answer:list.length ? list.slice(0,6).map(t=>`${t.title} — ${t.owner}, due ${t.due}, ${t.status}.`).join("\n") : "There are no saved tasks matching that scope.",refs,context:ctx(selected)};
  }
  if (requested.length > 1 || has(q,/compare| versus | vs /)) {
    const rows = requested.length > 1 ? requested : selected ? [selected,...board.details.filter(r=>r.id!==selected.id).slice(0,2)] : board.details;
    return {answer:rows.map(r=>`${r.name}: ${lakhs(r.actual.cash)} collected, ${lakhs(r.projection)} projected vs ${lakhs(r.plan.cash)} target, ${pct(rate(r.actual.signed,r.actual.proposals))} proposal-to-sign, ${r.decision.toLowerCase()}.`).join("\n"),refs,context:ctx(rows[0])};
  }
  if (has(q,/what if|suppose|scenario|sensitivity/) && q.match(/(\d+(?:\.\d+)?)\s*%/) && has(q,/collect|realiz|payment/)) {
    const ratio = Number(q.match(/(\d+(?:\.\d+)?)\s*%/)[1]) / 100;
    if (ratio > 1) return {answer:"Use an on-time collection assumption between 0% and 100%.",refs,context:ctx(selected)};
    const rows = selected ? [selected] : board.details;
    const estimated = sum(rows,r=>r.actual.cash+(r.plan.collect>0?(r.projection-r.actual.cash)/r.plan.collect:0)*ratio);
    return {answer:`At ${pct(ratio*100)} collection on remaining signed and projected value, ${selected?.name || "the workspace"} projects ${lakhs(estimated)}. Current forecast is ${lakhs(sum(rows,"projection"))}. Payments already logged are held constant. This is a scenario estimate.`,refs,context:ctx(selected)};
  }
  if (cls === "budget" || has(q,/budget|spend|spent|\broi\b|\bcost\b/)) {
    const rows = selected ? [selected] : board.details;
    const budget = sum(rows,"budget"), spent = sum(rows,r=>r.actual.spend), cash = sum(rows,r=>r.actual.cash);
    return {answer:`${selected?.name || "Workspace"} has spent ${inr(spent)} of ${inr(budget)} (${pct(rate(spent,budget))}). Remaining budget is ${inr(budget-spent)}. Simulated cash collected per rupee spent: ${spent?(cash/spent).toFixed(2)+"×":"unavailable at zero spend"}. This ratio excludes festival operating costs.`,refs,context:ctx(selected)};
  }
  if (has(q,/recommend|prioriti|scale|stop|weakest|best|underperform|biggest gap|what should|behind|risk|bottleneck/) || cls === "rank") {
    const needsAction = has(q,/weakest|underperform|gap|behind|risk|bottleneck/);
    const decisionAsked = has(q,/\bstop\b|pause/) ? "Stop" : has(q,/\bscale\b|double down/) ? "Scale" : has(q,/\bchange\b|revise/) ? "Change" : null;
    const byPriority = [...board.details].sort((a,b)=>b.plan.priority-a.plan.priority);
    const match = decisionAsked && byPriority.find(r=>r.decision===decisionAsked);
    if (!selected && decisionAsked && !match && !needsAction) return {answer:`No campaign currently meets the ${decisionAsked.toLowerCase()} threshold. Check the campaign signals and their observation counts.`,refs,context:ctx()};
    const top = selected || (needsAction ? weakest : match || byPriority[0]);
    const a = top.actual;
    const verdict = a.sample < top.min ? `Collect at least ${top.min} observations before a decision.` : `Decision: ${top.decision.toLowerCase()}.`;
    return {answer:`${top.name}. ${top.metric} is ${pct(a.signal)} across ${a.sample} observations. Scale at ${top.scale}% or above, change at ${top.change}% to below ${top.scale}%, and stop below ${top.change}%. ${verdict}\n${lakhs(a.cash)} collected. Forecast ${lakhs(top.projection)} against ${lakhs(top.plan.cash)}. ${top.gap ? `Gap: ${lakhs(top.gap)}. ` : ""}Proposal-to-sign is ${pct(rate(a.signed,a.proposals))}. ${top.next}`,refs,context:ctx(top)};
  }
  if (cls === "funnel" || has(q,/proposal|prospect|conversion|funnel|signed/)) {
    const a = selected?.actual || board.totals;
    const counts = [a.prospects,a.conversations,a.proposals,a.signed,a.paid];
    const transitions = counts.slice(1).map((n,i)=>({name:`${stageLabels[i]} to ${stageLabels[i+1]}`,rate:rate(n,counts[i])})).filter(x=>x.rate!==null);
    const low = transitions.sort((a,b)=>a.rate-b.rate)[0];
    return {answer:`${selected?.name || "Workspace"}: ${counts.map((n,i)=>`${n} ${stageLabels[i].toLowerCase()}`).join(" / ")}. ${low?`Smallest conversion is ${low.name.toLowerCase()} at ${pct(low.rate)}.`:"There is insufficient volume to calculate stage conversions."} Signed value is ${lakhs(a.signedValue)} and cash received is ${lakhs(a.cash)}.`,refs,context:ctx(selected)};
  }
  if (cls === "collection" || has(q,/forecast|cash|target|paid|collected|gap|progress/)) {
    const cash = selected?.actual.cash ?? board.totals.cash;
    const signed = selected?.actual.signedValue ?? board.totals.signedValue;
    const prediction = selected?.projection ?? board.projection;
    const target = selected?.plan.cash ?? board.target;
    return {answer:`${selected?.name || "Workspace"} has collected ${lakhs(cash)} in simulated receipts on ${lakhs(signed)} in signed cash value. ${mode==="base"?"Base":"Stretch"} target is ${lakhs(target)}, with ${lakhs(prediction)} projected by ${PLAN.deadline}. ${prediction>=target?`Forecast is ${lakhs(prediction-target)} above target.`:`Forecast shortfall is ${lakhs(target-prediction)}.`} Forecast assumes the scenario's proposal-close and on-time payment rates.`,refs,context:ctx(selected)};
  }
  return {answer:"I don't have enough evidence or a clear metric for that question. Try a campaign name, a source date, cash received, a stage conversion, budget, or a task.",refs,context:ctx(selected)};
}
