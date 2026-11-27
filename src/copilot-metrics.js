const countFormat = n => String(n.toLocaleString("en-IN"));
const precisePercent = n => n.toLocaleString("en-IN",{maximumFractionDigits:2}) + "%";
const multiple = n => n.toFixed(2) + "×";
const formatMetric = (value,format) => value === null ? "undefined" : format(value);
const exactCash = value => inr(value) + " (" + lakhs(value) + ")";
const additive = (key,label,format=countFormat) => ({
  label,format,parts:[row=>row.actual[key]]
});
const quotient = (label, numerator, denominator, format=precisePercent, scale=100, terms=[]) =>
  ({label,parts:[numerator,denominator],format,scale,terms});
const difference = (label,left,right,format=inr) => ({label,format,parts:[left,right],subtract:true});
const field = key => row => row.actual[key];
const collectCash = field("cash");
const signedValue = field("signedValue");
const spent = field("spend");
const assignedBudget = row=>row.budget;
const cashTarget = row=>row.plan.cash;
const projected = row=>row.projection;

const metrics = {
  prospects:additive("prospects","prospects"),
  conversations:additive("conversations","conversations"),
  proposals:additive("proposals","proposals"),
  signed:additive("signed","signed deals"),
  paid:additive("paid","paid deals"),
  cash:additive("cash","simulated receipts",exactCash),
  signedValue:additive("signedValue","signed cash value",inr),
  spend:additive("spend","acquisition spend",inr),
  budget:{label:"acquisition budget",format:inr,parts:[assignedBudget]},
  forecast:{label:"cash forecast",format:exactCash,parts:[projected]},
  target:{label:"cash target",format:inr,parts:[cashTarget]},
  benchmark:{label:"historical planning benchmark",format:inr,parts:[row=>row.plan.baseline]},
  budgetLeft:difference("remaining acquisition budget",assignedBudget,spent),
  overspend:difference("acquisition overspend",spent,assignedBudget),
  unpaid:difference("outstanding signed cash",signedValue,collectCash),
  unsignedProposals:difference("proposals without a signed deal",field("proposals"),field("signed"),countFormat),
  signedWithoutReceipts:difference("signed deals without receipts",field("signed"),field("paid"),countFormat),
  prospectsWithoutConversation:difference("prospects without a conversation",field("prospects"),field("conversations"),countFormat),
  conversationsWithoutProposal:difference("conversations without a proposal",field("conversations"),field("proposals"),countFormat),
  cashRequired:{...difference("cash still needed to reach the target",cashTarget,collectCash),floor:true},
  forecastGap:{...difference("forecast shortfall",cashTarget,projected),floor:true},
  progress:quotient("target funded by receipts",collectCash,cashTarget,precisePercent,100,["receipts","target"]),
  forecastProgress:quotient("forecast target achievement",projected,cashTarget,precisePercent,100,["forecast","target"]),
  budgetUse:quotient("budget used",spent,assignedBudget,precisePercent,100,["spend","budget"]),
  budgetLeftShare:quotient("budget remaining",row=>row.budget-row.actual.spend,assignedBudget,precisePercent,100,["remaining budget","budget"]),
  realization:quotient("cash realization",collectCash,signedValue,precisePercent,100,["receipts","signed cash value"]),
  averageSigned:{...quotient("average signed deal value",signedValue,field("signed"),inr,1,["signed cash value","signed deals"]),perDeal:true},
  averageReceipts:{...quotient("average receipts per paid deal",collectCash,field("paid"),inr,1,["receipts","paid deals"]),perDeal:true},
  cashEfficiency:quotient("cash collected per rupee spent",collectCash,spent,multiple,1,["receipts","spend"]),
  incrementalEfficiency:quotient("modeled incremental cash per rupee of budget",row=>row.plan.cash-row.plan.baseline,assignedBudget,multiple,1,["increment above planning benchmark","budget"]),
  signal:{label:"leading signal",format:precisePercent,parts:[field("signal")],campaignOnly:true},
  priority:{label:"priority score",format:n=>n.toFixed(2)+" / 5",parts:[row=>row.plan.priority],campaignOnly:true}
};
const toStage = {
  prospects:[/\bprospect\w*\b|outreach leads/,"prospects"],
  conversations:[/\bconvers\w*\b|\bmeetings?\b/,"conversations"],
  proposals:[/\bpropos\w*\b|\bquotes?\b/,"proposals"],
  signed:[/\bsign\w*\b|\bclos(?:e|ed|ing)\b|\bwon\b|\bdeals?\b/,"signed deals"],
  paid:[/\bpaid\b|\bpayments?\b|\breceipts?\b/,"paid deals"]
};
const complementaryStages = {
  unsignedProposals:"proposals",
  signedWithoutReceipts:"signed",
  prospectsWithoutConversation:"prospects",
  conversationsWithoutProposal:"conversations"
};
for (const [key,stage] of Object.entries(complementaryStages)) {
  const metric=metrics[key];
  const [before,after]=metric.parts;
  metrics[key+"Share"]=quotient("share of "+metric.label,row=>before(row)-after(row),before,precisePercent,100,[metric.label,toStage[stage][1]]);
}
const transitions = {
  prospectConversion:["prospects","conversations","prospect-to-conversation conversion"],
  conversationConversion:["conversations","proposals","conversation-to-proposal conversion"],
  proposalConversion:["proposals","signed","proposal-to-deal conversion"],
  paidConversion:["signed","paid","signed-to-paid deal conversion"]
};
for (const [key,[den,num,label]] of Object.entries(transitions)) {
  metrics[key] = quotient(label,field(num),field(den),precisePercent,100,[toStage[num][1],toStage[den][1]]);
}
for (const [key,[,label]] of Object.entries(toStage)) {
  const single = {prospects:"prospect",conversations:"conversation",proposals:"proposal",signed:"signed deal",paid:"paid deal"}[key];
  metrics["cost"+key] = quotient("cost per "+single,spent,field(key),inr,1,["acquisition spend",label]);
}

