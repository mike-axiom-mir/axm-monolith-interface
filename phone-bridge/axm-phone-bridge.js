#!/usr/bin/env node
'use strict';

/* AXM PHONE MONOLITH BRIDGE v0.1.1
   Runs on the Android phone itself (Termux + Node).
   Default: 127.0.0.1:8787 only. It serves the phone UI and provides a
   narrow local doorway to the installed monolith identity plus optional
   local/Claude/OpenAI intelligence. No laptop is required.
*/

const http=require('http');
const https=require('https');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const HOST=process.env.AXM_PHONE_BRIDGE_HOST||'127.0.0.1';
const PORT=Number(process.env.AXM_PHONE_BRIDGE_PORT||8787);
const RATE=Number(process.env.AXM_PHONE_BRIDGE_RATE||30);
const ROOT=path.resolve(__dirname,'..');
const STATE_DIR=path.resolve(process.env.AXM_PHONE_STATE_DIR||path.join(ROOT,'phone-state'));
const TOKEN_FILE=path.join(STATE_DIR,'phone-bridge-token.txt');
const LOG_FILE=path.join(STATE_DIR,'phone-bridge.log');
const SAVED_MANIFEST=path.join(STATE_DIR,'monolith-manifest.json');
const MONOLITH_ROOT=process.env.AXM_PHONE_MONOLITH_ROOT?path.resolve(process.env.AXM_PHONE_MONOLITH_ROOT):'';
const EXPLICIT_MANIFEST=process.env.AXM_PHONE_MONOLITH_MANIFEST?path.resolve(process.env.AXM_PHONE_MONOLITH_MANIFEST):'';
const LOCAL_URL=(process.env.AXM_PHONE_LOCAL_URL||'').replace(/\/+$/,'');

fs.mkdirSync(STATE_DIR,{recursive:true});

function audit(message){
  const row=new Date().toISOString()+'  '+message;
  try{console.log('[phone-bridge] '+message);}catch(_){ }
  try{fs.appendFileSync(LOG_FILE,row+'\n');}catch(_){ }
}
function token(){
  let t='';try{t=fs.readFileSync(TOKEN_FILE,'utf8').trim();}catch(_){ }
  if(!t){t=crypto.randomBytes(24).toString('hex');fs.writeFileSync(TOKEN_FILE,t+'\n',{mode:0o600});}
  return t;
}
const TOKEN=token();
function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function selfOrigins(){return [`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`];}
function allowed(req){
  const origin=String(req.headers.origin||'');
  if(origin&&selfOrigins().includes(origin))return 'origin:'+origin;
  if(req.headers['sec-fetch-site']==='same-origin')return 'same-origin';
  const t=req.headers['x-axm-token'];
  if(t&&safeEqual(t,TOKEN))return 'token';
  return null;
}
function headers(req){
  const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  const o=String(req.headers.origin||'');
  if(o&&selfOrigins().includes(o)){
    h['access-control-allow-origin']=o;
    h['access-control-allow-headers']='content-type,x-axm-token';
    h['access-control-allow-methods']='GET,POST,OPTIONS';
  }
  return h;
}
function send(req,res,status,obj){res.writeHead(status,headers(req));res.end(JSON.stringify(obj));}
function readBody(req,max=5e6){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d;if(s.length>max){reject(new Error('request too large'));req.destroy();}});req.on('end',()=>resolve(s));req.on('error',reject);});}

const MANIFEST_CANDIDATES=['axm-cartridge.json','AXM_MONOLITH_MANIFEST.json','monolith-manifest.json','manifest.json'];
function manifestCandidates(){
  const list=[];
  if(EXPLICIT_MANIFEST)list.push(EXPLICIT_MANIFEST);
  list.push(SAVED_MANIFEST);
  if(MONOLITH_ROOT)for(const n of MANIFEST_CANDIDATES)list.push(path.join(MONOLITH_ROOT,n));
  return [...new Set(list)];
}
function validateManifest(v){
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('manifest must be a JSON object');
  if(!v.id&&!v.name)throw new Error('manifest requires id or name');
  return v;
}
function loadManifest(){
  for(const p of manifestCandidates()){
    try{if(!fs.existsSync(p))continue;const raw=JSON.parse(fs.readFileSync(p,'utf8'));return {manifest:validateManifest(raw),source:p};}catch(err){audit('manifest candidate rejected '+p+' · '+err.message);}
  }
  return {manifest:null,source:null};
}
function boundedContext(m){
  if(!m)return 'No phone monolith manifest is currently identified. Do not claim monolith capabilities.';
  const caps=Array.isArray(m.capabilities)?m.capabilities:[];
  const shown=caps.slice(0,128).map((c,i)=>{
    if(typeof c==='string')return c+':declared';
    const obj=c&&typeof c==='object'?c:{};
    const id=String(obj.id||obj.name||`cap-${i+1}`);
    const status=typeof obj.status==='string'&&obj.status?obj.status:(obj.verified===true?'verified':'declared');
    return id+':'+status;
  });
  return [
    'You are connected through the AXM phone-local monolith bridge.',
    `Monolith: ${String(m.name||m.id)} (${String(m.id||m.name)}) version ${String(m.version||'unknown')}.`,
    `Capabilities declared in manifest: ${caps.length}. Context sample: ${shown.join(', ')||'none'}.`,
    caps.length>shown.length?`Capability context truncated to ${shown.length}; do not infer unseen capability details.`:'',
    'Declared is not verified. A conversation reply is not execution evidence.',
    'Preserve Truth, Agency/non-domination, Continuity, and Wisdom before speed.'
  ].filter(Boolean).join('\n');
}

