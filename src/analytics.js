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
