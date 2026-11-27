class RequestError extends Error {}

const validateNumber = (value,max,min=0) => Number.isInteger(value) && value>=min && value<=max;
const counters = ["prospects","conversations","proposals","signed","paid"];
const amounts = ["signedValue","cash","spend"];
function campaignChange(state,input) {
  const id=input.id, values=input.values;
  if (typeof id!=="string" || !Object.hasOwn(state.campaigns,id) || !values || typeof values!=="object") throw new RequestError("Choose a valid campaign.");
  if (![...counters,"sample"].every(key=>validateNumber(values[key],100000)) ||
      !amounts.every(key=>validateNumber(values[key],1000000000)) ||
      typeof values.signal!=="number" || !Number.isFinite(values.signal) || values.signal<0||values.signal>100)
    throw new RequestError("Use whole non-negative counts and rupees. The signal must be 0% to 100%.");
  if (counters.some((key,index)=>index>0&&values[counters[index-1]]<values[key])) throw new RequestError("Each funnel stage must be no higher than the previous stage.");
  if (values.cash>values.signedValue || (values.cash>0&&!values.paid) || (values.paid>0&&!values.cash) || (values.signedValue>0&&!values.signed)) {
    throw new RequestError("Align paid deals and receipts with signed value and signed deals.");
  }
  state.campaigns[id] = Object.fromEntries([...counters,...amounts,"sample","signal"].map(key=>[key,values[key]]));
}
const statuses=["To do","In progress","Done"];
function taskChange(state,input) {
  const task=input.task;
  if (!task || !Object.hasOwn(state.campaigns,task.campaign) || typeof task.title!=="string" || !task.title.trim() || task.title.length>110 ||
      typeof task.owner!=="string" || !task.owner.trim() || task.owner.length>50 || typeof task.note!=="string" || task.note.length>450 ||
      typeof task.due!=="string" || !/^20\d\d-\d\d-\d\d$/.test(task.due) || !Number.isFinite(Date.parse(task.due)) ||
      new Date(task.due).toISOString().slice(0,10)!==task.due || !statuses.includes(task.status)) throw new RequestError("Provide a title, owner, valid due date, campaign, and status.");
  const edited={title:task.title.trim(),campaign:task.campaign,owner:task.owner.trim(),due:task.due,status:task.status,note:task.note.trim()};
  if (input.kind==="create-task") {
    if(state.tasks.length>=100) throw new RequestError("The demo workspace supports up to 100 tasks.");
    state.tasks.push({...edited,id:crypto.randomUUID()});
  } else {
    const index=state.tasks.findIndex(t=>t.id===task.id);
    if(index<0) throw new RequestError("Task was not found.");
    state.tasks[index]={...edited,id:task.id};
  }
}

function applyChange(state,input) {
  if (input.kind==="update-campaign") campaignChange(state,input);
  else if (["create-task","edit-task"].includes(input.kind)) taskChange(state,input);
  else throw new RequestError("Unknown workspace action.");
  return state;
}

function historicalQuery(query) {
    const date=query.get("date")||historyDate;
    const campaign=query.get("campaign")||undefined;
    const brand=query.get("brand")||undefined;
    if(!/^2025-\d\d-\d\d$/.test(date)||date<"2025-01-15"||date>"2025-04-20"||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)
      throw new RequestError("Choose a history date from January 15 to April 20, 2025.");
    if (campaign&&!DATA.sponsor["Sponsor campaigns"].some(c=>c.sponsor_campaign_id===campaign)) throw new RequestError("Unknown historical campaign.");
    if (brand&&!DATA.sponsor.Brands.some(b=>b.brand_id===brand)) throw new RequestError("Unknown historical brand.");
    const s=getHistorySnapshot(date,{campaign,brand});
    return {snapshot:s,channels:DATA.sponsor["Sponsor campaigns"].map(c=>({id:c.sponsor_campaign_id,name:c.campaign_name})),
      brands:DATA.sponsor.Brands.map(b=>({id:b.brand_id,name:b.brand_name})).sort((a,b)=>a.name.localeCompare(b.name)),
      link:DATA.links.sponsorship,attendanceLink:DATA.links.attendee,activities:s.activations.map(a=>({...a,visitors:attendance(a.id,date)}))};
}

const database = new Promise((resolve,reject)=>{
  const request=indexedDB.open("risa-sponsor-desk",1);
  request.onupgradeneeded=()=>request.result.createObjectStore("workspace");
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new RequestError("Browser storage is unavailable. Allow site data and reload."));
  request.onblocked=()=>reject(new RequestError("Close other Sponsor Desk tabs and reload."));
});
const seeded=()=>({state:initial(),revision:0});

async function loadWorkspace(){
  const db=await database;
  return new Promise((resolve,reject)=>{
    const request=db.transaction("workspace").objectStore("workspace").get("draft");
    request.onsuccess=()=>resolve(request.result||seeded());
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
      const current=read.result||seeded();
      if(current.revision!==input.revision){
        error=new RequestError("This workspace changed in another tab. Refresh and retry.");
        transaction.abort();
        return;
      }
      try{
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
    if(typeof input.q!=="string"||!input.q.trim()||input.q.length>600) throw new RequestError("Enter a question of up to 600 characters.");
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
