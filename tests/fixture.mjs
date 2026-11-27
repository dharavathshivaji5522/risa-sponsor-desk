import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

export const fixture = file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const source=["analytics","copilot-metrics","copilot-scenarios","copilot"].map(name=>fixture("src/"+name+".js")).join("\n");
const validation=fixture("src/worker.js").split("const database =")[0];
export const engine=runInNewContext(
  "const DATA="+fixture("data/history.json")+"; const PLAN="+fixture("data/plan.json")+";"+
  source+"\n"+validation+
  ";({DATA,PLAN,getHistorySnapshot,attendance,overview,initial,forecast,decision,planRow,answerQuestion,applyChange,historicalQuery,workspaceRecord,metricValue,metrics,parseScenario,simulateCampaign})",
  {crypto}
);
