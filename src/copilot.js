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

const normalizeEntity = value=>value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu,"").replace(/[^a-z0-9]+/g," ").trim();
const containsEntity = (text,phrase)=>(" "+text+" ").includes(" "+phrase+" ");

function oneEditApart(a,b) {
  if (Math.abs(a.length-b.length)>1) return false;
  if (a.length>b.length) [a,b]=[b,a];
  let i=0;
  while (i<a.length && a[i]===b[i]) i++;
  if(a.length!==b.length) return a.slice(i)===b.slice(i+1);
  return a.slice(i+1)===b.slice(i+1) ||
    a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2);
}

function resolveBrands(q) {
  const text = normalizeEntity(q.replace(/[’']s\b/gi,""));
  const brands = DATA.sponsor.Brands;
  const exact = brands.filter(brand=>containsEntity(text,brand.brand_id.toLowerCase()) || containsEntity(text,normalizeEntity(brand.brand_name)));
  if(exact.length) return exact;
  const tokens=text.split(" ");
  return brands.filter(brand=>{
    const name = normalizeEntity(brand.brand_name), size = name.split(" ").length;
    return name.length>=5 && tokens.some((_,i)=>i+size<=tokens.length && oneEditApart(tokens.slice(i,i+size).join(" "),name));
  });
}

const aliases = {
  creator:/\b(?:creator(?: network)?(?: referrals?)?|creater|sc05)\b/,
  warm:/\b(?:warm(?: partner)?(?: intro(?:duction)?s?)?|alumni|sc02)\b/,
  inbound:/\b(?:inbound(?: fast lane)?|inboud|inboudn|triage|(?:partner )?interest form|sc04)\b/,
  revival:/\b(?:revival(?: micro.packages)?|revial|dormant|sc06)\b/,
  cold:/\b(?:cold(?: outbound)?|discovery email|sc01)\b/
};

function distinctCampaigns(q,board) {
  const tokens=[...q.matchAll(/\b[a-z]{5,}\b/g)];
  return board.details.map(row=>{
    const exact=q.search(aliases[row.id]);
    const typo=exact<0 && row.id.length>=5 ? tokens.find(token=>oneEditApart(token[0],row.id)) : undefined;
    return {row,at:typo?.index??exact};
  }).filter(({at})=>at>=0)
    .sort((a,b)=>a.at-b.at).map(({row})=>row);
}

function namedBrandInQuestion(question) {
  const identifier=question.match(/\bA\d{2,5}\b/i)?.[0];
  if(identifier) return identifier;
  const quoted=question.match(/\b(?:brands?|sponsors?)\s+(?:named\s+)?["“‘']([^"”’']+)["”’']/i)?.[1];
  if(quoted) return quoted;
  const named=question.match(/\b(?:unknown\s+brand|(?:brand|sponsor)\s+named|brand(?!s\b))\s+([a-z][\w-]*(?:\s+(?!(?:had|has|have|was|is|did|historically|before|as|on|by|in|to|from|with|do)\b)[a-z][\w-]*){0,3})\b/i)?.[1];
  if(named && !/^(?:records?|names?|qualification|list|counts?|conversion|performance|totals?|history|status|outreach|goals?|selection|partners?|data)\b/i.test(named)) return named;
  const subject=question.match(/\b(?:did|does|was|for)\s+([A-Z][\w-]+(?:\s+[A-Z][\w-]+){0,3})\b(?=\s+(?:have|sign|raise|collect|confirm|historically|as of|on|pending)|[?.!]|$)/)?.[1];
  return subject && !/^(?:March|April|February|January|CampusFest|Sponsor Desk|Friday)$/i.test(subject)?subject:null;
}

function historicalAnswer(q, date, cid, brandId, dates, opportunity, topic) {
  const s = getHistorySnapshot(date,{campaign:cid,brand:brandId});
  const selected = [s.brand,s.campaign].filter(Boolean).join(" / ") || "All sponsors";
  const label = `Sponsorship workbook · ${date} EOD IST`;
  const refs = [{label,url:DATA.links.sponsorship}];
  if (!DATA.sponsor.Brands.length) return {answer:"No brand records are available in the historical workbook.",refs};
  if (has(q,/\b(?:roi|cac|budget|spend|cost|receipts?|deposit(?:ed|s)?|collect(?:ed|ing|ions?)?|received|paid|pay|payment\w*|bank|unpaid|cash realiz\w*|bring in|remit\w*)\b/)) {
    const deal=opportunity?s.deals.find(row=>row.id===opportunity):null;
    const committed=opportunity?(deal?.stage==="partner_confirmed" && deal.support==="cash" ? deal.value : 0):s.signedValue;
    const scope=opportunity?(deal?`${deal.brand} (${opportunity})`:opportunity):selected;
    return {answer:`The historical workbook records ${exactCash(committed)} in confirmed cash commitments for ${scope} by ${date}. Actual payment receipts and cash collection totals are unavailable. The workbook provides no bank receipts, payment dates, or campaign spend. Collection and spend shown in the workspace are simulated.`,refs};
  }
  if (dealStatistic(q) && /\b(?:cash|deals?|commitments?|ticket size)\b/.test(q)) {
    const median=dealStatistic(q)==="median";
    const inKind=/\bin.kind\b/.test(q);
    const type=inKind?"in-kind":"cash";
    const summarize=(snapshot,cutoff)=>{
      const values=snapshot.deals.filter(deal=>deal.stage==="partner_confirmed" && deal.support===(inKind?"in_kind":"cash") &&
        (!opportunity||deal.id===opportunity) && Number.isFinite(deal.value)).map(deal=>deal.value).sort((a,b)=>a-b);
      if (!values.length) return `No confirmed ${type} deals had a recorded value for ${opportunity||selected} by ${cutoff}.`;
      const middle=Math.floor(values.length/2);
      const amount=median ? (values[middle]+values[Math.floor((values.length-1)/2)])/2 : sum(values,value=>value)/values.length;
      const calculation=median ?
        values.length%2 ? `middle value of ${values.length} sorted deals` : `(${inr(values[middle-1])} + ${inr(values[middle])}) ÷ 2` :
        `${inr(sum(values,value=>value))} ÷ ${values.length}`;
      return `${median?"Median":"Average"} confirmed ${type} deal for ${opportunity||selected} by ${cutoff} is ${inr(amount)} across ${values.length} ${values.length===1?"deal":"deals"} (${calculation}).`;
    };
    const answers=(dates.length>1?[...dates].sort():[date]).map(cutoff=>summarize(cutoff===date?s:getHistorySnapshot(cutoff,{campaign:cid,brand:brandId}),cutoff));
    return {answer:answers.join("\n")+(inKind?"":"\nThese values are commitments recorded in the workbook. Payment records are unavailable."),refs};
  }
  if (complementaryMetric(q)==="unsignedProposals" && !openProposalStatus(q)) {
    return {answer:`By ${date}, ${s.proposals-s.signed} proposals had no confirmed deal for ${selected} (${s.proposals} proposals − ${s.signed} confirmed deals). The count can include opportunities that stopped progressing.`,refs};
  }
  if (openProposalStatus(q) && /\b(?:open|pending|outstanding|in progress|under negotiation|awaiting)\b/.test(q)) {
    const open=s.deals.filter(deal=>["proposal_sent","negotiating"].includes(deal.stage) && (!opportunity||deal.id===opportunity)).length;
    return {answer:`By ${date}, ${open} opportunities for ${opportunity||selected} had a latest status of proposal sent or negotiating in the historical workbook.`,refs};
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
  if (opportunity || (brandId && topic==="status")) {
    const target = opportunity;
    const deals = s.deals.filter(d=>!target||d.id===target);
    const qualification = s.qualification[0];
    if (!deals.length && !qualification) return {answer:`No eligible source record was available for ${target || selected} at ${date}.`,refs};
    const lines = deals.slice(0,5).map(d=>`${d.id} ${d.brand}: ${stageNames[d.stage]} (${d.support==="cash"?"cash":"in-kind"}), ${inr(d.value)} confirmed, ${inr(d.proposed)} proposed. Updated ${formatDate(d.asOf)}.`);
    return {answer:`${selected} · ${date}. ${qualification ? `Qualification: ${qualification.status}. ${qualification.reason} `:""}${lines.length?"\n"+lines.join("\n"):"No opportunity state yet."}`,refs};
  }
  if (has(q,/\b(?:list|show|which|who)\b/) && has(q,/\b(?:lost|withdrawn)\b/) && !has(q,/how many|count|number of/)) {
    const stage=has(q,/withdrawn/)?"withdrawn":"lost";
    const deals=s.deals.filter(row=>row.stage===stage);
    return {answer:deals.length?`By ${date}, ${deals.length} opportunities were ${stage} for ${selected}.\n${deals.slice(0,8).map(row=>row.id+" "+row.brand).join("\n")}`:
      `No opportunities in this scope were ${stage} by ${date}.`,refs};
  }
  if (has(q,/\b(?:campaigns?|channels?|sources?)\b/) && has(q,/rank|top|best|highest|most|strongest|largest|lowest|least|fewest/) && !cid && !brandId) {
    const ascending=has(q,/lowest|least|fewest|smallest/);
    const metrics = has(q,/outreach|attempt|sent/) ? "outreach" : has(q,/qualif/) ? "qualified" : has(q,/reply|replies/) ? "replyBrands" : has(q,/convers|engag/) ? "conversations" : "signedValue";
    const rows = DATA.sponsor["Sponsor campaigns"].map(c=>getHistorySnapshot(date,{campaign:c.sponsor_campaign_id})).sort((a,b)=>ascending?a[metrics]-b[metrics]:b[metrics]-a[metrics]);
    const listed=has(q,/\bwhich|lowest|least|fewest\b/)?rows.filter(row=>row[metrics]===rows[0][metrics]):rows.slice(0,3);
    return {answer:`Historical campaigns by ${{outreach:"outreach attempts",qualified:"latest qualified brands",replyBrands:"replying brands",conversations:"engaged brands",signedValue:"confirmed cash value"}[metrics]} at ${date} (${ascending?"lowest":"highest"} first).\n${listed.map(r=>`${r.campaign}: ${metrics==="signedValue"?lakhs(r[metrics]):r[metrics]}`).join("\n")}\nCampaign association is observational. Brands may appear in more than one campaign.`,refs};
  }
  if (conversionMetric(q)==="proposalConversion") {
    const percentage=rate(s.signed,s.proposals);
    return {answer:percentage===null ? "Proposal-to-deal conversion is undefined because there were no historical proposals in this scope." :
      `${selected} · proposal-to-deal conversion: ${precisePercent(percentage)} (${s.signed} confirmed opportunities ÷ ${s.proposals} opportunities that reached proposal × 100).`,refs};
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
      [/lost/,s.deals.filter(deal=>deal.stage==="lost").length,"opportunities were recorded as lost"],
      [/in.kind/,s.signed-s.cashDeals,"in-kind partnerships were confirmed"],
      [/cash (deals|partners)/,s.cashDeals,"cash deals were confirmed"],
      [/signed|confirmed|partner/,s.signed,"partnerships were confirmed"],
      [/prospects|brands/,s.brands,"brand records were in scope"]
    ];
    const measure=measures.find(([test])=>test.test(q));
    if(measure)return {answer:`By ${date}, ${measure[1]} ${measure[2]}${selected==="All sponsors" ? "" : ` for ${selected}`}.`,refs};
  }
  if (has(q,/confirmed cash|cash commitments?|signed (cash )?(value|amount)|how much.*(?:sign|confirm|pledge)|in.kind (value|amount)/)) {
    const isInKind=has(q,/in.kind/);
    return {answer:`${selected} had ${exactCash(isInKind?s.inKind:s.signedValue)} in confirmed ${isInKind?"in-kind value":"cash commitments"} by ${date}. The workbook has no bank receipts.`,refs};
  }
  if (has(q,/target|goal|vs plan/)) return {answer:s.goals ? `${s.goals.target_version} is in effect. ${s.qualified} qualified brands vs a goal of ${s.goals.qualified_brands_goal}. ${s.signed} confirmed partnerships vs a goal of ${s.goals.confirmed_partnerships_goal}. These goals cover the overall source program.`:"No historical target was effective on that date.",refs};
  return {answer:`${selected} through ${date}. ${s.brands} brand records, ${s.outreach} distinct outreach attempts to ${s.contacted} brands, ${s.replyBrands} replying brands, ${s.positiveBrands} positive-reply brands, ${s.conversations} brands with engagement, and ${s.meetings} held meetings.\n${s.qualified} brands had latest status qualified. ${s.proposals} opportunities reached a proposal stage and ${s.signed} were currently confirmed. ${s.cashDeals} cash deals totalled ${lakhs(s.signedValue)} in confirmed value. In-kind value was ${lakhs(s.inKind)}.`,refs};
}

function answerQuestion(input,state) {
  const questions=input.q.trim().split(/\?\s+(?=[a-z])|;\s*|,\s*(?=and (?:what|how|which|why)\b)|\s+and (?=(?:what|how|which|why)\b)/i).filter(Boolean);
  let context=input.context || {};
  const results=questions.map(q=>{
    const result=answerTurn({...input,q,context},state);
    context=result.context || context;
    return result;
  });
  if (results.length===1) return results[0];
  const refs=[...new Map(results.flatMap(result=>result.refs).map(ref=>[ref.label,ref])).values()];
  return {answer:results.map(result=>result.answer).join("\n\n"),refs,context,draft:results.find(result=>result.draft)?.draft};
}

function answerTurn(input,state) {
  const question=input.q.trim();
  const q=question.toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ");
  const context=input.context || {};
  const smallTalk=conversationalAnswer(q);
  if (smallTalk) return {answer:smallTalk,refs:[]};
  if (/^(?:yes[,. ]+)?(?:confirm|save it|approve it)\s*[?.!]*$/.test(q)) {
    return {answer:context.topic==="draft" ? "Open Review task draft, then select Confirm and save task to add it to the workspace." :
      "There is no task awaiting confirmation in this conversation. Ask me to draft one first.",refs:[]};
  }
  if (/\b(data sources?|where (does|did|do) (your |the )?(data|figures|numbers) come from)\b/.test(q)) {
    return {answer:"The assignment supplied two workbooks. The sponsorship workbook tracks outreach and commitments, and the attendee workbook records festival check-ins. The workspace uses a simulation for payments, budgets and forecasts.",refs:[
      {label:"Sponsorship workbook",url:DATA.links.sponsorship},
      {label:"Attendee workbook",url:DATA.links.attendee}
    ]};
  }
  if (/\b(next (?:year|season|edition|quarter)|future festival)\b/.test(q) || /\b20(?:2[6-9]|[3-9]\d)\b(?!-\d{2}-\d{2})/.test(q) && /\bcampaigns?|targets?|goals?|forecast|festival|sponsors?\b/.test(q) && !/\b(?:task|due)\b/.test(q)) {
    return {answer:"The workbook and simulation cover the 2025 festival. They contain no campaign goals or budgets for a future edition.",refs:[]};
  }
  if (/\b(weather|rain|hotels?|cricket score|phone numbers?|mobile numbers?|email address|personal emails?|personal address|bank accounts?|stock price|insurance|who is the ceo|who founded|instagram followers|profit margin|market size|market share|inflation|competitor revenue|industry benchmark|tax rate)\b/.test(q)) {
    return {answer:"This workspace has insufficient evidence to answer that. I can look up campaign performance and the sponsor workbook.",refs:[]};
  }

  const dates=parseDates(question);
  const followup=!!context.scope && /^(and|what about|what if|what happens if|how about|then|why|how so|tell me more|how can we improve|how do we improve)\b|\b(it|that campaign|same campaign|same brand|same date|that date|that number|those deals|for this)\b/.test(q);
  const explicitLive=/\b(?:workspace|simulation|simulated|live (?:desk|plan|dashboard)|current (?:campaigns?|figures|dashboard|data)|today's plan)\b/.test(q);
  const explicitMode=q.match(/\b(base|stretch)(?:\s+(?:case|scenario|target|goal|plan|forecast))?\b/)?.[1];
  const mode=explicitMode || (followup && !explicitLive && context.scope==="live" ? context.mode : null) || (input.mode==="stretch"?"stretch":"base");
  const board=overview(state,mode);
  const requested=distinctCampaigns(q,board);
  const namedHistorical=DATA.sponsor["Sponsor campaigns"].filter(c=>containsEntity(normalizeEntity(q),normalizeEntity(c.campaign_name)) || containsEntity(normalizeEntity(q),c.sponsor_campaign_id.toLowerCase()));
  const opportunity=q.match(/\bo\d{2,5}\b/i)?.[0].toUpperCase();
  const requestedIds=[...q.matchAll(/\bsc\d{2,5}\b/gi)].map(match=>match[0].toUpperCase());
  const historyHint=/\bhistor\w*|\boriginal\b|\bworkbook\b|\bdataset\b|source sheet|attend|check.in|activation|as of|records before/.test(q);
  const draft=/\b(create|draft|add|assign|turn)\b/.test(q) && /\b(tasks?|action items?|follow.?up)\b/.test(q);
  const scenario=parseScenario(q,context,followup);
  const brandMatch=resolveBrands(question);
  const namedBrand=namedBrandInQuestion(question);
  const evidence=[{label:"Sponsorship workbook",url:DATA.links.sponsorship}];
  const unknownCampaignId=requestedIds.find(id=>!namedHistorical.some(c=>c.sponsor_campaign_id===id));
  const unknownBrandId=[...q.matchAll(/\ba\d{2,5}\b/gi)].map(match=>match[0].toUpperCase())
    .find(id=>!DATA.sponsor.Brands.some(brand=>brand.brand_id===id));
  if (/\b(?:unknown campaign|campaign named|channel named)\b/.test(q) && !requested.length&&!namedHistorical.length) {
    return {answer:"No matching campaign was found. Try its name or the campaign ID shown in Sources.",refs:evidence};
  }
  if (unknownCampaignId) {
    return {answer:`No campaign matches ${unknownCampaignId}. Use a campaign name or a campaign ID listed in the Sources tab.`,refs:[]};
  }
  if (unknownBrandId) return {answer:`No matching brand was found for ${unknownBrandId} in the sponsorship workbook.`,refs:evidence};
  const archiveOnly=namedHistorical.find(c=>!board.details.some(row=>row.source===c.sponsor_campaign_id));
  if (archiveOnly && (explicitLive || draft || scenario)) {
    return {answer:`${archiveOnly.campaign_name} is in the workbook. Choose a campaign from the simulated workspace for a forecast, budget question, or task draft.`,refs:evidence};
  }
  if (explicitLive && !draft && (brandMatch.length || opportunity)) {
    return {answer:"The simulation is aggregated by campaign. The historical sponsorship workbook has brand and opportunity records.",refs:evidence};
  }
  if (draft && !requested.length && (brandMatch.length || namedBrand || opportunity ||
      followup && context.scope==="history" && !board.details.some(row=>row.source===context.campaign))) {
    return {answer:"Which simulated campaign should own this task? Choose a campaign such as Inbound fast lane or Warm introductions.",refs:[]};
  }
  if (!explicitLive && !draft && !scenario && (brandMatch.length || namedBrand || opportunity)) {
    if (brandMatch.length>1) return {answer:`Which brand do you mean? I found ${brandMatch.slice(0,5).map(brand=>brand.brand_name+" ("+brand.brand_id+")").join(", ")}.`,refs:evidence};
    if (namedBrand && !brandMatch.length && (historyHint || dates.length || input.scope==="history" || /\b(?:brand|sponsor\s+named)\b/.test(q)) && !requested.length) {
      return {answer:`No matching brand was found for “${namedBrand}” in the sponsorship workbook. Try the exact brand name or its A-number.`,refs:evidence};
    }
  }
  const historical=!explicitLive && !draft && !scenario && (historyHint || dates.length || brandMatch.length || opportunity || namedHistorical.some(c=>!requested.some(row=>row.source===c.sponsor_campaign_id)) ||
    (followup && context.scope==="history") || input.scope==="history");
  if (historical) {
    const date=dates[0] || (followup && context.scope==="history" ? context.date : null) || input.date || historyDate;
    if ([date,...dates].some(d=>d<"2025-01-15"||d>"2025-04-20"||!validIsoDate(d))) {
      return {answer:"The workbook covers January 15 through April 20, 2025 in Asia/Kolkata. Select a date in that range.",refs:evidence};
    }
    const cid=namedHistorical[0]?.sponsor_campaign_id || requested[0]?.source || (followup && context.scope==="history"?context.campaign:undefined) || input.campaign;
    const brandId=brandMatch[0]?.brand_id || (followup && context.scope==="history" && !requested.length && !namedHistorical.length?context.brand:undefined) || (!requested.length && !namedHistorical.length && !opportunity?input.brand:undefined);
    const dealId=opportunity || (followup && !brandMatch.length && !requested.length && !namedHistorical.length ? context.opportunity : undefined);
    if (dealId && !DATA.sponsor["Partner opportunities"].some(row=>row.opportunity_id===dealId)) {
      return {answer:`No matching opportunity was found for ${dealId} in the sponsorship workbook.`,refs:evidence};
    }
    if (namedHistorical.length>1 || requested.length>1) {
      const ids=[...new Set([...namedHistorical.map(c=>c.sponsor_campaign_id),...requested.map(row=>row.source)])];
      const answers=ids.map(id=>historicalAnswer(q,date,id,brandId,dates,dealId,"comparison"));
      return {answer:answers.map(result=>result.answer).join("\n\n"),refs:answers[0].refs,context:{scope:"history",date}};
    }
    const topic=/status|qualif|what happened|deal stage/.test(q) && !/how many|count|number of|rate/.test(q) ? "status" :
      followup && !requestedMetric(q) ? context.topic || "status" : brandId && !/how (many|much)|value|count|number|commit|deals|rate|ratio|lost/.test(q)?"status":"summary";
    return {...historicalAnswer(q,date,cid,brandId,dates,dealId,topic),context:{scope:"history",date,campaign:cid,brand:brandId,opportunity:dealId,topic}};
  }
  return liveAnswer({q,dates,mode,board,context,followup,requested,draft,scenario,explicitLive},state);
}

function validIsoDate(value) {
  return typeof value==="string" && /^20\d\d-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0,10)===value;
}

function liveAnswer(query,state) {
  const {q,dates,mode,board,context,followup,requested,draft,scenario,explicitLive}=query;
  const carried=followup && !explicitLive && context.scope==="live" ? board.details.find(row=>row.id===context.campaign):undefined;
  const selected=requested[0] || carried;
  const rows=requested.length?requested:selected?[selected]:board.details;
  const refs=[{label:operatingSource}];
  const ctx=(row,topic,extra={})=>({scope:"live",campaign:row?.id,mode,topic,...extra});
  const weakest=[...board.details].sort((a,b)=>b.gap-a.gap)[0];
  if (/\b(?:when|what date|which date).{0,28}(?:pay|settle)|\b(?:pay|settle).{0,28}(?:when|what date|which date)|\b(?:bank statement|invoice records?|receipt numbers?|transaction ids?|actual payment date|profit margin|net profit|profitability|refunds?|audited revenue)\b/.test(q) && !draft) {
    return {answer:"The workspace has no invoice-level payment dates, bank records, or full festival costs. It can report simulated cash totals and planned collection by 11 April.",refs};
  }
  if (draft) {
    if (requested.length>1) return {answer:"Which one of these campaigns should the task belong to?",refs:[]};
    const target=selected || board.details.find(row=>context.scope==="history"&&row.source===context.campaign) || weakest;
    const due=dates[0] || new Date(Date.parse(PLAN.today)+2*86_400_000).toISOString().slice(0,10);
    if (!validIsoDate(due)) return {answer:"Choose a valid due date for the task, such as 2025-03-29.",refs:[]};
    const a=target.actual;
    const objective=`Goal: ${target.metric} at or above ${target.scale}% after at least ${target.min} observations.`;
    const title=target.next.replace(/\.$/,"").slice(0,110);
    const note=`${target.next} ${objective} Latest simulation: ${pct(a.signal)} across ${a.sample} observations; ${inr(target.gap)} forecast shortfall.`;
    return {answer:`I drafted a task for ${target.owner} on ${target.name}, due ${due}. ${target.next} ${objective} Latest signal: ${pct(a.signal)} across ${a.sample} observations. Confirm below to save it.`,
      refs,draft:{title,campaign:target.id,owner:target.owner,due,status:"To do",note},context:ctx(target,"draft")};
  }
  if (scenario?.error) return {answer:scenario.error,refs:[]};
  if (scenario) {
    const both=/\bbase\b/.test(q)&&/\bstretch\b/.test(q);
    if (both) {
      const cases=["base","stretch"].map(caseMode=>{
        const caseRows=overview(state,caseMode).details.filter(row=>rows.some(selectedRow=>selectedRow.id===row.id));
        return scenarioAnswer(q,scenario,caseRows,caseMode).answer;
      });
      return {answer:cases.join("\n\n"),refs,context:ctx(selected,"scenario",{scenarioDriver:scenario.changes[0]?.driver})};
    }
    const {answer,scenarioDriver}=scenarioAnswer(q,scenario,rows,mode);
    return {answer,refs,context:ctx(selected,scenarioDriver==="signal"?"decision":"scenario",{scenarioDriver})};
  }

  if (/\b(?:what|show|list|which|any|find|how many|who)\b/.test(q) && /\b(tasks?|action items?|follow.?ups?|doing what)\b/.test(q) && !/\b(recommend|prioriti\w*|suggest)\b/.test(q)) {
    const knownOwners=[...new Set(state.tasks.map(task=>task.owner))];
    const owner=knownOwners.find(name=>containsEntity(normalizeEntity(q),normalizeEntity(name)));
    const list=state.tasks.filter(task=>(!selected||rows.some(row=>row.id===task.campaign)) && (!owner||task.owner===owner) &&
      (!/open|pending|overdue/.test(q)||task.status!=="Done") && (!/overdue/.test(q)||task.due<PLAN.today) &&
      (!/completed|done/.test(q)||task.status==="Done"));
    return {answer:list.length ? list.slice(-10).map(task=>`${task.title} — ${task.owner}, due ${task.due}, ${task.status}. ${task.note}`).join("\n") : "There are no saved tasks matching that scope.",refs,context:ctx(selected,"tasks")};
  }
  if (openProposalStatus(q) || /\b(?:open|pending|lost|withdrawn) (?:opportunities|deals)\b/.test(q)) {
    return {answer:"The workspace stores aggregate proposal and signed-deal counts. It has no individual proposal statuses, so I can’t tell which proposals are still open, lost, or withdrawn.",refs};
  }
  if (dealStatistic(q)==="median" && /\b(?:deals?|cash|payments?|receipts?|commitments?|ticket size)\b/.test(q)) {
    return {answer:"The simulated workspace stores totals and counts. A median needs individual deal values. The historical workbook can support a median for confirmed commitments.",refs};
  }
  if (paidContractValue(q) && !dealStatistic(q)) {
    return {answer:"The full contractual value of paid deals is unavailable without individual deal-level payment data. I can calculate average receipts per paid deal from workspace totals.",refs};
  }
  const filtered=filteredCampaigns(q,rows);
  if (filtered) return {...filtered,refs,context:ctx(filtered.row,"metric")};
  if (/\bwho (?:owns|is responsible for|runs|leads)\b|\bcampaign owner\b/.test(q)) {
    return {answer:selected?rows.map(row=>`${row.owner} owns ${row.name}.`).join("\n"):"Which campaign do you mean? Try asking, “Who owns Inbound fast lane?”",refs,context:ctx(selected,"owner")};
  }
  if (/\broi\b|return on investment/.test(q) && !/rupee|incremental/.test(q)) {
    const result=calculateMetric(q,"cashEfficiency",rows,board);
    return {...result,refs,context:ctx(selected,"metric",{metric:"cashEfficiency"})};
  }
  if (/\b(?:how (?:is|did|do|are).*(?:calculate|work out)|explain (?:the )?(?:cash )?forecast|where (?:does|did) (?:that|this|the) (?:forecast|number) come from)/.test(q) && /forecast|project/.test(q)) {
    return {answer:"The forecast starts with the simulated receipts already saved. It adds expected on-time payments on signed balances and on deals the team still expects to sign. Proposal pace, close rate and the campaign’s decision signal affect the estimate.",refs,context:ctx(selected,"metric",{metric:"forecast"})};
  }

  const bothCases=/\bbase\b/.test(q)&&/\bstretch\b/.test(q);
  const metric=requestedMetric(q) || (followup && context.topic==="metric"?context.metric:null) || (bothCases?"target":null);
  const operation=metricOperation(q);
  const metricList=[...new Set(q.split(/\band\b|,(?!\d)/).map(requestedMetric).filter(Boolean))];
  if (!bothCases && metricList.length>1 && !["ratio","share","difference","sum","min","max"].includes(operation)) {
    const answers=metricList.map(key=>calculateMetric(q,key,rows,board)).filter(Boolean);
    return {answer:answers.map(result=>result.answer).join("\n\n"),refs,context:ctx(selected,"metric",{metric:metricList.at(-1)})};
  }
  const rankedGap=metric==="forecastGap" && operation==="max";
  if (rankedGap) {
    const max=Math.max(...rows.map(row=>row.gap));
    const top=rows.filter(row=>row.gap===max);
    if (!max) return {answer:"No campaign in this scope is forecast to fall short of its cash target.",refs,context:ctx(selected,"decision")};
    if (top.length===1) return {...diagnose(top[0],true),refs,context:ctx(top[0],"decision")};
  }
  if (metric && !(metric==="signal" && /^why/.test(q))) {
    if (bothCases && ["target","progress","forecastProgress","forecast","cashRequired","forecastGap"].includes(metric)) {
      const perCampaign=/\bper campaign|by campaign|each campaign\b/.test(q);
      const caseQuestion=perCampaign?"by campaign":"how much in total";
      const cases=["base","stretch"].map(caseMode=>{
        const caseBoard=overview(state,caseMode);
        const caseRows=caseBoard.details.filter(row=>rows.some(selectedRow=>selectedRow.id===row.id));
        return {value:metricValue(metrics[metric],caseRows).value,
          line:`${caseMode[0].toUpperCase()+caseMode.slice(1)}: ${calculateMetric(caseQuestion,metric,caseRows,caseBoard).answer}`};
      });
      const format=metrics[metric].format;
      const gap=operation==="difference"&&cases.every(result=>result.value!==null) ?
        `Difference: ${format===precisePercent?precisePercent(Math.abs(cases[0].value-cases[1].value)).replace("%"," percentage points"):
          format(Math.abs(cases[0].value-cases[1].value))}.\n\n` : "";
      return {answer:gap+cases.map(result=>result.line).join("\n\n"),refs,context:ctx(selected,"metric",{metric})};
    }
    const result=calculateMetric(q,metric,rows,board);
    if (result) return {answer:result.answer,refs,context:ctx(result.row,"metric",{metric})};
  }
  const actionable=/recommend|prioriti[sz]e|\b(?:scale|scaling|stop|pause|expand|expansion)\b|double down|weakest|\bbest\b|underperform|what should|behind|shortfall|risk|bottleneck|how (?:can|could|do) we improve/.test(q);
  if (actionable || (followup && context.topic==="decision")) {
    const needsAction=/weakest|underperform|gap|behind|shortfall|risk|bottleneck/.test(q);
    const action=q.match(/\b(stop|pause|scale|scaling|expand|expansion|double down|change|revise|collect data)\b/)?.[1];
    const desired={stop:"Stop",pause:"Stop",scale:"Scale",scaling:"Scale",expand:"Scale",expansion:"Scale","double down":"Scale",change:"Change",revise:"Change","collect data":"Collect data"}[action];
    const plural=/\b(?:campaigns|channels|strategies|ones|all|every|list)\b/.test(q) || requested.length>1;
    if (desired && plural) {
      const exclude=/\b(?:not|aren't|aren’t|don't|doesn't|cannot|can't|below|fail\w* to)\b/.test(q);
      const matching=rows.filter(row=>exclude?row.decision!==desired:row.decision===desired)
        .sort((a,b)=>b.plan.priority-a.plan.priority);
      if (!matching.length) return {answer:`No campaigns in scope ${exclude?"are outside":"meet"} the ${desired} decision criteria.`,refs,context:ctx(undefined,"decision")};
      return {answer:matching.map(row=>diagnose(row,false).answer).join("\n\n"),refs,
        context:ctx(matching.length===1?matching[0]:undefined,"decision")};
    }
    if (selected && /^how (?:can|could|do) we improve/.test(q)) {
      return {answer:`${selected.next} Track ${selected.metric.toLowerCase()} (currently ${pct(selected.actual.signal)}). Reassess after at least ${selected.min} observations and consider scaling at ${selected.scale}% or above.`,refs,context:ctx(selected,"decision")};
    }
    if (selected && /^why\b/.test(q)) {
      const decisionNote=selected.decision==="Collect data" ? `The sample is below the ${selected.min}-observation minimum.` :
        `That puts it in ${selected.decision}. It takes ${selected.scale}% to scale, and below ${selected.change}% triggers stop.`;
      return {answer:`${selected.name} recorded ${pct(selected.actual.signal)} for ${selected.metric.toLowerCase()} across ${selected.actual.sample} observations. ${decisionNote} The forecast uses that decision to adjust the pace of new deals.`,refs,context:ctx(selected,"decision")};
    }
    if (selected) return {...diagnose(selected,needsAction),refs,context:ctx(selected,"decision")};
    const byPriority=[...board.details].sort((a,b)=>b.plan.priority-a.plan.priority);
    const top=needsAction?weakest:byPriority.find(row=>!desired||row.decision===desired);
    if (!top) return {answer:`No campaign currently meets the ${desired.toLowerCase()} threshold. Check the campaign signals and observation counts.`,refs,context:ctx()};
    return {...diagnose(top,needsAction),refs,context:ctx(top,"decision")};
  }
  if (requested.length>1 || /\bcompare|versus|vs\b/.test(q)) {
    return {answer:rows.map(row=>`${row.name}: ${lakhs(row.actual.cash)} collected, ${lakhs(row.projection)} projected vs ${lakhs(row.plan.cash)} target, ${pct(rate(row.actual.signed,row.actual.proposals))} proposal-to-sign, ${row.decision.toLowerCase()}.`).join("\n"),refs,context:ctx(selected)};
  }
  const classifierInput=/\b(?:budget|spend|proposals?|funnel|prospects?|signed|cash|forecast|sponsor|campaign)\b/.test(q);
  const cls=classifierInput?classify(q):null;
  if (/\bfunnel|pipeline|convers(?:ations|ion)|sign(?:ed|ings)|propos(?:als?|ed)\b/.test(q) || cls==="funnel") {
    const a=selected?.actual || board.totals;
    const counts=[a.prospects,a.conversations,a.proposals,a.signed,a.paid];
    const transitions=counts.slice(1).map((n,i)=>({name:`${stageLabels[i]} to ${stageLabels[i+1]}`,rate:rate(n,counts[i])})).filter(row=>row.rate!==null);
    const low=transitions.sort((a,b)=>a.rate-b.rate)[0];
    return {answer:`${selected?.name || "Workspace"}: ${counts.map((n,i)=>`${n} ${stageLabels[i].toLowerCase()}`).join(" / ")}. ${low?`Smallest conversion is ${low.name.toLowerCase()} at ${pct(low.rate)}.`:"There is insufficient volume to calculate stage conversions."} Signed value is ${lakhs(a.signedValue)} and cash received is ${lakhs(a.cash)}.`,refs,context:ctx(selected)};
  }
  if (/\bbudget|spend|spent\b/.test(q) || cls==="budget") {
    const budget=sum(rows,"budget"), spend=sum(rows,row=>row.actual.spend);
    return {answer:`${selected?.name || "Workspace"} has spent ${inr(spend)} of ${inr(budget)} (${pct(rate(spend,budget))}). Remaining budget is ${inr(budget-spend)}.`,refs,context:ctx(selected,"metric",{metric:"spend"})};
  }
  if (/\bon track\b|forecast|shortfall|target|projected|gap/.test(q) || cls==="collection") {
    const prediction=sum(rows,"projection"), target=sum(rows,cashTarget), delta=prediction-target;
    const comparison=delta===0?"That meets the target.":`That leaves the forecast ${lakhs(Math.abs(delta))} ${delta>0?"above":"below"} the target.`;
    return {answer:`${selected?.name || "The workspace"} is forecast to collect ${lakhs(prediction)} by 11 April. The ${mode} target is ${lakhs(target)}. ${comparison}\n\n${lakhs(sum(rows,collectCash))} is already logged as simulated cash received.`,refs,context:ctx(selected,"metric",{metric:"forecast"})};
  }
  return {answer:scopeText,refs:[]};
}

function diagnose(row,gap) {
  const a=row.actual;
  const verdict=a.sample<row.min?`I’d wait for at least ${row.min} observations before deciding.`:`I’d ${row.decision.toLowerCase()} this campaign.`;
  const leading=gap&&row.gap?`${row.name} is ${lakhs(row.gap)} short of its cash target (${inr(row.gap)}).`:
    `${row.name} is forecast to collect ${lakhs(row.projection)} against a target of ${lakhs(row.plan.cash)}.`;
  return {answer:`${leading} ${verdict}\n\n${row.metric} stands at ${pct(a.signal)} across ${a.sample} observations. The rule is to scale at ${row.scale}% or above, change from ${row.change}% to below ${row.scale}%, and stop below ${row.change}%.\n\n${row.next}`};
}
