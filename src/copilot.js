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

const routingStopWords = new Set("a about am and any are as at be by can could did do does for from got had has have how i in is it its me of on or our so that the then this to was we were what when where which who why will with would you your".split(" "));
const words = input => (input.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(word=>!routingStopWords.has(word));
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
  const tokens = [...new Set(words(input).filter(token=>model.vocabulary.has(token)))];
  if (tokens.length<2) return null;
  const scores = model.models.map(row=>({intent:row.intent,score:tokens.reduce((n,token)=>
    n + Math.log(((row.counts.get(token)||0)+1)/(row.count+model.vocabulary.size)),0)}))
    .sort((a,b)=>b.score-a.score);
  return scores[0].score-scores[1].score>=0.2?scores[0].intent:null;
}

const identityText = "I'm the Sponsor Desk chatbot. I can help you track sponsorship cash, compare campaigns, look up the workbook, and draft follow-up tasks.";
const helpText = "Try asking, “How much have we raised?”, “Which campaign is furthest behind?”, or “What was Beardo’s status on March 15?” You can follow up with “Why?” or ask me to draft a task.";
const scopeText = "I don’t have enough information to answer that. I can help with sponsorship campaigns, cash targets, the festival workbook, or tasks.";

function conversationalAnswer(question) {
  const q = question.replace(/^[\s,!?]+|[\s.!?]+$/g,"").replace(/^(hi|hello|hey)[,!.]?\s+/,"");
  if (/^(?:(?:can|could) you (?:tell me )?)?(who (are you|you are)|what are you|what is your (name|purpose)|what's your name|tell me (about yourself|your name)|introduce yourself|are you (a |the sponsor desk )?(bot|chatbot|ai)|what kind of (bot|assistant) are you)(\s*(please|exactly))?$/.test(q)) return identityText;
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|namaste|how are you)( there| doing)?$/.test(q)) return "Hi! I'm the Sponsor Desk chatbot. What would you like to look into?";
  if (/^(thanks|thank you|thanks a lot|got it|great|okay|ok|perfect)( for your help)?$/.test(q)) return "You’re welcome. Ask me anytime if you want to check another campaign.";
  if (/^(help|what can you do|how (can|could) you help( me)?|how do i use (this|you|the app)|what can i ask( you)?|how does (this|sponsor desk|this app) work|what is sponsor desk|what's sponsor desk)$/.test(q)) return helpText;
  return null;
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
  if (has(q,/how many|count|number of/)) {
    const measures=[
      [/positive repl/,s.positiveBrands,"brands replied positively"],
      [/qualified/,s.qualified,"brands were qualified"],
      [/unique (repl|respond)|replied|responded/,s.replyBrands,"unique brands replied"],
      [/replies|responses/,s.replies,"reply events were recorded"],
      [/meetings/,s.meetings,"meetings were held"],
      [/outreach|attempts/,s.outreach,"distinct outreach attempts were recorded"],
      [/contacted/,s.contacted,"distinct brands received outreach"],
      [/conversations|engaged/,s.conversations,"distinct brands had a recorded conversation"],
      [/propos/,s.proposals,"opportunities reached the proposal stage"],
      [/cash (deals|partners)/,s.cashDeals,"cash deals were confirmed"],
      [/signed|confirmed|partner/,s.signed,"partnerships were confirmed"],
      [/prospects|brands/,s.brands,"brand records were in scope"]
    ];
    const measure=measures.find(([test])=>test.test(q));
    if(measure)return {answer:`By ${date}, ${measure[1]} ${measure[2]}${s.campaign ? ` for ${s.campaign}` : ""}.`,refs};
  }
  if (has(q,/target|goal|vs plan/)) return {answer:s.goals ? `${s.goals.target_version} is in effect. ${s.qualified} qualified brands vs a goal of ${s.goals.qualified_brands_goal}. ${s.signed} confirmed partnerships vs a goal of ${s.goals.confirmed_partnerships_goal}. These goals cover the overall source program.`:"No historical target was effective on that date.",refs};
  return {answer:`${selected} through ${date}. ${s.brands} brand records, ${s.outreach} distinct outreach attempts to ${s.contacted} brands, ${s.replyBrands} replying brands, ${s.positiveBrands} positive-reply brands, ${s.conversations} brands with engagement, and ${s.meetings} held meetings.\n${s.qualified} brands had latest status qualified. ${s.proposals} opportunities reached a proposal stage and ${s.signed} were currently confirmed. ${s.cashDeals} cash deals totalled ${lakhs(s.signedValue)} in confirmed value. In-kind value was ${lakhs(s.inKind)}.`,refs};
}

function answerQuestion(input,state) {
  const question = input.q.trim();
  const q = question.toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ");
  const smallTalk = conversationalAnswer(q);
  if(smallTalk) return {answer:smallTalk,refs:[]};
  if(has(q,/\b(data sources?|where (does|did|do) (your |the )?(data|figures|numbers) come from)\b/)) {
    return {answer:"The assignment supplied two workbooks. The sponsorship workbook tracks outreach and commitments, and the attendee workbook records festival check-ins. The workspace uses a simulation for payments, budgets and forecasts.",refs:[
      {label:"Sponsorship workbook",url:DATA.links.sponsorship},
      {label:"Attendee workbook",url:DATA.links.attendee}
    ]};
  }
  const mode = has(q,/\bstretch (case|scenario|target|goal)\b/) ? "stretch" :
    has(q,/\bbase (case|scenario|target|goal)\b/) ? "base" : input.mode === "stretch" ? "stretch" : "base";
  const dates = parseDates(question);
  const board = overview(state,mode);
  const brand = brandMatches(question)[0];
  const namedHistorical = DATA.sponsor["Sponsor campaigns"].find(c=>q.includes(c.campaign_name.toLowerCase()) || q.includes(c.sponsor_campaign_id.toLowerCase()));
  const requested = board.details.filter(row=>aliases[row.id].test(q));
  const context = input.context || {};
  const explicitLive = has(q,/workspace|current (campaign|workspace|simulation)|simulation|simulated|live (desk|plan|dashboard)|today's plan/);
  const followup = has(q,/^(and|what about|what if|how about|then|why|how so|tell me more)\b|\b(it|that campaign|same campaign|same brand|same date|that date|that number|those deals)\b/);
  const taskDraft = has(q,/\b(create|draft|add|assign|turn)\b/) && has(q,/\b(tasks?|action item|follow.?up)\b/);
  const domain = brand || namedHistorical || requested.length>0 || has(q,/on track|where are we behind/) || has(q,/\b(sponsor\w*|campaign\w*|channel\w*|cash|payments?|receipts?|paid|collect\w*|raise\w*|forecasts?|projected|budget|unspent|spend|spent|costs?|roi|prospects?|proposals?|deals?|conversion\w*|funnel|bottleneck|opportunity|outreach|qualified|activations?|brands?|visitors?|check.?ins?|attendee\w*|tasks?|action items?|follow.?ups?|dataset|histor\w*|workbook|dashboard|funded|targets?|gap|shortfall|pipeline|partner\w*|o\d{3})\b/);
  const scopedFollowup=followup && !!context.scope && (domain || dates.length>0 || has(q,/^(why|how so|tell me more|what about (it|that))\s*[?.!]*$/));
  if (has(q,/\b(weather|rain|hotels?|cricket score|phone numbers?|mobile numbers?|email address|personal emails?|personal address|bank accounts?|stock price|insurance|who is the ceo|who founded|instagram followers|profit margin)\b/)) {
    return {answer:"This workspace has insufficient evidence to answer that. I can look up campaign performance and the sponsor workbook.",refs:[]};
  }
  if(!domain && !scopedFollowup && !explicitLive) return {answer:scopeText,refs:[]};
  if (has(q,/before (the )?(festival|fest|event)|pre.fest/) && !explicitLive && !dates.length) dates.push(historyDate);
  const explicitHistory = has(q,/histor|original|dataset|workbook|source sheet|\bo\d{3}\b|activat|check.?in|attendee/) || brand || namedHistorical;
  const historical = !explicitLive && !taskDraft && (explicitHistory || input.scope === "history" || dates.length>0 || (scopedFollowup && context.scope === "history"));
  const date = dates[0] || input.date || (scopedFollowup && context.date) || historyDate;
  const historyCid = namedHistorical?.sponsor_campaign_id || requested[0]?.source || (scopedFollowup && context.scope==="history" ? context.campaign : undefined);
  const brandId = brand?.brand_id || (scopedFollowup && context.scope==="history" && !namedHistorical ? context.brand : undefined);
  const cls = classify(q);
  if (historical) {
    if (!/^2025-\d\d-\d\d$/.test(date) || [date,...dates].some(d=>d<"2025-01-15"||d>"2025-04-20"||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)) {
      return {answer:"The workbook covers January 15 through April 20, 2025 in Asia/Kolkata. Select a date in that range.",refs:[]};
    }
    return {...historicalAnswer(q,date,historyCid,brandId,dates),context:{scope:"history",date,campaign:historyCid,brand:brandId}};
  }
  let selected = requested[0] || (scopedFollowup ? board.details.find(r=>r.id===context.campaign) : undefined);
  const refs = [{label:operatingSource}];
  const ctx = (row,topic) => ({scope:"live",campaign:row?.id,mode,topic});
  const weakest = [...board.details].sort((a,b)=>b.gap-a.gap)[0];
  if (taskDraft) {
    selected ||= context.scope === "history" ? board.details.find(r=>r.source===context.campaign) : null;
    selected ||= weakest;
    const target = selected.decision === "Scale" ? `Review and scale ${selected.short}` : `Review ${selected.short.toLowerCase()} and fix the next step`;
    const due = q.match(/\b20\d\d-\d\d-\d\d\b/)?.[0] || "2025-03-29";
    return {answer:`I drafted a task for ${selected.name}. Its latest signal is ${pct(selected.actual.signal)} across ${selected.actual.sample} records. Suggested action: ${selected.next} Confirm below to save it.`,refs,
      draft:{title:target,campaign:selected.id,owner:selected.owner,due,status:"To do",note:selected.next},context:ctx(selected)};
  }
  if(selected && has(q,/who (owns|is responsible for|runs|leads)|campaign owner/)) {
    return {answer:`${selected.owner} owns ${selected.name}.`,refs,context:ctx(selected,"owner")};
  }
  if(has(q,/who (owns|is responsible for|runs|leads) (the|this|that) campaign|^(who is the )?campaign owner/)) {
    return {answer:"Which campaign do you mean? Try asking, “Who owns Inbound fast lane?”",refs:[]};
  }
  if (has(q,/\b(tasks?|action items?|follow.?ups?)\b|who is doing what/) && !has(q,/recommend|prioriti|suggest/)) {
    const list = state.tasks.filter(t=>(!selected||t.campaign===selected.id)&&(!has(q,/open|pending|overdue/)||t.status!=="Done")&&(!has(q,/overdue/)||t.due<PLAN.today));
    return {answer:list.length ? list.slice(0,6).map(t=>`${t.title} — ${t.owner}, due ${t.due}, ${t.status}.`).join("\n") : "There are no saved tasks matching that scope.",refs,context:ctx(selected)};
  }
  if (!selected && has(q,/most|highest|largest|top|leading|which.*most/) && has(q,/cash|collected|raised|money|payment/)&&!has(q,/gap|short|behind|risk/)) {
    const byForecast=has(q,/forecast|projected|expected/);
    const ranked=[...board.details].sort((a,b)=>byForecast?b.projection-a.projection:b.actual.cash-a.actual.cash);
    const lead=ranked[0];
    const amount=byForecast?lead.projection:lead.actual.cash;
    if(!amount) return {answer:"No campaign has cash in that metric yet.",refs,context:ctx()};
    return {answer:`${lead.name} leads with ${lakhs(amount)} in ${byForecast?"projected cash":"simulated receipts"}. The next closest is ${ranked[1].name} at ${lakhs(byForecast?ranked[1].projection:ranked[1].actual.cash)}.`,refs,context:ctx(lead,"cash")};
  }
  if (has(q,/how (is|did|do|are).*(calculate|work out)|explain (the )?(cash )?forecast|where (does|did) (that|this|the) (forecast|number) come from/) &&
      (has(q,/forecast|project/) || (scopedFollowup&&context.topic==="cash"))) {
    return {answer:"The forecast starts with the simulated receipts already saved. It adds expected on-time payments on signed balances and on deals the team still expects to sign. Proposal pace, close rate and the campaign’s decision signal affect the estimate.",refs,context:ctx(selected,"cash")};
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
  if (cls === "budget" || has(q,/budget|spend|spent|unspent|\broi\b|\bcost\b/)) {
    const rows = selected ? [selected] : board.details;
    const budget = sum(rows,"budget"), spent = sum(rows,r=>r.actual.spend), cash = sum(rows,r=>r.actual.cash);
    return {answer:`${selected?.name || "Workspace"} has spent ${inr(spent)} of ${inr(budget)} (${pct(rate(spent,budget))}). Remaining budget is ${inr(budget-spent)}. Simulated cash collected per rupee spent: ${spent?(cash/spent).toFixed(2)+"×":"unavailable at zero spend"}. This ratio excludes festival operating costs.`,refs,context:ctx(selected)};
  }
  if (has(q,/recommend|prioriti|\bscale\b|\bstop\b|weakest|\bbest\b|underperform|(?:biggest|largest|worst) (?:\w+ )?gap|what should|behind|shortfall|risk|bottleneck/) ||
      cls === "rank" || (scopedFollowup && context.topic==="decision" && has(q,/^why|^how so|^tell me more/))) {
    const needsAction = has(q,/weakest|underperform|gap|behind|shortfall|risk|bottleneck/);
    const decisionAsked = has(q,/\bstop\b|pause/) ? "Stop" : has(q,/\bscale\b|double down/) ? "Scale" : has(q,/\bchange\b|revise/) ? "Change" : null;
    const byPriority = [...board.details].sort((a,b)=>b.plan.priority-a.plan.priority);
    const match = decisionAsked && byPriority.find(r=>r.decision===decisionAsked);
    if (!selected && decisionAsked && !match && !needsAction) return {answer:`No campaign currently meets the ${decisionAsked.toLowerCase()} threshold. Check the campaign signals and their observation counts.`,refs,context:ctx()};
    const top = selected || (needsAction ? weakest : match || byPriority[0]);
    const a = top.actual;
    if (scopedFollowup && context.topic==="decision" && has(q,/^why[?.! ]*$|^how so|^tell me more/)) {
      const explanation = a.sample < top.min ? `That’s below the ${top.min} observations needed for a decision.` :
        `That puts it in the ${top.decision.toLowerCase()} range. The scale threshold is ${top.scale}% and the stop threshold is below ${top.change}%.`;
      return {answer:`${top.name} recorded ${pct(a.signal)} for “${top.metric}” across ${a.sample} observations. ${explanation}\n\n${top.next}`,refs,context:ctx(top,"decision")};
    }
    const verdict = a.sample < top.min ? `I’d wait for at least ${top.min} observations before deciding.` :
      `I’d ${top.decision.toLowerCase()} this campaign.`;
    const leading = needsAction && top.gap ? `${top.name} is ${lakhs(top.gap)} short of its cash target.` :
      `${top.name} is forecast to collect ${lakhs(top.projection)} against a target of ${lakhs(top.plan.cash)}.`;
    return {answer:`${leading} ${verdict}\n\n${top.metric} stands at ${pct(a.signal)} across ${a.sample} observations. The rule is to scale at ${top.scale}% or above, change from ${top.change}% to below ${top.scale}%, and stop below ${top.change}%.\n\n${top.next}`,refs,context:ctx(top,"decision")};
  }
  if (cls === "funnel" || has(q,/proposal|prospect|conversion|funnel|signed/)) {
    const a = selected?.actual || board.totals;
    const counts = [a.prospects,a.conversations,a.proposals,a.signed,a.paid];
    const transitions = counts.slice(1).map((n,i)=>({name:`${stageLabels[i]} to ${stageLabels[i+1]}`,rate:rate(n,counts[i])})).filter(x=>x.rate!==null);
    const low = transitions.sort((a,b)=>a.rate-b.rate)[0];
    return {answer:`${selected?.name || "Workspace"}: ${counts.map((n,i)=>`${n} ${stageLabels[i].toLowerCase()}`).join(" / ")}. ${low?`Smallest conversion is ${low.name.toLowerCase()} at ${pct(low.rate)}.`:"There is insufficient volume to calculate stage conversions."} Signed value is ${lakhs(a.signedValue)} and cash received is ${lakhs(a.cash)}.`,refs,context:ctx(selected)};
  }
  if (cls === "collection" || has(q,/forecast|cash|target|paid|collected|raised|funded|gap|progress|on track/) || (scopedFollowup && context.topic==="cash")) {
    const cash = selected?.actual.cash ?? board.totals.cash;
    const signed = selected?.actual.signedValue ?? board.totals.signedValue;
    const prediction = selected?.projection ?? board.projection;
    const target = selected?.plan.cash ?? board.target;
    const subject=selected?.name || "The workspace";
    if(has(q,/how many.*(paid|received payment)|\b(count|number of) (paid|settled) deals\b/)) {
      const n=selected?.actual.paid ?? board.totals.paid;
      return {answer:`${subject} has ${n} paid ${n===1?"deal":"deals"} in the simulation, with ${lakhs(cash)} received so far.`,refs,context:ctx(selected,"cash")};
    }
    if(has(q,/how much.*(collected|raised|received|paid)|cash (collected|received)|receipts|money in/)&&!has(q,/target|forecast|projection/)) {
      const n=selected?.actual.paid ?? board.totals.paid;
      return {answer:`${subject} has ${lakhs(cash)} in simulated receipts across ${n} paid ${n===1?"deal":"deals"}. Signed cash agreements total ${lakhs(signed)}.`,refs,context:ctx(selected,"cash")};
    }
    const delta=prediction-target;
    const comparison=delta===0 ? "That meets the target." : `That leaves the forecast ${lakhs(Math.abs(delta))} ${delta>0?"above":"below"} the target.`;
    return {answer:`${subject} is forecast to collect ${lakhs(prediction)} by 11 April. The ${mode} target is ${lakhs(target)}. ${comparison}\n\n${lakhs(cash)} is already logged as simulated cash received.`,refs,context:ctx(selected,"cash")};
  }
  return {answer:scopeText,refs:[]};
}
