import test from "node:test";
import assert from "node:assert/strict";
import {engine} from "./fixture.mjs";

const {getHistorySnapshot,attendance,overview,initial,answerQuestion,applyChange,historicalQuery}=engine;

test("historical snapshots deduplicate IDs, use latest state, and separate cash from in-kind",()=>{
  const before=getHistorySnapshot("2025-04-11");
  assert.equal(before.brands,180);assert.equal(before.outreach,321);assert.equal(before.contacted,141);
  assert.equal(before.conversations,109);assert.equal(before.qualified,60);assert.equal(before.signed,24);
  assert.equal(before.cashDeals,20);assert.equal(before.signedValue,2_000_000);assert.equal(before.inKind,240_000);
  assert.equal(getHistorySnapshot("2025-03-15").signed,17);
  assert.equal(getHistorySnapshot("2025-03-31").signedValue,1_850_000);
  assert.equal(getHistorySnapshot("2025-04-11",{campaign:"SC05"}).signedValue,725_000);
  assert.equal(getHistorySnapshot("2025-04-11",{campaign:"SC01"}).signedValue,0);
  assert.equal(getHistorySnapshot("2025-02-01",{brand:"A001"}).signedValue,0);
  assert.equal(getHistorySnapshot("2025-03-15",{brand:"A001"}).signedValue,200_000);
  assert.equal(attendance("C03","2025-04-11"),0);
  assert.ok(attendance("C03","2025-04-20")>0);
});

test("model totals reconcile and target gap responds to current records",()=>{
  const state=initial(), a=overview(state);
  assert.equal(a.target,2_745_750);assert.equal(overview(state,"stretch").target,3_984_400);
  assert.equal(a.benchmark,1_700_000);assert.equal(a.budget,120_000);
  assert.equal(a.totals.cash,950_000);
  assert.ok(a.projection<a.target);
  state.campaigns.creator.cash+=100_000;
  const b=overview(state);
  assert.equal(b.totals.cash,a.totals.cash+100_000);assert.ok(b.projection>a.projection);
  state.campaigns.inbound.signal=90;
  assert.ok(overview(state).projection>b.projection);
});

test("Copilot answers new values, carries date and campaign context, and declines unsupported facts",()=>{
  const state=initial();
  const reply=(q,extra={})=>answerQuestion({q,...extra},state);
  assert.match(reply("How much has the current workspace collected in cash?").answer,/₹9\.50L/);
  state.campaigns.creator.cash+=100_000;
  assert.match(reply("How much has the current workspace collected in cash?").answer,/₹10\.50L/);
  const m=reply("What was Beardo’s status on March 15?");
  assert.match(m.answer,/A?O001|Partner confirmed/);
  assert.match(reply("And on February 1?",{context:m.context}).answer,/Beardo/);
  assert.match(reply("Did Beardo’s activation cause extra attendance as of April 20?").answer,/lack a control group/);
  assert.match(reply("How much cash was collected historically?").answer,/no bank receipts/);
  assert.match(reply("Where did it rain during the festival?").answer,/insufficient evidence/);
  assert.match(reply("Show the history on February 30").answer,/Select a date/);
  assert.match(reply("Which campaign should we stop and why?").answer,/Cold outbound/);
  assert.match(reply("Which campaigns are ready to scale?").answer,/Creator referrals/);
  const weakest=reply("Which campaign has the biggest forecast gap?");
  assert.ok(weakest.context.campaign);
  const task=reply("Draft a follow-up task for that campaign.",{context:weakest.context});
  assert.equal(task.draft.campaign,weakest.context.campaign);
});

test("Copilot answers identity, greetings and practical follow-ups before data routing",()=>{
  const state=initial();
  const reply=(q,extra={})=>answerQuestion({q,...extra},state);
  for(const query of ["who are you ?", "Hey! Who are you?", "What's your name?", "Can you introduce yourself?"]){
    for(const scope of [undefined,"history"]){
      const answer=reply(query,{scope});
      assert.match(answer.answer,/Sponsor Desk chatbot/);
      assert.equal(answer.refs.length,0);
      assert.equal(answer.draft,undefined);
    }
  }
  assert.match(reply("Hi!").answer,/Sponsor Desk chatbot/);
  assert.match(reply("What can you do?").answer,/How much have we raised/);
  assert.match(reply("Who wrote Hamlet?").answer,/enough information/);
  assert.match(reply("Who owns inbound?").answer,/Kabir owns Inbound/);
  assert.match(reply("Who owns this campaign?").answer,/Which campaign/);
  assert.match(reply("How much have we raised?").answer,/₹9\.50L/);
  assert.match(reply("Are we on track?").answer,/₹1\.11L below the target/);
  assert.match(reply("How many deals have been paid?").answer,/10 paid deals/);
  assert.equal(reply("Where does the data come from?").refs.length,2);
  const ranking=reply("Which campaign collected the most cash?");
  assert.match(ranking.answer,/Creator referrals leads with ₹4\.50L/);
  state.campaigns.warm.cash=640000;
  assert.match(reply("Which campaign collected the most cash?").answer,/Warm introductions leads with ₹6\.40L/);
  const diagnosis=reply("Where are we behind?");
  assert.match(diagnosis.answer,/Inbound fast lane.*₹1\.10L/);
  assert.match(reply("Why?",{context:diagnosis.context}).answer,/74%/);
  assert.match(reply("How many cash deals were confirmed on April 11?").answer,/20 cash deals/);
});

test("workspace updates validate inputs and Copilot drafts require an explicit save",()=>{
  const state=initial();
  const draft=answerQuestion({q:"Draft a follow-up task for inbound fast lane"},state).draft;
  assert.equal(state.tasks.length,3);
  assert.equal(draft.campaign,"inbound");
  applyChange(state,{kind:"create-task",task:draft});
  assert.equal(state.tasks.length,4);
  const id=state.tasks.at(-1).id;
  applyChange(state,{kind:"edit-task",task:{...state.tasks.at(-1),id,status:"Done"}});
  assert.equal(state.tasks.at(-1).status,"Done");
  assert.throws(()=>applyChange(state,{kind:"update-campaign",id:"creator",values:{...state.campaigns.creator,paid:999}}),/previous stage/);
  applyChange(state,{kind:"update-campaign",id:"creator",values:{...state.campaigns.creator,cash:550000}});
  assert.match(answerQuestion({q:"How much has the current workspace collected in cash?"},state).answer,/₹10\.50L/);
  assert.equal(historicalQuery(new URLSearchParams("date=2025-03-15&brand=A001")).snapshot.signedValue,200000);
});
