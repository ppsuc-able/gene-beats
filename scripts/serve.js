// Optional local preview. The site also works by opening dist/index.html directly.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/bio.js':'bio.js','/app.js':'app.js'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(root,file),(err,data)=>{if(err){res.writeHead(500);res.end('Read error');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]});res.end(data);});
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
