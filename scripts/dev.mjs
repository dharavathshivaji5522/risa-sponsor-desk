import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {extname,basename} from "node:path";
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".woff2":"font/woff2",".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",".pdf":"application/pdf"};
createServer(async (req,res)=>{
  const url=new URL(req.url,"http://127.0.0.1");
  const path=url.pathname.replace(/^\/risa-sponsor-desk/,"");
  const file=path==="/"||!path?"index.html":basename(path);
  try{const data=await readFile(new URL(`../docs/${file}`,import.meta.url));res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream"}).end(data);}
  catch{res.writeHead(404).end("Not found");}
}).listen(Number(process.env.PORT||8797),"127.0.0.1",()=>console.log(`http://127.0.0.1:${process.env.PORT||8797}/risa-sponsor-desk/`));
