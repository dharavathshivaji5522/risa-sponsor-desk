const PLAN={"festival":"CampusFest Bengaluru","deadline":"2025-04-11","today":"2025-03-27","baselineCollectionRate":0.85,"scoreWeights":[0.4,0.25,0.2,0.15],"campaigns":[{"id":"creator","name":"Creator referrals","short":"Creator referrals","owner":"Meera","tone":"violet","source":"SC05","proof":725000,"budget":32000,"window":"D−42 to D−22","criteria":[5,5,4,4],"offer":"Creator-introduced brands buy student demos and content rights.","base":[45,32,22,11,105000,0.9],"stretch":[53,39,29,14,110000,0.92],"metric":"Qualified introductions / introductions","scale":60,"change":40,"unit":"%","min":10,"pilot":"10 introductions by D−28","risk":"Low-intent introductions","next":"Use only creators with category-fit brands.","actual":{"prospects":45,"conversations":27,"proposals":17,"signed":8,"paid":5,"signedValue":840000,"cash":450000,"spend":21000,"signal":64,"sample":25}},{"id":"warm","name":"Warm introductions","short":"Warm intros","owner":"Arjun","tone":"mint","source":"SC02","proof":640000,"budget":33000,"window":"D−42 to D−16","criteria":[5,5,4,3],"offer":"Alumni and past partners introduce category anchors to the team.","base":[36,27,18,8,125000,0.9],"stretch":[44,33,24,11,135000,0.92],"metric":"Decision-maker calls / introductions","scale":50,"change":30,"unit":"%","min":10,"pilot":"10 introductions by D−28","risk":"Finance approval delays","next":"Ask for the budget owner and a dated payment plan.","actual":{"prospects":36,"conversations":20,"proposals":14,"signed":6,"paid":3,"signedValue":750000,"cash":300000,"spend":22000,"signal":50,"sample":20}},{"id":"inbound","name":"Inbound fast lane","short":"Inbound fast lane","owner":"Kabir","tone":"blue","source":"SC04","proof":635000,"budget":25000,"window":"D−35 to D−12","criteria":[3,5,5,5],"offer":"Qualify inbound leads and offer a fixed-price activation within one day.","base":[30,22,15,7,100000,0.9],"stretch":[38,29,21,9,105000,0.92],"metric":"First replies within 24h","scale":85,"change":65,"unit":"%","min":10,"pilot":"10 qualified inquiries by D−21","risk":"Slow first response","next":"Assign one triage owner and send the package the same day.","actual":{"prospects":29,"conversations":15,"proposals":9,"signed":3,"paid":2,"signedValue":300000,"cash":200000,"spend":15000,"signal":74,"sample":13}},{"id":"revival","name":"Revival micro-packages","short":"Revival","owner":"Riya","tone":"peach","source":"SC06","proof":0,"budget":14000,"window":"D−35 to D−24","criteria":[3,1,3,4],"offer":"Offer dormant, eligible brands one lower-cost, fixed-scope package.","base":[24,10,5,2,75000,0.8],"stretch":[29,14,8,3,80000,0.85],"metric":"Positive replies / eligible contacts","scale":25,"change":12,"unit":"%","min":15,"pilot":"15 eligible dormant leads by D−24","risk":"Repeated low-intent outreach","next":"Test the narrower offer once and remove opt-outs.","actual":{"prospects":24,"conversations":7,"proposals":3,"signed":1,"paid":0,"signedValue":75000,"cash":0,"spend":8000,"signal":17,"sample":18}},{"id":"cold","name":"Cold outbound holdout","short":"Cold outbound","owner":"Riya","tone":"rose","source":"SC01","proof":0,"budget":16000,"window":"D−38 to D−25","criteria":[2,1,2,3],"offer":"Run a capped test for qualified new brands in underserved categories.","base":[45,12,5,1,75000,0.75],"stretch":[46,16,8,2,80000,0.8],"metric":"Positive replies / delivered emails","scale":12,"change":6,"unit":"%","min":25,"pilot":"25 delivered emails by D−25","risk":"Weak conversion and sponsor fatigue","next":"Pause the list and move effort to proven channels.","actual":{"prospects":40,"conversations":6,"proposals":2,"signed":0,"paid":0,"signedValue":0,"cash":0,"spend":7000,"signal":5,"sample":36}}]};
const sum = (rows, key) => rows.reduce((total, row) => total + (typeof key === "function" ? key(row) : row[key]), 0);
const distinct = (rows, key) => new Set(rows.map(row => row[key]).filter(Boolean)).size;
const rate = (a,b) => b ? 100 * a / b : null;
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const lakhs = n => "₹" + (Math.round(n / 1000) / 100).toFixed(2) + "L";
const pct = n => n === null ? "—" : (Math.round(n * 10) / 10) + "%";
const stageLabels = ["Prospects", "Conversations", "Proposals", "Signed", "Paid"];
const latest = (array,key,dateKey) => {
  const map = new Map();
  for (const row of array) {
    const existing = map.get(row[key]);
    if (!existing || row[dateKey] > existing[dateKey] ||
        (row[dateKey] === existing[dateKey] && row.history_id > existing.history_id)) map.set(row[key], row);
  }
  return [...map.values()];
};
const dedupe = (array,key) => [...new Map(array.map(row => [row[key],row])).values()];
const asOf = (row, key, date) => row[key]?.slice(0,10) <= date;
const knownConversation = new Set(["replied","meeting_held","introduction_received","web_inbound"]);
const proposalStages = new Set(["proposal_sent","negotiating","partner_confirmed"]);
const historyDate = "2025-04-11";

