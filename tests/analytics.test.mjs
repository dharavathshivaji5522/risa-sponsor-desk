import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {engine} from "./fixture.mjs";

const {DATA,PLAN,initial,overview,forecast,decision,planRow,metricValue,metrics,getHistorySnapshot,historicalQuery,applyChange,workspaceRecord}=engine;
const amount=(state,key,options={})=>metricValue(metrics[key],overview(state,options.mode).details.filter(row=>!options.id||row.id===options.id)).value;
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} differs from ${expected}`);
const base=overview(initial()), stretch=overview(initial(),"stretch");

for(const [name,value,actual] of [
  ["historical cash commitments",2000000,()=>getHistorySnapshot().signedValue],
  ["historical planning benchmark",1700000,()=>base.benchmark],
  ["base cash target",2745750,()=>base.target],
  ["stretch cash target",3984400,()=>stretch.target],
  ["acquisition budget",120000,()=>base.budget],
  ["cash collected",950000,()=>base.totals.cash],
  ["signed cash value",1965000,()=>base.totals.signedValue],
  ["base forecast",2634980,()=>base.projection],
  ["stretch forecast",3387758,()=>stretch.projection],
  ["forecast shortfall",110770,()=>base.target-base.projection],
  ["acquisition spend",73000,()=>base.totals.spend],
  ["remaining acquisition budget",47000,()=>amount(initial(),"budgetLeft")],
  ["cash still required",1795750,()=>amount(initial(),"cashRequired")],
  ["outstanding signed cash",1015000,()=>amount(initial(),"unpaid")],
  ["base signed plan",3080000,()=>base.details.reduce((n,row)=>n+row.plan.booked,0)],
  ["stretch signed plan",4370000,()=>stretch.details.reduce((n,row)=>n+row.plan.booked,0)],
  ["share funded",950000/2745750*100,()=>amount(initial(),"progress")],
  ["share forecast",2634980/2745750*100,()=>amount(initial(),"forecastProgress")],
  ["cash realization",950000/1965000*100,()=>amount(initial(),"realization")],
  ["cash efficiency",950000/73000,()=>amount(initial(),"cashEfficiency")],
  ["incremental efficiency",1045750/120000,()=>amount(initial(),"incrementalEfficiency")],
  ["budget usage",73000/120000*100,()=>amount(initial(),"budgetUse")],
  ["inbound cost per paid deal",7500,()=>amount(initial(),"costpaid",{id:"inbound"})],
  ["creator base cash forecast",1084500,()=>base.details.find(row=>row.id==="creator").projection],
  ["warm base cash forecast",930000,()=>base.details.find(row=>row.id==="warm").projection],
  ["inbound base cash forecast",519680,()=>base.details.find(row=>row.id==="inbound").projection],
  ["revival base cash forecast",100800,()=>base.details.find(row=>row.id==="revival").projection],
  ["cold base cash forecast",0,()=>base.details.find(row=>row.id==="cold").projection]
]) test("Model · "+name,()=>near(actual(),value));

for(const [id,counts,planCounts,priority,baselineDecision] of [
  ["creator",[45,27,17,8,5],[45,32,22,11],4.65,"Scale"],
  ["warm",[36,20,14,6,3],[36,27,18,8],4.5,"Scale"],
  ["inbound",[29,15,9,3,2],[30,22,15,7],4.2,"Change"],
  ["revival",[24,7,3,1,0],[24,10,5,2],2.65,"Change"],
  ["cold",[40,6,2,0,0],[45,12,5,1],1.9,"Stop"]
]) {
  const stages=["prospects","conversations","proposals","signed","paid"];
  test("Funnel counts · "+id,()=>{
    const row=base.details.find(item=>item.id===id);
    assert.deepEqual(stages.map(stage=>row.actual[stage]),counts);
    assert.deepEqual(stages.slice(0,4).map(stage=>row.plan[stage]),planCounts);
  });
  for(const [index,key] of ["prospectConversion","conversationConversion","proposalConversion","paidConversion"].entries()) {
    test("Funnel · "+id+" · "+key,()=>{
      const value=amount(initial(),key,{id});
      if (!counts[index]) assert.equal(value,null);
      else near(value,100*counts[index+1]/counts[index]);
    });
  }
  test("Prioritization and baseline decision · "+id,()=>{
    const row=base.details.find(item=>item.id===id);
    near(row.plan.priority,priority);
    assert.equal(row.decision,baselineDecision);
  });
}

for(const [signal,sample,expected] of [[85,10,"Scale"],[84.9,10,"Change"],[65,10,"Change"],[64.9,10,"Stop"],[100,9,"Collect data"],[0,10,"Stop"]]) {
  test(`Inbound threshold · ${signal}% from ${sample} observations`,()=>{
    const inbound=PLAN.campaigns.find(row=>row.id==="inbound");
    assert.equal(decision(inbound,{signal,sample}),expected);
  });
}

const forecastChanges=[
  ["collection override", {collect:0.8}, {}, 484160],
  ["collections zero", {collect:0}, {}, 200000],
  ["collections full", {collect:1}, {}, 555200],
  ["future deal price", {deal:120000}, {}, 565616],
  ["close rate", {closeRate:0.3}, {}, 468200],
  ["new deal price zero", {deal:0}, {}, 290000],
  ["scale decision", {}, {signal:90}, 650000],
  ["stop decision", {}, {signal:50}, 290000],
  ["collect data decision", {}, {sample:0}, 443120],
  ["signing cap", {closeRate:1}, {}, 650000],
  ["keep signed cash fixed", {deal:120000}, {signal:50}, 290000],
  ["two overrides", {deal:120000,collect:0.8}, {}, 524992],
];
for(const [label,assumptions,actualEdit,expected] of forecastChanges) {
  test("Forecast driver · "+label,()=>{
    const inbound=PLAN.campaigns.find(row=>row.id==="inbound");
    assert.equal(forecast(inbound,{...inbound.actual,...actualEdit},"base",assumptions),expected);
  });
}

test("original workbook downloads match the fixture checksums",()=>{
  for(const [kind,raw] of [["sponsor","sponsorship"],["attendee","attendee"]]) {
    for(const dir of ["data","docs"]) {
      const bytes=readFileSync(new URL(`../${dir}/${raw}-original.xlsx`,import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"),DATA.sha256[kind]);
    }
  }
});

const dated=[
  ["2025-01-15",7,0,0,0,0,0,0,0,40,20],
  ["2025-03-15",156,243,96,55,35,17,1325000,180000,55,28],
  ["2025-03-31",180,303,103,60,46,23,1850000,240000,55,28],
  ["2025-04-11",180,321,109,60,46,24,2000000,240000,55,28],
  ["2025-04-20",180,322,109,60,46,24,2000000,240000,55,28],
];
for(const [date,...expected] of dated) {
  test("Workbook snapshot · "+date,()=>{
    const snapshot=getHistorySnapshot(date);
    const fields=["brands","outreach","conversations","qualified","proposals","signed","signedValue","inKind"];
    assert.deepEqual([...fields.map(field=>snapshot[field]),snapshot.goals.qualified_brands_goal,snapshot.goals.confirmed_partnerships_goal],expected);
  });
}
for(const [key,value,regex] of [["date","2025-02-30",/history date/],["date","2024-04-11",/history date/],["campaign","SC99",/Unknown historical campaign/],["brand","A999",/Unknown historical brand/]]) {
  test("Historical filter rejects "+value,()=>assert.throws(()=>historicalQuery(new URLSearchParams({[key]:value})),regex));
}

const invalidCampaign=[
  ["cash",-10,/whole/],["prospects",-1,/whole/],["conversations",1.5,/whole/],
  ["cash",840001,/exceed/],["signed",18,/previous stage/],["proposals",28,/previous stage/],
  ["conversations",46,/previous stage/],["paid",9,/previous stage/],["paid",0,/both paid deals/],
  ["cash",0,/both paid deals/],["signal",101,/signal/],["signal",-1,/signal/],
  ["signal",Infinity,/signal/],["spend",1e9+1,/whole/],["prospects",100001,/whole/],
  ["sample",undefined,/whole/],["signedValue",null,/whole/],["signedValue",0,/exceed/],
];
for(const [key,value,error] of invalidCampaign) {
  test("Reject invalid campaign · "+key+" = "+value,()=>{
    const state=initial(), before=JSON.stringify(state);
    assert.throws(()=>applyChange(state,{kind:"update-campaign",id:"creator",values:{...state.campaigns.creator,[key]:value}}),error);
    assert.equal(JSON.stringify(state),before);
  });
}
test("reject signed deals with no signed value even when cash and paid are zero",()=>{
  const state=initial();
  assert.throws(()=>applyChange(state,{kind:"update-campaign",id:"revival",values:{...state.campaigns.revival,signedValue:0}}),/both signed deals/);
});
test("reject unknown campaign ID without altering valid records",()=>{
  const state=initial();
  assert.throws(()=>applyChange(state,{kind:"update-campaign",id:"constructor",values:state.campaigns.creator}),/valid campaign/);
  assert.equal(overview(state).totals.cash,950000);
});

for(const [key,value] of [["title"," "],["owner",""],["due","2025-02-30"],["due","2025-04-31"],["status","Deleted"],["due",""],["campaign","not-found"],["note",null]]) {
  test("Reject invalid task · "+key+" = "+value,()=>{
    const state=initial(), before=JSON.stringify(state);
    assert.throws(()=>applyChange(state,{kind:"create-task",task:{...state.tasks[0],id:undefined,[key]:value}}),/Provide a title/);
    assert.equal(JSON.stringify(state),before);
  });
}
test("task submission is idempotent and keeps edits separate",()=>{
  const state=initial(), task={...state.tasks[0],id:crypto.randomUUID(),title:"Verify response timing"};
  applyChange(state,{kind:"create-task",task});
  applyChange(state,{kind:"create-task",task});
  assert.equal(state.tasks.length,4);
  assert.throws(()=>applyChange(state,{kind:"create-task",task:{...task,title:"Different title"}}),/already saved/);
  applyChange(state,{kind:"edit-task",task:{...task,status:"Done"}});
  assert.equal(state.tasks.at(-1).status,"Done");
  assert.throws(()=>applyChange(state,{kind:"edit-task",task:{...task,id:crypto.randomUUID()}}),/not found/);
});
test("malformed workspace records fail clearly and retain previously permitted values",()=>{
  assert.equal(workspaceRecord(undefined).revision,0);
  assert.throws(()=>workspaceRecord(null),/Saved workspace records/);
  assert.throws(()=>workspaceRecord({state:initial(),revision:-1}),/Saved workspace records/);
  const saved={state:initial(),revision:12};
  const legacy=saved.state.campaigns.revival;
  legacy.signedValue=0;
  assert.equal(workspaceRecord(saved).state.campaigns.revival.signedValue,0);
  saved.state.tasks.push(saved.state.tasks[0]);
  assert.throws(()=>workspaceRecord(saved),/Saved workspace records/);
});