let stamps=[];
function overRate(){const n=Date.now();stamps=stamps.filter(t=>n-t<60000);if(stamps.length>=RATE)return true;stamps.push(n);return false;}

function jsonRequest(urlString,method,extraHeaders,body){
  return new Promise((resolve,reject)=>{
    const u=new URL(urlString);const lib=u.protocol==='https:'?https:http;const data=body==null?'':String(body);
    const req=lib.request({hostname:u.hostname,port:u.port||undefined,path:u.pathname+u.search,method,headers:Object.assign({},extraHeaders||{},data?{'content-length':Buffer.byteLength(data)}:{})},res=>{let out='';res.on('data',d=>out+=d);res.on('end',()=>{let j;try{j=JSON.parse(out||'{}');}catch(_){return reject(new Error('provider returned non-JSON'));}if(res.statusCode<200||res.statusCode>=300)return reject(new Error((j.error&&j.error.message)||j.error||`provider HTTP ${res.statusCode}`));resolve(j);});});
    req.on('error',reject);if(data)req.write(data);req.end();
  });
}
function firstProvider(){
  if(LOCAL_URL)return 'local';
  if(process.env.ANTHROPIC_API_KEY&&process.env.AXM_PHONE_CLAUDE_MODEL)return 'claude';
  if(process.env.OPENAI_API_KEY&&process.env.AXM_PHONE_OPENAI_MODEL)return 'chatgpt';
  return null;
}
function providerStatus(){
  const claudeModel=process.env.AXM_PHONE_CLAUDE_MODEL||'';
  const openaiModel=process.env.AXM_PHONE_OPENAI_MODEL||'';
  return {
    local:{configured:!!LOCAL_URL,url:LOCAL_URL||null,model:process.env.AXM_PHONE_LOCAL_MODEL||'local-model'},
    claude:{configured:!!process.env.ANTHROPIC_API_KEY&&!!claudeModel,hasKey:!!process.env.ANTHROPIC_API_KEY,model:claudeModel||null},
    chatgpt:{configured:!!process.env.OPENAI_API_KEY&&!!openaiModel,hasKey:!!process.env.OPENAI_API_KEY,model:openaiModel||null}
  };
}
async function callAI(payload){
  payload=payload&&typeof payload==='object'?payload:{};const opts=payload.opts&&typeof payload.opts==='object'?payload.opts:{};
  let which=String(opts.aiProvider||opts.targetProvider||opts.provider||firstProvider()||'');if(which==='auto'||which==='bridge')which=firstProvider()||'';
  if(!which)throw new Error('no fully configured phone AI provider');
  const loaded=loadManifest();const system=[boundedContext(loaded.manifest),String(opts.system||'')].filter(Boolean).join('\n\n');
  const messages=Array.isArray(payload.messages)?payload.messages:[];
  if(which==='local'){
    if(!LOCAL_URL)throw new Error('local provider not configured; set AXM_PHONE_LOCAL_URL');
    const body=JSON.stringify({model:opts.model||process.env.AXM_PHONE_LOCAL_MODEL||'local-model',messages:system?[{role:'system',content:system},...messages]:messages,max_tokens:Number(opts.maxTokens||1024),temperature:typeof opts.temperature==='number'?opts.temperature:0});
    const j=await jsonRequest(LOCAL_URL+'/v1/chat/completions','POST',{'content-type':'application/json'},body);
    return {text:String(j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||''),provider:'local'};
  }
  if(which==='claude'){
    const key=process.env.ANTHROPIC_API_KEY||'';const model=String(opts.model||process.env.AXM_PHONE_CLAUDE_MODEL||'');
    if(!key)throw new Error('ANTHROPIC_API_KEY not set on phone');if(!model)throw new Error('set AXM_PHONE_CLAUDE_MODEL on phone');
    const body=JSON.stringify({model,max_tokens:Number(opts.maxTokens||1024),messages,system,temperature:typeof opts.temperature==='number'?opts.temperature:0});
    const j=await jsonRequest('https://api.anthropic.com/v1/messages','POST',{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body);
    const text=Array.isArray(j.content)?j.content.filter(x=>x&&x.type==='text').map(x=>x.text||'').join('\n'):'';return {text,provider:'claude'};
  }
  if(which==='chatgpt'){
    const key=process.env.OPENAI_API_KEY||'';const model=String(opts.model||process.env.AXM_PHONE_OPENAI_MODEL||'');
    if(!key)throw new Error('OPENAI_API_KEY not set on phone');if(!model)throw new Error('set AXM_PHONE_OPENAI_MODEL on phone');
    const body=JSON.stringify({model,messages:system?[{role:'system',content:system},...messages]:messages,max_completion_tokens:Number(opts.maxTokens||1024),temperature:typeof opts.temperature==='number'?opts.temperature:0});
    const j=await jsonRequest('https://api.openai.com/v1/chat/completions','POST',{'content-type':'application/json','authorization':'Bearer '+key},body);
    return {text:String(j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||''),provider:'chatgpt'};
  }
  throw new Error('unknown provider: '+which);
}

const STATIC={
  '/':path.join(ROOT,'mobile','phone-local.html'),
  '/mobile/':path.join(ROOT,'mobile','phone-local.html'),
  '/mobile/phone-local.html':path.join(ROOT,'mobile','phone-local.html'),
  '/mobile/index.html':path.join(ROOT,'mobile','index.html'),
  '/shared/host-core.js':path.join(ROOT,'shared','host-core.js'),
  '/shared/chat-transport.js':path.join(ROOT,'shared','chat-transport.js')
};
function staticType(p){return p.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8';}
function serveStatic(req,res){const p=STATIC[req.url];if(!p)return false;try{const b=fs.readFileSync(p);res.writeHead(200,{'content-type':staticType(p),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(b);}catch(err){res.writeHead(500,{'content-type':'text/plain'});res.end('AXM phone UI file missing: '+err.message);}return true;}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){const h=headers(req);res.writeHead(204,h);return res.end();}
  if(req.method==='GET'&&serveStatic(req,res))return;
  if(req.method==='GET'&&req.url==='/health'){
    const m=loadManifest();return send(req,res,200,{ok:true,locked:true,mode:'phone-local-monolith-bridge',host:HOST,port:PORT,monolith:{identified:!!m.manifest,source:m.source,id:m.manifest&&String(m.manifest.id||m.manifest.name),name:m.manifest&&String(m.manifest.name||m.manifest.id),version:m.manifest&&String(m.manifest.version||'unknown'),root:MONOLITH_ROOT||null},providers:providerStatus()});
  }
  if(req.method==='GET'&&req.url==='/monolith'){
    const pass=allowed(req);if(!pass)return send(req,res,403,{error:'refused: phone bridge local UI/token required'});
    const m=loadManifest();if(!m.manifest)return send(req,res,404,{error:'no monolith manifest identified',candidates:manifestCandidates()});
    return send(req,res,200,{ok:true,manifest:m.manifest,source:m.source});
  }
  if(req.method==='POST'&&req.url==='/monolith/install-manifest'){
    const pass=allowed(req);if(!pass)return send(req,res,403,{error:'refused: phone bridge local UI/token required'});
    try{const body=JSON.parse(await readBody(req));const manifest=validateManifest(body.manifest||body);fs.writeFileSync(SAVED_MANIFEST,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});audit('monolith manifest installed via '+pass+' · '+String(manifest.id||manifest.name));return send(req,res,200,{ok:true,path:SAVED_MANIFEST,id:String(manifest.id||manifest.name)});}catch(err){return send(req,res,400,{error:String(err.message||err)});}
  }
  if(req.method==='POST'&&req.url==='/ask'){
    const pass=allowed(req);if(!pass){audit('REFUSED /ask');return send(req,res,403,{error:'refused: phone bridge local UI/token required'});}if(overRate())return send(req,res,429,{error:`phone bridge rate cap: ${RATE}/min`});
    try{const payload=JSON.parse(await readBody(req));audit('ask via '+pass+' · '+((payload.messages&&payload.messages.length)||0)+' message(s)');const r=await callAI(payload);return send(req,res,200,r);}catch(err){audit('ask error · '+String(err.message||err));return send(req,res,502,{error:String(err.message||err)});}
  }
  return send(req,res,404,{error:'not found'});
});

server.listen(PORT,HOST,()=>{
  const m=loadManifest();
  audit(`phone bridge up on http://${HOST}:${PORT} · monolith:${m.manifest?'identified':'not-identified'} · providers:${JSON.stringify(providerStatus())}`);
  console.log('Open on this phone: http://127.0.0.1:'+PORT+'/');
  console.log('Non-browser machine token: '+TOKEN_FILE);
  if(!m.manifest)console.log('Monolith manifest not identified yet. Set AXM_PHONE_MONOLITH_MANIFEST, AXM_PHONE_MONOLITH_ROOT, or install one through /monolith/install-manifest.');
});