function getHistorySnapshot(date = historyDate, options = {}) {
  const source = DATA.sponsor;
  const brand = source.Brands.find(row => row.brand_id === options.brand);
  const campaign = source["Sponsor campaigns"].find(row => row.sponsor_campaign_id === options.campaign);
  const brandFilter = row => !brand || row.brand_id === brand.brand_id;
  const campaignFilter = row => !campaign || row.sponsor_campaign_id === campaign.sponsor_campaign_id;
  const brandRows = source.Brands.filter(row => asOf(row,"created_at",date) && brandFilter(row));
  const outreach = dedupe(source["Sponsor interactions"],"interaction_id")
    .filter(row => asOf(row,"occurred_at",date) && brandFilter(row) && campaignFilter(row));
  const qualification = latest(dedupe(source["Brand qualification"],"history_id")
    .filter(row => asOf(row,"effective_at",date) && brandFilter(row)), "brand_id", "effective_at")
    .filter(campaignFilter);
  const opp = source["Partner opportunities"].filter(row => asOf(row,"created_at",date) && brandFilter(row) && campaignFilter(row));
  const opportunityById = new Map(opp.map(row => [row.opportunity_id,row]));
  const versions = dedupe(source["Opportunity history"],"history_id")
    .filter(row => asOf(row,"effective_at",date) && opportunityById.has(row.opportunity_id));
  const deals = latest(versions,"opportunity_id","effective_at").map(row => ({
    ...row, support: opportunityById.get(row.opportunity_id).support_type, origin: opportunityById.get(row.opportunity_id).sponsor_campaign_id
  }));
  const confirmed = deals.filter(row => row.stage === "partner_confirmed");
  const cash = confirmed.filter(row => row.support === "cash");
  const qualified = qualification.filter(row => row.qualification_status === "qualified");
  const conv = outreach.filter(row => knownConversation.has(row.event_type));
  const touched = outreach.filter(row => row.event_type === "outreach_sent");
  const reply = outreach.filter(row => row.event_type === "replied");
  const positive = reply.filter(row => row.outcome === "positive");
  const linkedActivations = source["Sponsor activations"].filter(row => asOf(row,"linked_at",date) && brandFilter(row) && opportunityById.has(row.opportunity_id) &&
    confirmed.some(deal => deal.opportunity_id === row.opportunity_id));
  const goals = latest(source.Targets.filter(row => asOf(row,"effective_at",date)).map(row => ({...row, key: "goal"})),"key","effective_at")[0] || null;
  return {
    date, campaign: campaign?.campaign_name, brand: brand?.brand_name,
    brands: campaign ? distinct([...outreach, ...opp, ...qualification],"brand_id") : brandRows.length,
    outreach: touched.length, contacted: distinct(touched,"brand_id"),
    conversations: distinct(conv,"brand_id"), replies: reply.length, replyBrands: distinct(reply,"brand_id"),
    positive: positive.length, positiveBrands: distinct(positive,"brand_id"),
    meetings: outreach.filter(row => row.event_type === "meeting_held").length,
    qualification: qualification.map(row => ({id:row.brand_id,status:row.qualification_status,reason:row.reason,source:row.sponsor_campaign_id,date:row.effective_at})),
    qualified: qualified.length, proposals: distinct(versions.filter(row => proposalStages.has(row.stage)),"opportunity_id"),
    signed: confirmed.length, cashDeals: cash.length, signedValue: sum(cash,"confirmed_value_inr"),
    inKind: sum(confirmed.filter(row => row.support === "in_kind"),"confirmed_value_inr"),
    deals: deals.map(row => ({id:row.opportunity_id,brand:row.brand_name,name:row.opportunity_name,stage:row.stage,
      support:row.support,value:row.confirmed_value_inr,proposed:row.proposed_value_inr,origin:row.origin,asOf:row.effective_at})),
    goals, activations: linkedActivations.map(row => ({name:row.attendee_campaign_name,id:row.attendee_campaign_id,brand:row.brand_name,opportunity:row.opportunity_id}))
  };
}

