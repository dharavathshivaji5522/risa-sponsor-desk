import test from "node:test";
import assert from "node:assert/strict";
import {engine} from "./fixture.mjs";
import {cases,conversation} from "./copilot-cases.mjs";

const {initial,answerQuestion,applyChange}=engine;
for(const {category,question,expected} of cases) {
  test("["+category+"] "+question,()=>{
    const state=initial();
    const saved=JSON.stringify(state);
    const {answer}=answerQuestion({q:question},state);
    for(const phrase of expected) assert.ok(answer.includes(phrase),"Missing "+phrase+" in:\n"+answer);
    assert.equal(JSON.stringify(state),saved,"Chat must leave saved data alone");
  });
}

test("15-turn workflow retains context, changes scopes, and gates execution",async t=>{
  const state=initial();
  let context={}, draft;
  for(const [q,phrase,expectedContext] of conversation) await t.test(q,()=>{
    const result=answerQuestion({q,context},state);
    assert.ok(result.answer.includes(phrase),result.answer);
    if(result.draft) draft=result.draft;
    if(expectedContext) for(const [key,value] of Object.entries(expectedContext)) assert.equal(result.context[key],value);
    context=result.context||context;
    assert.equal(state.tasks.length,3);
  });
  assert.ok(draft);
  assert.equal(draft.campaign,"inbound");
  assert.equal(draft.owner,"Kabir");
  assert.equal(draft.due,"2025-03-29");
  assert.equal(draft.status,"To do");
  assert.match(draft.note,/85%/);
  applyChange(state,{kind:"create-task",task:draft});
  assert.match(answerQuestion({q:"Show Kabir’s tasks for inbound."},state).answer,/Assign one triage owner/);
});

test("multi-part questions answer both metrics while preserving carry-over",()=>{
  const result=answerQuestion({q:"How many paid deals are there? And what is the remaining budget?"},initial());
  assert.match(result.answer,/10 paid deals/);
  assert.match(result.answer,/₹47,000/);
  assert.equal(result.refs.length,1);
});

test("historical filter scope gets discarded when an explicit workspace is requested",()=>{
  const input={scope:"history",brand:"A001",date:"2025-03-15"};
  assert.match(answerQuestion({...input,q:"How much confirmed cash value?"},initial()).answer,/₹2,00,000/);
  assert.match(answerQuestion({...input,q:"How much has the current workspace collected?"},initial()).answer,/₹9,50,000/);
});

test("zero denominators do not poison other campaigns or create NaN",()=>{
  const state=initial();
  for(const row of Object.values(state.campaigns)) Object.assign(row,{prospects:0,conversations:0,proposals:0,signed:0,paid:0,signedValue:0,spend:0,cash:0});
  for(const q of ["Which campaign has the highest cost per paid deal?","Proposal-to-deal conversion rate?", "Cash realization ratio?","Cash collected per rupee spent?"]) {
    const {answer}=answerQuestion({q},state);
    assert.match(answer,/undefined/i);
    assert.doesNotMatch(answer,/NaN|Infinity/);
  }
});

test("live questions use edited receipts, spending, and conversion counts",()=>{
  const state=initial();
  applyChange(state,{kind:"update-campaign",id:"inbound",values:{...state.campaigns.inbound,signed:4,paid:3,signedValue:390000,cash:260000,spend:24000}});
  const cases=[
    ["How much cash collected?",/₹10,10,000/],
    ["Total signed cash value?",/₹20,55,000/],
    ["How much remains unpaid?",/₹10,45,000/],
    ["Proposal closing rate?",/42.22%/],
    ["Inbound cash realization?",/66.67%/],
    ["Inbound cost per paid deal?",/₹8,000/],
    ["Remaining budget?",/₹38,000/],
    ["How much is the combined inbound and revival spend?",/₹32,000/]
  ];
  for(const [q,expected] of cases) assert.match(answerQuestion({q},state).answer,expected);
});
