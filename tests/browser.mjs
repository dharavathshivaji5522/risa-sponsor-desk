import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";

const require=createRequire(import.meta.url);
const playwright=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base=process.env.SPONSOR_DESK_URL || "http://127.0.0.1:8797/risa-sponsor-desk/";
const engines=(process.env.SPONSOR_DESK_ENGINES || "chromium").split(",");
const wait=async (page,selector,phrase)=>page.locator(selector).filter({hasText:phrase}).first().waitFor({timeout:12000});
const navigate=(page,name)=>page.locator("nav").getByRole("button",{name,exact:true}).click();
const campaign=(page,id)=>page.locator('[data-campaign="'+id+'"]');
const field=(page,name)=>page.locator('#edit-form [name="'+name+'"]');
const button=(page,name)=>page.getByRole("button",{name,exact:true});
const kpi=(page,title)=>page.locator("#main-view .kpi").filter({hasText:title});

async function ask(page,question,expected,{keyboard=false}={}) {
  const chat=page.locator("#chat .message.answer:not(.typing)");
  const count=await chat.count();
  const input=page.getByRole("textbox",{name:"Message Sponsor Desk"});
  await input.fill(question);
  if(keyboard)await input.press("Enter");
  else await button(page,"Send question").click();
  const next=chat.nth(count);
  await next.waitFor({timeout:12000});
  assert.match(await next.innerText(),expected);
  return next;
}