function attendance(campaignId, date) {
  const rows = DATA.attendee.checkins.filter(r => r[1].slice(0,10) <= date && r[4] === "admitted" && r[5] === "verified" && (!campaignId || r[3] === campaignId));
  return new Set(rows.map(r => r[2])).size;
}

function planRow(config, mode) {
  const [prospects,conversations,proposals,signed,deal,collect] = config[mode];
  return {prospects,conversations,proposals,signed,deal,collect,booked:signed*deal,cash:Math.round(signed*deal*collect),
    baseline:Math.round(config.proof*PLAN.baselineCollectionRate),
    priority:config.criteria.reduce((score,n,index)=>score + n*PLAN.scoreWeights[index],0)};
}

function decision(config, actual) {
  if (actual.sample < config.min) return "Collect data";
  if (actual.signal >= config.scale) return "Scale";
  if (actual.signal >= config.change) return "Change";
  return "Stop";
}

function forecastCloseRate(actual, target) {
  return (actual.signed + 6*(target.signed / target.proposals)) / (actual.proposals+6);
}

function forecast(config, actual, mode, assumptions = {}) {
  const target = planRow(config,mode);
  const balance = actual.signedValue - actual.cash;
  const closeRate = assumptions.closeRate ?? forecastCloseRate(actual,target);
  const remainingDays = Math.round((Date.parse(PLAN.deadline)-Date.parse(PLAN.today))/86_400_000);
  const elapsed = Math.max(1,42-remainingDays);
  const newProposals = Math.min(Math.max(0,target.proposals-actual.proposals),Math.floor(actual.proposals/elapsed*remainingDays));
  const pace = {"Scale":1,"Change":0.6,"Stop":0,"Collect data":0.4}[decision(config,actual)];
  const additionalSigned = Math.min(Math.max(0,target.signed-actual.signed),(Math.max(0,actual.proposals-actual.signed)+newProposals)*closeRate*pace);
  return Math.round(actual.cash + (balance + additionalSigned*(assumptions.deal ?? target.deal))*(assumptions.collect ?? target.collect));
}

function overview(state, mode = "base") {
  const details = PLAN.campaigns.map(config => {
    const actual = state.campaigns[config.id];
    const plan = planRow(config,mode);
    const projection = forecast(config,actual,mode);
    return {...config, actual, plan, projection, decision:decision(config,actual), gap:Math.max(0,plan.cash-projection)};
  });
  const totals = Object.fromEntries(["prospects","conversations","proposals","signed","paid","cash","signedValue","spend"].map(key => [key,sum(details,r=>r.actual[key])]));
  return {details, totals, target:sum(details,r=>r.plan.cash), projection:sum(details,"projection"),
    budget:sum(details,"budget"), benchmark:sum(details,r=>r.plan.baseline), mode};
}

function initial() {
  return {campaigns:Object.fromEntries(PLAN.campaigns.map(({id,actual})=>[id,{...actual}])), tasks:[
    {id:"t-1",campaign:"inbound",title:"Clear inbound lead backlog",owner:"Kabir",due:"2025-03-29",status:"In progress",note:"Reply to qualified inquiries within 24 hours."},
    {id:"t-2",campaign:"warm",title:"Confirm finance owners and payment dates",owner:"Arjun",due:"2025-03-31",status:"To do",note:"Lock the payment schedule for signed anchor deals."},
    {id:"t-3",campaign:"creator",title:"Send activation briefs to creator partners",owner:"Meera",due:"2025-03-26",status:"Done",note:"Shared the student demo package."}
  ]};
}
