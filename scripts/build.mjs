import {readFile,readdir,mkdir,writeFile,copyFile} from "node:fs/promises";
const blog = "https://github.com/dharavathshivaji5522/risa-sponsor-desk";
const root = new URL("../docs/",import.meta.url);
const at = file => new URL(file,root);
await mkdir(root,{recursive:true});
for(const asset of await readdir("public")) await copyFile(`public/${asset}`,at(asset));
const history=JSON.parse(await readFile("data/history.json","utf8"));
history.links.sponsorship=blog+"/blob/main/data/sponsorship-original.xlsx";
history.links.attendee=blog+"/blob/main/data/attendee-original.xlsx";
const plan=JSON.stringify(JSON.parse(await readFile("data/plan.json","utf8")));
const analytics=await readFile("src/analytics.js","utf8");
const worker=await readFile("src/worker.js","utf8");
const metrics=await readFile("src/copilot-metrics.js","utf8");
const scenarios=await readFile("src/copilot-scenarios.js","utf8");
const copilot=await readFile("src/copilot.js","utf8");
await Promise.all([
  writeFile(at("engine.js"),`const PLAN=${plan};\n${analytics}`),
  writeFile(at("workspace-worker.js"),`const DATA=${JSON.stringify(history)};\nconst PLAN=${plan};\n${analytics}\n${metrics}\n${scenarios}\n${copilot}\n${worker}`),
  copyFile("data/sponsorship-original.xlsx",at("sponsorship-original.xlsx")),
  copyFile("data/attendee-original.xlsx",at("attendee-original.xlsx")),
  writeFile(at(".nojekyll"),"")
]);
console.log("GitHub Pages files built in docs/.");
