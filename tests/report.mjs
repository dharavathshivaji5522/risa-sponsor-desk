import {isDeepStrictEqual} from "node:util";
import {engine} from "./fixture.mjs";
import {cases,conversation,stressWorkspace,stressChanged} from "./copilot-cases.mjs";

const {initial,answerQuestion}=engine;
const printable=text=>String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">", "&gt;").replaceAll("|","\\|").replaceAll("\n","<br>");
const totals={pass:0,fail:0};
const sections=new Map();
function add(category,question,expected,result,absent=[]) {
  if(!sections.has(category))sections.set(category,[]);
  const {answer,refs,draft}=result;
  const actual=[answer,...refs.map(ref=>"Source: "+ref.label),...(draft?["Draft: "+draft.owner+", "+draft.due+", "+draft.status]:[])].join("\n");
  const passed=expected.every(item=>answer.includes(item)) && absent.every(item=>!answer.includes(item)) &&
    result.contextOK!==false && result.savedDataOK!==false;
  totals[passed?"pass":"fail"]++;
  const checks=[...expected,...absent.map(item=>"Exclude: "+item)].join("\n");
  sections.get(category).push([question,checks,actual,passed?"PASS":"FAIL"].map(printable));
}

for(const {category,question,expected,absent} of cases) {
  const state=initial(), before=JSON.stringify(state);
  const result=answerQuestion({q:question},state);
  add(category,question,expected,{...result,savedDataOK:JSON.stringify(state)===before},absent);
}
const state=initial();
const before=JSON.stringify(state);
let context={};
for(const [question,expected,expectedContext] of conversation) {
  const result=answerQuestion({q:question,context},state);
  const contextOK=!expectedContext || isDeepStrictEqual(Object.fromEntries(Object.keys(expectedContext).map(key=>[key,result.context?.[key]])),expectedContext);
  add("Follow-up conversation",question,[expected],{...result,contextOK,savedDataOK:JSON.stringify(state)===before});
  context=result.context||context;
}
const changed=initial();
engine.applyChange(changed,{kind:"update-campaign",id:"inbound",values:{...changed.campaigns.inbound,signed:4,paid:3,signedValue:390000,cash:260000,spend:24000}});
for(const [question,expected] of [
  ["How much cash collected?",["₹10,10,000"]],
  ["Total signed cash value?",["₹20,55,000"]],
  ["How much remains unpaid?",["₹10,45,000"]],
  ["Proposal closing rate?",["42.22%"]],
  ["Inbound cash realization?",["66.67%"]],
  ["Inbound cost per paid deal?",["₹8,000"]],
  ["Remaining budget?",["₹38,000"]],
  ["How much is the combined inbound and revival spend?",["₹32,000"]],
]) add("Changed application records",question,expected,answerQuestion({q:question},changed));
for(const [question,expected,absent] of stressChanged) {
  const edited=stressWorkspace(engine);
  const before=JSON.stringify(edited);
  const result=answerQuestion({q:question},edited);
  add("Stress tests with changed records",question,expected,{...result,savedDataOK:JSON.stringify(edited)===before},absent);
}

console.log("# Sponsor Desk Copilot test report");
console.log("\n"+totals.pass+" passed · "+totals.fail+" failed across "+(totals.pass+totals.fail)+" checked responses.");
console.log("\nRun `npm run test:report` to reproduce. Each case checks the expected value or statement against the actual response. The follow-up cases also check carried context and verify that chat does not save records. The browser suite separately verifies real IndexedDB writes, confirmation, and UI behavior.");
for(const [category,rows] of sections) {
  console.log("\n## "+category+"\n\n| Question | Expected answer elements | Actual answer and source | Result |\n| --- | --- | --- | --- |");
  rows.forEach(row=>console.log("| "+row.join(" | ")+" |"));
}
if(totals.fail)process.exitCode=1;
