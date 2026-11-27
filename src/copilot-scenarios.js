const assumptionDrivers = {
  collect:{pattern:/collect(?:ion|ed)?|reali[sz]|payment rate|on.time payment/,label:"on-time collection rate",fraction:true},
  closeRate:{pattern:/proposal.{0,24}conver|clos(?:e|ing) rate|signing rate|win rate|proposal.to.(?:sign|deal)/,label:"proposal close rate",fraction:true},
  signal:{pattern:/leading (?:signal|indicator)|response rate|repl(?:y|ies) within 24|first reply|24.hour|timely repl/,label:"leading signal",fraction:true},
  deal:{pattern:/deal (?:size|value|amount)|average (?:deal|ticket)|ticket size|deal price/,label:"future average deal size"},
  budget:{pattern:/budget|acquisition allocation/,label:"acquisition budget"}
};

function parseScenario(q,context,followup) {
  const hypothetical=/\b(?:what if|if|suppose|assuming|assume|simulate|sensitivity|scenario)\b/.test(q) ||
    followup && /\b(?:to|by|at)\s+(?:₹|rs\.?\s*)?\d/.test(q) && context.scenarioDriver;
  if (!hypothetical) return null;
  const specified=q.split(/\b(?:if|suppose|assuming|assume)\b/).at(-1);
  const clauses=specified.split(/\band\b(?=\s*[^?;,]{0,70}\d)/);
  const changes=[];
  for (const clause of clauses) {
    const matched=Object.entries(assumptionDrivers).filter(([,spec])=>spec.pattern.test(clause));
    const fallback=followup && (context.scenarioDriver || (context.topic==="decision"?"signal":null));
    const driver=matched.length===1 ? matched[0][0] : !matched.length ? fallback : null;
    const amounts=[...clause.matchAll(/(?<![\w.])(?:₹\s*|(?:rs\.?|inr)\s*)?(-?(?:\d[\d,]*(?:\.\d+)?|\.\d+))\s*(percentage points?|percent points?|pp\b|%|percent\b|crores?\b|cr\b|lakhs?\b|lac[s]?\b|l\b|thousand\b|k\b)?/gi)];
    const amount=amounts.at(-1);
    if (!amount) continue;
    if (!driver) return {error:"What should I change in the scenario: collection rate, proposal conversion, the leading signal, average deal size, or budget?"};
    const value=Number(amount[1].replaceAll(",",""));
    const unit=amount[2]||"";
    const down=/\b(?:decreas\w*|reduc\w*|lower\w*|falls?|drop\w*|declin\w*|cut\w*|less|down|subtract)\b/.test(clause);
    const up=/\b(?:increas\w*|rais\w*|improv\w*|rises?|grow\w*|boost\w*|higher|more|up|add)\b/.test(clause);
    const pp=/points?|^pp$/.test(unit);
    const percent=/%|percent/.test(unit) && !pp;
    const relative=pp || /\bby\b|(?:more|less|higher|lower)\b/.test(clause) || ((up||down) && !/\b(?:to|at|from)\b/.test(clause));
    const sign=down || value<0 ? -1 : 1;
    const spec=assumptionDrivers[driver];
    const rupees = Math.abs(value) * (/^(?:crore|cr)/.test(unit)?1e7:/^(?:lakh|lac|l$)/.test(unit)?1e5:/^(?:thousand|k$)/.test(unit)?1e3:1);
    if (!Number.isFinite(value) || pp&&!spec.fraction || spec.fraction&&!pp&&!percent ||
        !relative && (value<0 || (!spec.fraction&&percent))) {
      return {error:spec.fraction ? `Use a valid percent for ${spec.label}, or specify a percentage-point change.` :
        `Set ${spec.label} in rupees, or specify how much to increase or decrease it.`};
    }
    changes.push({driver,method:pp?"points":relative&&percent?"relative":relative?"delta":"set",
      amount:pp||percent?Math.abs(value)/100:rupees,sign});
  }
  return changes.length ? {changes} : Object.values(assumptionDrivers).some(spec=>spec.pattern.test(specified)) ?
    {error:"Give me a scenario value, such as “set collection to 80%” or “cut the budget by ₹5,000.”"} : null;
}

function scenarioValue(before,change) {
  if (change.method==="set") return change.amount;
  if (change.method==="relative") return before*(1+change.sign*change.amount);
  return before+change.sign*change.amount;
}