for(const engine of engines) {
  test(engine+" · live workspace through linked workflows",{timeout:120000},async t=>{
    const executablePath=engine==="chromium" ? process.env.CHROMIUM_EXECUTABLE : undefined;
    const browser=await playwright[engine].launch({headless:true,executablePath});
    t.after(()=>browser.close());
    const ctx=await browser.newContext({viewport:{width:1440,height:1040},acceptDownloads:true});
    const page=await ctx.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",msg=>{if(msg.type()==="error") errors.push(msg.text());});
    const title="Recheck inbound replies within one day";
    const task=()=>page.locator(".task-item").filter({hasText:title});
    await t.test("public URL loads date-stamped baseline and all dashboard KPIs",async()=>{
      const response=await page.goto(base);
      assert.equal(response.status(),200);
      await wait(page,"#main-view","Cash performance");
      assert.deepEqual(await page.locator("#main-view .kpi strong").allTextContents(),["₹9.50L","₹26.35L","₹1.11L","₹73,000"]);
      assert.match(await kpi(page,"On-time forecast").innerText(),/₹27.46L scenario target/);
    });
    await t.test("funnel counts, signed value, and conversion are consistent",async()=>{
      assert.deepEqual(await page.locator(".funnel-row b").allTextContents(),["174","75","45","18","10"]);
      await wait(page,"#main-view","₹19.65L signed");
      await wait(page,".funnel-note","Proposals to signed (40%)");
      assert.equal(await page.locator(".channel-line").count(),5);
    });
    await t.test("typed analysis reports verified proposal conversion and arithmetic",async()=>{
      await ask(page,"Calculate the overall proposal-to-deal conversion rate.",/40%.*18 signed deals.*45 proposals/);
      await ask(page,"Add the budgets for inbound and revival.",/₹39,000.*₹25,000 \+ ₹14,000/);
    });
    await t.test("stress queries distinguish balances, funnel counts, and historical evidence",async()=>{
      await ask(page,"How much budget remains?",/remaining acquisition budget.*₹47,000/i);
      await ask(page,"How many proposals are not signed?",/27 \(45 − 18\)[\s\S]*status records are needed/);
      await ask(page,"How many proposals are still open?",/no individual proposal statuses/);
      await ask(page,"What is creator's share of collected cash?",/47\.37%.*₹4,50,000 ÷ ₹9,50,000/);
      await ask(page,"Which campaigns should we scale?",/Creator referrals[\s\S]*Warm introductions/);
      await ask(page,"What is the historical median cash deal?",/₹95,000 across 20 deals/);
      await ask(page,"How much did we collect historically from Beardo?",/₹2,00,000.*Beardo.*Actual payment receipts and cash collection totals are unavailable/);
    });
    await t.test("chat diagnosis, contextual Why, and sensitivity use the same campaign",async()=>{
      await ask(page,"Which campaign has the biggest forecast gap?",/Inbound fast lane.*₹1,10,320/);
      await ask(page,"Why?",/74%.*85%/);
      await ask(page,"How can we improve it?",/Assign one triage owner/);
      await ask(page,"What happens if we improve it to 90%?",/₹6,50,000[\s\S]*Change → Scale/);
    });
    await t.test("draft is read-only and typed confirmation opens no mutation",async()=>{
      await ask(page,"Create a task for this.",/Kabir.*2025-03-29/);
      await navigate(page,"Tasks");
      assert.equal(await page.locator(".task-item").count(),3);
      await ask(page,"Confirm.",/Confirm and save task/);
      assert.equal(await page.locator(".task-item").count(),3);
    });
    await t.test("explicit review saves once, including rapid repeated submits",async()=>{
      await button(page,"Review task draft").click();
      assert.equal(await field(page,"owner").inputValue(),"Kabir");
      assert.equal(await field(page,"due").inputValue(),"2025-03-29");
      await field(page,"title").fill(title);
      await page.locator("#edit-form").evaluate(form=>{
        form.requestSubmit();
        form.requestSubmit();
      });
      await task().waitFor({timeout:12000});
      assert.equal(await task().count(),1);
      assert.equal(await page.locator(".task-item").count(),4);
      assert.equal(await button(page,"Task saved").isDisabled(),true);
    });
    await t.test("saved task is readable by Copilot and editable in Tasks",async()=>{
      await ask(page,"Show Kabir’s open tasks for inbound.",/Recheck inbound replies within one day/);
      await task().getByRole("button",{name:"Edit task"}).click();
      await field(page,"status").selectOption("Done");
      await button(page,"Save task").click();
      await button(page,"Done").click();
      await task().waitFor();
      await ask(page,"Which completed tasks does Kabir have?",/Recheck inbound replies within one day.*Done/);
    });
    await t.test("campaign priority and invalid inputs are visible in the editor",async()=>{
      await navigate(page,"Campaigns");
      await wait(page,".campaign","Priority 4.65 / 5");
      await campaign(page,"creator").click();
      await field(page,"cash").fill("840001");
      await button(page,"Save campaign figures").click();
      await wait(page,"#edit-error","cannot exceed signed cash value");
      assert.equal(await page.locator("#editor").isVisible(),true);
    });
    await t.test("campaign edit immediately updates cash, forecast, budget and Copilot",async()=>{
      await field(page,"cash").fill("550000");
      await field(page,"spend").fill("25000");
      await button(page,"Save campaign figures").click();
      await wait(page,"#toast","Campaign saved");
      await navigate(page,"Overview");
      assert.deepEqual(await page.locator("#main-view .kpi strong").allTextContents(),["₹10.50L","₹26.45L","₹1.01L","₹77,000"]);
      await ask(page,"How much cash has the current workspace collected?",/₹10,50,000/);
      await ask(page,"How much budget is left?",/₹43,000/);
      await ask(page,"What is the new portfolio cash realization?",/53.44%/);
      await ask(page,"What is creator’s share of collected cash?",/52\.38%.*₹5,50,000 ÷ ₹10,50,000/);
    });
    await t.test("refresh preserves edited campaign and task, new browser stays independent",async()=>{
      await page.reload();
      await wait(page,"#main-view","₹10.50L");
      await navigate(page,"Tasks");
      await task().waitFor();
      assert.match(await task().innerText(),/Kabir[\s\S]*Done/);
      const other=await browser.newContext();
      try {
        const fresh=await other.newPage();
        await fresh.goto(base);
        await wait(fresh,"#main-view","₹9.50L");
        await navigate(fresh,"Tasks");
        await wait(fresh,".task-list","Clear inbound lead backlog");
        assert.equal(await fresh.locator(".task-item").count(),3);
      } finally {await other.close();}
    });
    await t.test("base to stretch switch refreshes dashboard and chat",async()=>{
      await navigate(page,"Overview");
      await button(page,"Stretch").click();
      await wait(page,".kpi","₹39.84L");
      await ask(page,"What percentage of the stretch target is funded?",/26.35%/);
      await button(page,"Base").click();
      await wait(page,".kpi","₹27.46L");
    });
    await t.test("original XLSX downloads without login and matches the bundled file",async()=>{
      await navigate(page,"Sources");
      const begin=page.waitForEvent("download");
      await page.getByRole("link",{name:"Download original XLSX",exact:true}).click();
      const download=await begin;
      assert.equal(download.suggestedFilename(),"risa-sponsorship-original.xlsx");
      assert.deepEqual(await readFile(await download.path()),await readFile(new URL("../data/sponsorship-original.xlsx",import.meta.url)));
    });
    await t.test("historical date, brand, and campaign filters control the chart and chat",async()=>{
      const history=page.locator("#history-form");
      await history.locator('[name="date"]').fill("2025-03-15");
      await history.locator('[name="campaign"]').selectOption("SC05");
      await button(page,"Apply").click();
      await wait(page,".history-panel","2025-03-15 EOD");
      await history.locator('[name="campaign"]').selectOption("");
      await history.locator('[name="brand"]').selectOption("A001");
      await button(page,"Apply").click();
      await wait(page,".kpi","₹2.00L");
      await ask(page,"How much confirmed cash value is shown?",/Beardo.*₹2,00,000.*2025-03-15/);
      await ask(page,"Show historical payment receipts.",/no bank receipts/);
      await ask(page,"How much did the current workspace receive in cash?",/₹10,50,000/);
    });
    await t.test("simultaneous tab edits reject stale submissions and preserve the newer revision",async()=>{
      await navigate(page,"Campaigns");
      const peer=await ctx.newPage();
      try {
        await peer.goto(base);
        await navigate(peer,"Campaigns");
        await campaign(peer,"creator").click();
        await campaign(page,"creator").click();
        await field(page,"cash").fill("560000");
        await button(page,"Save campaign figures").click();
        await wait(page,"#toast","Campaign saved");
        await field(peer,"cash").fill("580000");
        await button(peer,"Save campaign figures").click();
        await wait(peer,"#edit-error","another tab");
        await button(peer,"Close editor").click();
        await campaign(peer,"creator").click();
        assert.equal(await field(peer,"cash").inputValue(),"560000");
        await button(peer,"Close editor").click();
      } finally {await peer.close();}
    });
    await t.test("desktop flow reports no uncaught errors or unexpected console errors",()=>{
      assert.deepEqual(errors,[]);
    });
    await t.test("mobile keyboard submission works without horizontal overflow or motion",async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:"reduce"});
      try {
        const phone=await mobile.newPage();
        await phone.goto(base);
        await wait(phone,"#main-view","Cash performance");
        assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=390),true);
        const reply=await ask(phone,"who are you ?",/I'm the Sponsor Desk chatbot/,{keyboard:true});
        assert.equal(await reply.evaluate(node=>getComputedStyle(node).animationName),"none");
        await ask(phone,"How many signed deals did unknown brand ZZZZZ have historically?",/No matching brand/,{keyboard:true});
      } finally {await mobile.close();}
    });
    await t.test("loading starts with the workspace message and resolves after deferred scripts",async()=>{
      const loading=await browser.newContext();
      let resume;
      const gate=new Promise(resolve=>{resume=resolve;});
      await loading.route("**/app.js",async route=>{await gate;await route.continue();});
      try {
        const pending=await loading.newPage();
        await pending.goto(base,{waitUntil:"commit"});
        await wait(pending,"#main-view .loading","Loading the workspace");
        resume();
        await wait(pending,"#main-view","Cash performance");
      } finally {resume();await loading.close();}
    });
    await t.test("corrupt storage reports an error and leaves the saved record untouched",async()=>{
      const isolated=await browser.newContext();
      try {
        const p=await isolated.newPage();
        await p.goto(base);
        await wait(p,"#main-view","Cash performance");
        const stored=async (page,replace)=>page.evaluate(replace=>new Promise((resolve,reject)=>{
          const request=indexedDB.open("risa-sponsor-desk",1);
          request.onerror=()=>reject(request.error);
          request.onsuccess=()=>{
            const db=request.result;
            const transaction=db.transaction("workspace",replace?"readwrite":"readonly");
            const table=transaction.objectStore("workspace");
            const row=replace?table.put({revision:-1,state:{recoveryMarker:"Keep this record"}},"draft"):table.get("draft");
            transaction.oncomplete=()=>{db.close();resolve(row.result);};
            transaction.onerror=()=>reject(transaction.error);
          };
        }),replace);
        await stored(p,true);
        await p.reload();
        await wait(p,"#status-error","Saved workspace records could not be read");
        assert.deepEqual(await stored(p,false),{revision:-1,state:{recoveryMarker:"Keep this record"}});
      } finally {await isolated.close();}
    });
  });
}
