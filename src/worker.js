class RequestError extends Error {}

const validateNumber = (value,max,min=0) => Number.isInteger(value) && value>=min && value<=max;
const counters = ["prospects","conversations","proposals","signed","paid"];
const amounts = ["signedValue","cash","spend"];
const campaignFields = [...counters,...amounts,"sample","signal"];

function campaignValues(values,{allowLegacySigned=false}={}) {
  if (!values || typeof values!=="object" || Array.isArray(values)) throw new RequestError("Enter the campaign figures.");
  if (![...counters,"sample"].every(key=>validateNumber(values[key],100000)) ||
      !amounts.every(key=>validateNumber(values[key],1000000000)) ||
      !Number.isFinite(values.signal) || values.signal<0 || values.signal>100) {
    throw new RequestError("Enter whole counts from 0 to 100,000, whole rupees from 0 to 1,000,000,000, and a signal from 0% to 100%.");
  }
  if (counters.some((key,index)=>index>0&&values[counters[index-1]]<values[key])) throw new RequestError("Each funnel stage must be no higher than the previous stage.");
  if (values.cash>values.signedValue) throw new RequestError("Cash received cannot exceed signed cash value.");
  if (Boolean(values.paid)!==Boolean(values.cash)) throw new RequestError("Enter both paid deals and cash received, or set both to zero.");
  if ((!values.signed && values.signedValue) || (values.signed && !values.signedValue && !allowLegacySigned)) {
    throw new RequestError("Enter both signed deals and signed cash value, or set both to zero.");
  }
  return Object.fromEntries(campaignFields.map(key=>[key,values[key]]));
}
function campaignChange(state,input) {
  if (typeof input.id!=="string" || !Object.hasOwn(state.campaigns,input.id)) throw new RequestError("Choose a valid campaign.");
  state.campaigns[input.id]=campaignValues(input.values);
}
const statuses=["To do","In progress","Done"];
function taskValues(state,task) {
  if (!task || !Object.hasOwn(state.campaigns,task.campaign) || typeof task.title!=="string" || !task.title.trim() || task.title.length>110 ||
      typeof task.owner!=="string" || !task.owner.trim() || task.owner.length>50 || typeof task.note!=="string" || task.note.length>450 ||
      !validIsoDate(task.due) || !statuses.includes(task.status)) throw new RequestError("Provide a title, owner, valid due date, campaign, and status.");
  return {title:task.title.trim(),campaign:task.campaign,owner:task.owner.trim(),due:task.due,status:task.status,note:task.note.trim()};
}
const taskKey = id=>typeof id==="string" && /^(?:t-[1-3]|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(id);
function taskChange(state,input) {
  const task=input.task;
  const edited=taskValues(state,task);
  if (input.kind==="create-task") {
    const id=task.id??crypto.randomUUID();
    if (!taskKey(id)) throw new RequestError("The task identifier is invalid. Reopen the task form.");
    const existing=state.tasks.find(row=>row.id===id);
    if (existing) {
      if (Object.entries(edited).every(([key,value])=>existing[key]===value)) return;
      throw new RequestError("This draft was already saved. Open it in Tasks to make changes.");
    }
    if(state.tasks.length>=100) throw new RequestError("The demo workspace supports up to 100 tasks.");
    state.tasks.push({...edited,id});
  } else {
    const index=state.tasks.findIndex(t=>t.id===task.id);
    if(index<0) throw new RequestError("Task was not found.");
    state.tasks[index]={...edited,id:task.id};
  }
}

function applyChange(state,input) {
  if (input?.kind==="update-campaign") campaignChange(state,input);
  else if (["create-task","edit-task"].includes(input?.kind)) taskChange(state,input);
  else throw new RequestError("Unknown workspace action.");
  return state;
}

function historicalQuery(query) {
    const date=query.get("date")||historyDate;
    const campaign=query.get("campaign")||undefined;
    const brand=query.get("brand")||undefined;
    if(!validIsoDate(date)||date<"2025-01-15"||date>"2025-04-20")
      throw new RequestError("Choose a history date from January 15 to April 20, 2025.");
    if (campaign&&!DATA.sponsor["Sponsor campaigns"].some(c=>c.sponsor_campaign_id===campaign)) throw new RequestError("Unknown historical campaign.");
    if (brand&&!DATA.sponsor.Brands.some(b=>b.brand_id===brand)) throw new RequestError("Unknown historical brand.");
    const s=getHistorySnapshot(date,{campaign,brand});
    return {snapshot:s,channels:DATA.sponsor["Sponsor campaigns"].map(c=>({id:c.sponsor_campaign_id,name:c.campaign_name})),
      brands:DATA.sponsor.Brands.map(b=>({id:b.brand_id,name:b.brand_name})).sort((a,b)=>a.name.localeCompare(b.name)),
      link:DATA.links.sponsorship,attendanceLink:DATA.links.attendee,activities:s.activations.map(a=>({...a,visitors:attendance(a.id,date)}))};
}

function workspaceRecord(saved) {
  if (saved===undefined) return {state:initial(),revision:0};
  const {state,revision}=saved??{};
  try {
    if (!Number.isSafeInteger(revision) || revision<0 || revision>=Number.MAX_SAFE_INTEGER ||
        !state?.campaigns || !Array.isArray(state.tasks) || state.tasks.length>100 ||
        Object.keys(state.campaigns).length!==PLAN.campaigns.length) throw new Error();
    for (const {id} of PLAN.campaigns) {
      const actual=state.campaigns[id];
      // Earlier builds allowed a positive signed count without a signed value.
      // Preserve those existing records. A subsequent edit must set the value.
      campaignValues(actual,{allowLegacySigned:true});
    }
    const ids=new Set();
    for (const task of state.tasks) {
      if (!taskKey(task?.id) || ids.has(task.id)) throw new Error();
      ids.add(task.id);
      taskValues(state,task);
    }
    return saved;
  } catch {
    throw new RequestError("Saved workspace records could not be read. The stored data is still available in this browser. Open the app in a fresh browser profile to use the demo.");
  }
}

const database = new Promise((resolve,reject)=>{
  const request=indexedDB.open("risa-sponsor-desk",1);
  request.onupgradeneeded=()=>request.result.createObjectStore("workspace");
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new RequestError("Browser storage is unavailable. Allow site data and reload."));
  request.onblocked=()=>reject(new RequestError("Close other Sponsor Desk tabs and reload."));
});
async function loadWorkspace(){
  const db=await database;
  return new Promise((resolve,reject)=>{
    const request=db.transaction("workspace").objectStore("workspace").get("draft");
    request.onsuccess=()=>{
      try { resolve(workspaceRecord(request.result)); }
      catch (error) { reject(error); }
    };
    request.onerror=()=>reject(new RequestError("The workspace could not be loaded."));
  });
}