function simulateCampaign(row,mode,changes) {
  const current = {};
  const adjusted = {};
  const inputs={collect:row.plan.collect,closeRate:forecastCloseRate(row.actual,row.plan),
    signal:row.actual.signal/100,deal:row.plan.deal,budget:row.budget};
  for (const change of changes) {
    const {driver} = change;
    current[driver] ??= inputs[driver];
    const amount = scenarioValue(adjusted[driver] ?? inputs[driver],change);
    const max=assumptionDrivers[driver].fraction?1:1e9;
    if (amount < -1e-10 || amount > max+1e-10) return {error:assumptionDrivers[driver].label};
    adjusted[driver] = Math.min(max,Math.max(0,amount));
  }
  const actual = Object.hasOwn(adjusted,"signal") ? {...row.actual,signal:Math.round(adjusted.signal*1e10)/1e8} : row.actual;
  return {name:row.name,current,adjusted,actual,decision:decision(row,actual),
    projection:forecast(row,actual,mode,adjusted),budget:adjusted.budget??row.budget};
}

function scenarioAnswer(q,parsed,rows,mode) {
  const simulated=rows.map(row=>simulateCampaign(row,mode,parsed.changes));
  const invalid=simulated.find(row=>row.error);
  if (invalid) return {answer:`The ${invalid.error} change puts at least one campaign outside its valid range. Rates must be 0% to 100%, and amounts must be between ₹0 and ₹1,00,00,00,000. Try a smaller change.`};
  const names = [...new Set(parsed.changes.map(change=>change.driver))];
  const format = (driver,value)=>assumptionDrivers[driver].fraction?precisePercent(value*100):inr(value);
  const adjustment=parsed.changes.map(({driver,method,amount,sign})=>{
    const label=assumptionDrivers[driver].label;
    if (method==="set") return `${label} set to ${format(driver,amount)}`;
    const unit=method==="points"?precisePercent(amount*100).replace("%"," percentage points"):
      method==="relative"?precisePercent(amount*100)+" relative to its starting value":format(driver,amount);
    return `${label} ${sign>0?"increased":"decreased"} by ${unit}`;
  }).join(", ");
  const scope=rows.length===1?rows[0].name:rows.length===PLAN.campaigns.length?"the workspace":rows.map(row=>row.name).join(" + ");
  const old=sum(rows,"projection"), next=sum(simulated,"projection"), receipts=sum(rows,row=>row.actual.cash);
  const delta=next-old;
  const compare=delta===0?"unchanged":`${inr(Math.abs(delta))} ${delta<0?"lower":"higher"}`;
  const lines=simulated.map((result,index)=>{
    const from=rows[index];
    const changes=names.map(driver=>`${format(driver,result.current[driver])} → ${format(driver,result.adjusted[driver])} ${assumptionDrivers[driver].label}`);
    if (names.includes("signal")) changes.push(`decision ${from.decision} → ${result.decision}`);
    return `${result.name}: ${changes.join(", ")}.`;
  });
  let detail=`Already-collected receipts stay at ${inr(receipts)}. The model applies the collection rate to remaining signed value plus projected new deals.`;
  if (names.includes("deal")) detail+=" The new ticket size applies only to projected deals.";
  if (names.includes("closeRate")) detail+=" The scenario substitutes the assumed rate for the blended close rate, with the original signing cap.";
  if (names.includes("budget")) {
    const budget=sum(simulated,"budget"), headroom=budget-sum(rows,row=>row.actual.spend);
    const incremental=sum(rows,row=>row.plan.cash-row.plan.baseline);
    detail+=` Acquisition budget becomes ${inr(budget)}, with ${headroom<0?inr(-headroom)+" already overspent":inr(headroom)+" left"}. Modeled incremental cash per budget rupee is ${budget?multiple(incremental/budget):"undefined"}. The forecast has no modeled response to budget changes alone.`;
  }
  return {answer:`Hypothetical ${mode} forecast for ${scope}: ${exactCash(next)} versus ${inr(old)} now (${compare}).\n${adjustment[0].toUpperCase()+adjustment.slice(1)}.\n${lines.join("\n")}\n\n${detail}`,
    scenarioDriver:names.length===1?names[0]:undefined};
}