function conversionMetric(q) {
  if (!/conver|clos(?:e|ed|ing) rate|win rate|percentage|percent|proportion|fraction|ratio|how efficient|what share/.test(q) &&
     !/\bproposals? (?:were )?(?:turned|became|signed)\b/.test(q)) return null;
  if (/\b(?:paid|(?:made|received|brought in|with|had|have|recorded) (?:a )?(?:payments?|receipts?))\b/.test(q) && /deal|sign/.test(q) &&
     !/cash value|commitments?|cash to|value of|cash realiz|by (?:value|amount)|\bof (?:all |the |our )?paid deals?\b/.test(q)) return "paidConversion";
  if (/propos|clos(?:e|ed|ing) rate|win rate/.test(q) && (!/conversat/.test(q) || /deals?|sign|clos|won/.test(q))) return "proposalConversion";
  if (/conversat/.test(q) && /propos/.test(q)) return "conversationConversion";
  if (/prospect/.test(q) && /conversat|conversion/.test(q)) return "prospectConversion";
  if (/conversion rate|close rate|closing rate|(?:lowest|highest|worst|best) conversion\b/.test(q)) return "proposalConversion";
  return null;
}

const dealStatistic = q => q.match(/\b(median|average|mean)\b/)?.[1];
const paidContractValue = q => /\b(?:paid deals?|deals? (?:with|that have) receipts?)\b/.test(q) &&
  /\b(?:contract(?:ual|ed)?|face|signed) (?:cash )?value\b/.test(q);
const openProposalStatus = q => /\b(?:proposals?|quotes?)\b/.test(q) &&
  /\b(?:open|pending|outstanding|in progress|lost|rejected|withdrawn|under negotiation|awaiting (?:a )?(?:reply|response|signature|decision))\b/.test(q);