async function saveWorkspace(input){
  const db=await database;
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction("workspace","readwrite");
    const store=transaction.objectStore("workspace");
    const read=store.get("draft");
    let result;
    let error;
    read.onsuccess=()=>{
      try{
        const current=workspaceRecord(read.result);
        const existing=input?.kind==="create-task" && current.state.tasks.find(task=>task.id===input.task?.id);
        if (existing) {
          applyChange(current.state,input);
          result=current;
          return;
        }
        if(current.revision!==input?.revision) throw new RequestError("This workspace changed in another tab. Reopen the editor and try again.");
        result={state:applyChange(current.state,input),revision:current.revision+1};
        store.put(result,"draft");
      }catch(cause){error=cause;transaction.abort();}
    };
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(error||new RequestError("Browser storage could not save the change."));
    transaction.onerror=()=>reject(new RequestError("Browser storage could not save the change."));
  });
}

async function handle(method,path,input) {
  const url=new URL(path,self.location.origin);
  if(url.pathname==="/api/workspace") return method==="GET"?loadWorkspace():saveWorkspace(input);
  if(url.pathname==="/api/history"&&method==="GET")return historicalQuery(url.searchParams);
  if(url.pathname==="/api/ask"&&method==="POST"){
    if(typeof input?.q!=="string"||!input.q.trim()||input.q.length>600) throw new RequestError("Enter a question of up to 600 characters.");
    return answerQuestion(input,(await loadWorkspace()).state);
  }
  throw new RequestError("That request was not recognized.");
}

self.addEventListener("message",async ({data:{id,method,path,input}})=>{
  try{
    self.postMessage({id,result:await handle(method,path,input)});
  }catch(error){
    self.postMessage({id,error:error instanceof RequestError?error.message:"The workspace could not complete the request."});
  }
});