function filteredCampaigns(q,rows) {
  const listRequest=/\b(?:which|what|how many|any|list|show)(?: me)?(?: the| all| any)? (?:campaigns?|channels?)\b/.test(q);
  const overBudget=/\b(?:overspen[dt]\w*|over[- ](?:(?:its|their|the) )?budget|exceed\w* (?:its |their |the )?(?:allocated |acquisition )?budgets?|spen[dt]\w* (?:more than|above|beyond) (?:its |their |the )?(?:allocated |acquisition )?(?:budgets?|budgeted|allocation)|spen[dt]\w* more than (?:was|is|were) allocated)\b/.test(q);
  if (overBudget) {
    const matches=rows.map(row=>({row,amount:metricValue(metrics.overspend,[row]).value}))
      .filter(item=>item.amount>0).sort((a,b)=>b.amount-a.amount);
    const highest=metricOperation(q)==="max" && !/how many/.test(q);
    const listed=highest?matches.filter(item=>item.amount===matches[0].amount):matches;
    const lines=listed.map(({row,amount})=>`${row.name} is ${inr(amount)} over budget (${inr(row.actual.spend)} spent against ${inr(row.budget)} allocated).`);
    return {answer:lines.length ? `${matches.length} ${matches.length===1?"campaign is overspending its":"campaigns are overspending their"} allocated budget.\n${lines.join("\n")}` :
      "None of the campaigns in scope are overspending their acquisition budget.",row:listed.length===1?listed[0].row:undefined};
  }
  if (!listRequest) return null;
  const complementary=complementaryMetric(q);
  if (complementary) {
    const wantZero=/\b(?:no|zero) (?:unsigned|unpaid)\b/.test(q);
    const matches=rows.map(row=>({row,count:metricValue(metrics[complementary],[row]).value})).filter(item=>wantZero?item.count===0:item.count>0);
    const label=metrics[complementary].label;
    const matchLabel=(wantZero?"zero ":"")+label;
    return {answer:matches.length ? `${matches.length} ${matches.length===1?"campaign has":"campaigns have"} ${matchLabel}.\n${matches.map(({row,count})=>`${row.name}: ${count}.`).join("\n")}${complementary==="unsignedProposals"?"\nProposal statuses are needed to tell how many are still open.":""}` :
      `No campaigns in scope have ${matchLabel}.`,row:matches.length===1?matches[0].row:undefined};
  }
  if (!/\b(?:no|zero|without|never|haven't|hasn't|didn't|not (?:collect|receiv|rais|record|log)\w*)\b/.test(q)) return null;
  const stages=["paid","signed","proposals","conversations","prospects"];
  const key=/\b(?:receipts?|cash|money)\b/.test(q) && !/\b(?:paid|signed) deals?\b/.test(q) ? "cash" :
    stages.find(stage=>toStage[stage][0].test(q));
  if (!key) return null;
  const label=metrics[key].label;
  const matches=rows.filter(row=>metricValue(metrics[key],[row]).value===0);
  return {answer:matches.length ? `${matches.length} ${matches.length===1?"campaign has":"campaigns have"} zero ${label}: ${matches.map(row=>row.name).join(", ")}.` :
    `No campaigns in scope have zero ${label}.`,row:matches.length===1?matches[0]:undefined};
}

function complementaryMetric(q) {
  if (/\bunsigned (?:proposals?|quotes?)\b|\b(?:proposals?|quotes?)\b.{0,24}\b(?:remain|still) unsigned\b/.test(q)) return "unsignedProposals";
  if (/\bunpaid (?:signed )?deals?\b|\bsigned deals?\b.{0,26}\bunpaid\b/.test(q) &&
      !/\b(?:cash|amount|rupees|value)\b/.test(q)) return "signedWithoutReceipts";
  const negative=/\b(?:not|never|without|no|didn't|haven't|hasn't|weren't|aren't|failed to|yet to|still haven't)\b/;
  if (!negative.test(q)) return null;
  const [earlier,later]=q.split(negative,2);
  if (/\b(?:proposals?|quotes?)\b/.test(earlier) && /\b(?:sign\w*|closed|converted|became (?:a )?deals?|turn(?:ed)? into (?:a )?(?:deals?|contracts?))\b/.test(later)) return "unsignedProposals";
  if (/\b(?:signed deals?|signed sponsors?|deals?)\b/.test(earlier) && /\b(?:pay|paid|payments?|receipts?)\b/.test(later) &&
      !/\b(?:cash|amount|rupees|value)\b/.test(earlier)) return "signedWithoutReceipts";
  if (/\bprospects?\b/.test(earlier) && /\b(?:convers\w*|spoke|reached (?:a )?conversation)\b/.test(later)) return "prospectsWithoutConversation";
  if (/\bconversations?\b/.test(earlier) && /\b(?:propos\w*|quotes?)\b/.test(later)) return "conversationsWithoutProposal";
  return null;
}

function requestedMetric(q) {
  const cost = q.match(/\b(?:costs?|spen[dt]|expenses?) (?:the (?:most|least) )?(?:per|for each|for every) ([a-z -]+)/)?.[1];
  if (cost) {
    const stage = ["paid","proposals","conversations","prospects","signed"].find(key=>toStage[key][0].test(cost));
    if (stage) return "cost"+stage;
  }
  const complement=complementaryMetric(q);
  if (complement) return /%|\b(?:percent\w*|proportion|fraction|ratio|share)\b/.test(q)?complement+"Share":complement;
  if (/\b(?:cash|receipts?|amount received|payments?)\b.{0,30}\bper (?:paid deals?|deal with (?:a )?receipts?)\b/.test(q)) return "averageReceipts";
  if (/\b(?:signed|contracted|contractual) (?:cash )?(?:value|amount)\b.{0,20}\bper (?:signed )?deals?\b/.test(q)) return "averageSigned";
  const statistic=dealStatistic(q);
  if (statistic && statistic!=="median" && /\b(?:deals?|ticket size|contract sizes?|cash commitments?)\b/.test(q)) {
    if (/\b(?:paid|payment|receipts?|receiv\w*|collect\w*)\b/.test(q)) return "averageReceipts";
    if (/\b(?:value|amount|size|signed|contract\w*|deal worth)\b/.test(q)) return "averageSigned";
  }
  if (/incremental|increment above/.test(q) && /per (?:rupee|₹)|efficien|return on/.test(q)) return "incrementalEfficiency";
  if (/cash .{0,26}per (?:rupee|₹)|cash .{0,12}(?:to|over|\/) spend|acquisition efficien|efficiency of acquisition|cash.*per unit spent/.test(q)) return "cashEfficiency";
  if (/cash reali[sz]|payment conversion|collection efficien|cash (?:to|over|\/) signed|cash.{0,22}(?:relative to|divided by|as a share of).{0,10}signed|(?:signed|commitments?).{0,45}(?:received|collected|paid) (?:so far|in cash)|(?:%|percent|share|fraction|ratio).{0,35}(?:of )?signed.{0,35}(?:received|collected|paid)/.test(q)) return "realization";
  if (/(?:\b(?:unpaid|outstanding|uncollected|still owed)\b|(?:still|left to) collect.{0,24}sign)/.test(q) && !/target|budget|forecast|invoices?/.test(q)) return "unpaid";
  if (/planning benchmark|model(?:ed|led) benchmark/.test(q)) return "benchmark";
  if (/forecast (?:gap|shortfall|deficit)|gap.{0,20}forecast|(?:biggest|largest|worst) (?:cash )?(?:gap|shortfall|deficit)/.test(q)) return "forecastGap";
  if (/target|goal|funded/.test(q)) {
    if (/percent|%|proportion|share|funded|fraction|achievement|progress|how far/.test(q)) {
      return /forecast|projection|predicted|will (?:reach|hit|achieve)|on.track at/.test(q) ? "forecastProgress" : "progress";
    }
    if (/needed|still need|remain|required|how much more|what.*left/.test(q)) return "cashRequired";
    if (!/forecast|gap|shortfall|behind|above|meet|against|why/.test(q)) return "target";
  }
  const conversion = conversionMetric(q);
  if (conversion && /propos|conver|closing rate|win rate/.test(q)) return conversion;
  if (/budget|unallocated|acquisition allocation/.test(q)) {
    if (/\b(?:remaining|remains?|unspent|unallocated|available|headroom|spare|unused)\b|budget (?:is )?left|left (?:in|of|to spend)/.test(q)) {
      return /percent|%|share/.test(q)?"budgetLeftShare":"budgetLeft";
    }
    if (/utili[sz]|used|percent.*spent|%.*spent/.test(q)) return "budgetUse";
    if (/how much.*spen[dt]|actual spend|^spend|amount spent/.test(q)) return "spend";
    if (!/\b(spent|spending|overview|status)\b/.test(q)) return "budget";
  }
  if (conversion) return conversion;
  if (/leading (indicator|signal)|timely.response signal|\b24.hour (response|reply) rate\b/.test(q)) return "signal";
  if (/priority scor|prioriti[sz]ation scor/.test(q)) return "priority";
  if (/signed (?:cash )?(?:value|commitments?|amount)|contracted (?:cash|value|amount)/.test(q)) return "signedValue";
  if (/\b(?:spend|spending|spent|expenditure)\b/.test(q)) return "spend";
  if (/how many|count|number of|\b(?:paid|signed) deals\b|total (?:paid|signed|prospect|proposal|conversation)|(?:compare|highest|lowest|most|least).*(?:proposals|prospects|conversations)/.test(q) && !/funnel|stage/.test(q)) {
    const stage = ["paid","signed","proposals","conversations","prospects"].find(key=>toStage[key][0].test(q));
    if (stage) return stage;
  }
  if (/forecast|projected cash|expected cash|cash project/.test(q) && !/gap|shortfall|why|behind|explain|how .*calculat|on track/.test(q)) return "forecast";
  if (/cash|receipts?|collected|raised|received/.test(q) && !/forecast|target|budget|gap|why|cost|realization|how is/.test(q)) return "cash";
  return null;
}

function metricValue(metric, rows) {
  const parts = metric.parts.map(get=>sum(rows,get));
  let value = parts[0];
  if (metric.subtract) value -= parts[1];
  else if (parts.length===2) value = parts[1]===0 ? null : metric.scale*parts[0]/parts[1];
  if (metric.floor) value=Math.max(0,value);
  return {value,parts};
}

function explainMetric(metric, result) {
  const {value,parts} = result;
  if (value===null) return `undefined because ${metric.terms[1]} is zero`;
  const rendered = metric.format(value);
  if (metric.subtract) {
    const calculation = `${metric.format(parts[0])} − ${metric.format(parts[1])}`;
    return value===0 && parts[0]<parts[1] ? `${rendered} (${calculation}; target already covered)` :
      `${rendered} (${calculation})`;
  }
  if (parts.length===1) return rendered;
  const moneyNumerator = metric===metrics.progress || metric===metrics.forecastProgress || metric===metrics.realization ||
    metric===metrics.budgetUse || metric===metrics.budgetLeftShare || metric.scale===1;
  const moneyDenominator = moneyNumerator && !metric.perDeal && !metric.label.startsWith("cost per");
  const lhs = (moneyNumerator ? inr : countFormat)(parts[0]);
  const rhs = (moneyDenominator ? inr : countFormat)(parts[1]);
  return `${rendered} (${lhs} ${metric.terms[0]} ÷ ${rhs} ${metric.terms[1]}${metric.scale===100?" × 100":""})`;
}

const shareRequest = q => /\b(?:share|portion|contribution (?:percentage|share)) of\b/.test(q) ||
  /\b(?:percentage|percent|proportion|fraction)\b|%/.test(q) && /\b(of|share|compared)\b/.test(q);

function metricOperation(q) {
  if (/\b(lowest|least|smallest|fewest|weakest|minimum|worst|cheapest|bottom)\b/.test(q)) return "min";
  if (/\b(highest|most|largest|biggest|strongest|maximum|top|best|furthest|farthest|leads? (?:on|in|with))\b/.test(q)) return "max";
  if (/\b(average|mean)\b/.test(q)) return "average";
  if (/\b(difference|subtract|minus|more than|less than|apart)\b/.test(q)) return "difference";
  if (/\b(ratio|times (?:as|more)|divide|divided)\b/.test(q)) return "ratio";
  if (shareRequest(q)) return "share";
  if (/\b(sum|combined|together|add|total|aggregate)\b/.test(q)) return "sum";
  if (/\b(compare|comparison|each (?:campaign|channel|of these)|per campaign|by campaign|versus|vs|breakdown|side by side)\b/.test(q)) return "compare";
  return null;
}

function calculateMetric(q,key,rows,board) {
  const metric = metrics[key];
  if (!metric || !rows.length) return null;
  let requestedOperation = metricOperation(q);
  if (metric.perDeal && requestedOperation==="average" && !/\b(?:average|mean) of (?:the )?campaign averages\b/.test(q)) {
    requestedOperation=/\b(?:compare|by campaign|per campaign|each campaign|versus|vs)\b/.test(q)?"compare":null;
  }
  const isQuotient=metric.parts.length===2 && !metric.subtract;
  const op = isQuotient && ["ratio","share"].includes(requestedOperation) && !/\b(?:between|versus|vs|compared to)\b/.test(q) ? null : requestedOperation;
  const selected = rows.length===1 ? rows[0] : null;
  const scoped = rows.length!==board.details.length || /\b(combined|together|these|both)\b/.test(q);
  const list = rows.map(row=>({row,...metricValue(metric,[row])}));
  const isPercent = metric.format===precisePercent;
  const isEfficiency = /per rupee/.test(metric.label);
  const caveat = key==="averageReceipts" ? "\nThe workspace stores total receipts and the count of paid deals. The full contractual value of those paid deals is unavailable without individual deal-level payment data." :
    key.startsWith("unsignedProposals") ? "\nThe workspace tracks aggregate funnel counts. Proposal status records are needed to tell how many are still open." :
    isEfficiency ? "\nThis is a cash-to-cost measure. Full festival costs and profitability are unavailable." :
    key==="signal" && rows.length>1 ? "\nCampaigns track different signals, so this is a numerical comparison of the recorded percentages." : "";
  const portfolioShare=selected || /\b(?:total|portfolio|overall|all campaigns|entire)\b.*\b(?:from|goes to|comes from|allocated to|accounted for by)\b/.test(q) ||
    /\b(?:share|portion|percent\w*|fraction|proportion)\b.*\b(?:did|do|does)\b.*\b(?:bring in|contribute|account for|collect|generate)\b/.test(q);
  const byCampaign=/\b(?:compare|per campaign|by campaign|each campaign|each channel|breakdown)\b/.test(q);
  const shareRanking=op==="min" || op==="max";
  if (metric.parts.length===1 && !metric.campaignOnly && shareRequest(q) && (portfolioShare || byCampaign || shareRanking)) {
    const denominator=metricValue(metric,board.details).value;
    if (denominator===0) return {answer:"The contribution share is undefined because the portfolio total is zero."};
    const format=metric.format===exactCash?inr:metric.format;
    const share=(name,value)=>`${name} accounts for ${precisePercent(100*value/denominator)} of the portfolio’s ${metric.label} (${format(value)} ÷ ${format(denominator)} × 100).`;
    if (shareRanking || byCampaign) {
      const ranked=shareRanking?[...list].sort((a,b)=>op==="min"?a.value-b.value:b.value-a.value):list;
      const entries=shareRanking?ranked.filter(item=>item.value===ranked[0].value):ranked;
      return {answer:entries.map(item=>share(item.row.name,item.value)).join("\n"),row:entries.length===1?entries[0].row:undefined};
    }
    return {answer:share(rows.map(row=>row.name).join(" + "),metricValue(metric,rows).value),row:selected};
  }
  if (op==="min" || op==="max") {
    const defined = list.filter(item=>item.value!==null).sort((a,b)=>op==="min"?a.value-b.value:b.value-a.value);
    const undefinedRows = list.filter(item=>item.value===null).map(item=>item.row.name);
    const note = undefinedRows.length ? `\nUndefined for ${undefinedRows.join(", ")}: no ${metric.terms[1]}.` : "";
    if (!defined.length) return {answer:`${metric.label} is undefined for all matching campaigns.${note}`};
    const first = defined[0];
    const tied = defined.filter(item=>Math.abs(item.value-first.value)<1e-9);
    const name = tied.map(item=>item.row.name).join(" and ");
    const next = defined[tied.length];
    const rendered = metric.format===exactCash ? lakhs(first.value) : metric.format(first.value);
    const result = key==="cash" && op==="max" && tied.length===1 ?
      `${name} leads with ${rendered} in simulated receipts.` :
      `${name} ${tied.length>1?"tie for":"has"} the ${op==="max"?"highest":"lowest"} ${metric.label} at ${rendered}.`;
    const detail = metric.parts.length>1 ? `\n${explainMetric(metric,first)}.` :
      next && key==="cash" && op==="max" ? ` The next closest is ${next.row.name} at ${lakhs(next.value)}.` : "";
    return {answer:result+detail+note+caveat,row:tied.length===1?first.row:undefined};
  }
  if (op==="average" && rows.length>1) {
    const defined = list.filter(item=>item.value!==null);
    const avg = defined.length ? sum(defined,"value")/defined.length : null;
    const terms = defined.map(item=>metric.format(item.value)).join(" + ");
    const ignored = list.length-defined.length;
    return {answer:`Average ${metric.label} is ${formatMetric(avg,metric.format)} across ${defined.length} campaigns with a defined value.${defined.length?` (${terms}) ÷ ${defined.length}.`:""}${ignored?` ${ignored} campaign(s) have a zero denominator.`:""}${caveat}`};
  }
  if (["difference","ratio"].includes(op) && rows.length>2 && scoped) {
    const delimiter=op==="difference"?/\b(?:minus|from)\b/:/\b(?:divided by|by|to|versus|vs)\b/;
    const parts=q.split(delimiter);
    if (parts.length===2) {
      const groups=parts.map(part=>distinctCampaigns(part,{details:rows}));
      if (op==="difference" && /\bsubtract\b.+\bfrom\b/.test(q)) groups.reverse();
      if (groups.every(group=>group.length) && !groups[0].some(row=>groups[1].includes(row))) {
        const [left,right]=groups.map(group=>metricValue(metric,group).value);
        if (left===null||right===null||op==="ratio"&&right===0) return {answer:"The calculation is undefined because one of the group denominators is zero."};
        const groupName=group=>group.map(row=>row.name).join(" + ");
        const result=op==="ratio"?multiple(left/right):isPercent?precisePercent(left-right).replace("%"," percentage points"):metric.format(left-right);
        return {answer:`The ${metric.label} ${op} is ${result} (${groupName(groups[0])}: ${metric.format(left)} ${op==="ratio"?"÷":"−"} ${groupName(groups[1])}: ${metric.format(right)}).${caveat}`};
      }
    }
  }
  if (["difference","ratio","share"].includes(op) && rows.length===2) {
    let [a,b] = list;
    if (/\bsubtract\b.+\bfrom\b/.test(q)) [a,b]=[b,a];
    if (op==="share" && /\b(?:percentage|percent|share) of .+\b(?:was|were|is|are) .+\bby\b/.test(q)) [a,b]=[b,a];
    if (a.value===null || b.value===null) return {answer:`This calculation is undefined because at least one campaign has no ${metric.terms[1]}.`};
    const lhs = metric.format(a.value), rhs = metric.format(b.value);
    if (op==="difference") {
      const signed = /\b(minus|subtract|less than|more than)\b/.test(q);
      const delta = signed ? a.value-b.value : Math.abs(a.value-b.value);
      const format = isPercent ? n=>precisePercent(n).replace("%"," percentage points") : metric.format===exactCash ? inr : metric.format;
      return {answer:`The ${metric.label} difference is ${format(delta)} (${a.row.name}: ${lhs}; ${b.row.name}: ${rhs}).${caveat}`};
    }
    const partOfTotal = op==="share" && /\b(combined|total|both|together)\b/.test(q);
    const denominator = partOfTotal ? a.value+b.value : b.value;
    if (denominator===0) return {answer:`The ${op} is undefined because ${partOfTotal?"the combined total":b.row.name+"’s denominator"} is zero.`};
    return {answer:`${a.row.name} is ${op==="share"?precisePercent(100*a.value/denominator):multiple(a.value/denominator)} of ${partOfTotal?"the combined "+metric.label:b.row.name+"’s "+metric.label} (${lhs} ÷ ${partOfTotal?metric.format(denominator):rhs}${op==="share"?" × 100":""}).${caveat}`};
  }
  if (op==="difference" && rows.length!==2) return {answer:"Which two campaigns should I subtract? You can also ask for a side-by-side comparison."};
  if (["ratio","share"].includes(op) && rows.length>2 && scoped && !isQuotient) {
    return {answer:"Which two campaigns should I divide? You can also ask for each campaign’s figures separately."};
  }
  if (op==="compare" || metric.campaignOnly || (rows.length>1 && scoped && !op && !isQuotient && !/\b(?:how much|how many|combined|together|both)\b/.test(q))) {
    return {answer:`${metric.label[0].toUpperCase()+metric.label.slice(1)} by campaign.\n${list.map(item=>`${item.row.name}: ${explainMetric(metric,item)}.`).join("\n")}${caveat}`,row:selected};
  }
  const result = metricValue(metric,rows);
  const suffix = selected?.name || (scoped ? rows.map(row=>row.name).join(" + ") : "the workspace");
  const calculation = op==="sum" && scoped && metric.parts.length===1 && list.length>1 ?
    ` (${list.map(item=>metric.format(item.value)).join(" + ")})` : "";
  let answer=`${metric.label[0].toUpperCase()+metric.label.slice(1)} for ${suffix}: ${explainMetric(metric,result)}${calculation}.`;
  if (key==="progress" || key==="forecastProgress") {
    const counterpart = metrics[key==="progress"?"forecastProgress":"progress"];
    const other = metricValue(counterpart,rows);
    const remaining = key==="progress" && /remaining|left|still need|unfunded/.test(q);
    if (remaining) answer=`${precisePercent(Math.max(0,100-result.value))} remains unfunded (${inr(Math.max(0,result.parts[1]-result.parts[0]))} still needed for the ${board.mode} target).\n${answer}`;
    answer += `\n${counterpart.label[0].toUpperCase()+counterpart.label.slice(1)}: ${explainMetric(counterpart,other)}.${result.value===null?"":` The ${board.mode} case is used.`}`;
  }
  if (key==="cash") {
    const totals = metricValue(metrics.paid,rows).value;
    answer+=` Across ${totals} paid ${totals===1?"deal":"deals"}.`;
  }
  if (key==="paid") answer+=` The simulation has ${result.value} paid ${result.value===1?"deal":"deals"} and ${lakhs(metricValue(metrics.cash,rows).value)} received.`;
  if (key==="unpaid") answer+=" This is the balance on signed agreements.";
  return {answer:answer+caveat,row:selected};
}
