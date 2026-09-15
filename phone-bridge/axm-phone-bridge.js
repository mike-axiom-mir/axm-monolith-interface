#!/usr/bin/env node
'use strict';

/* AXM PHONE MONOLITH BRIDGE v0.4
   Runs on the Android phone itself (Termux + Node).
   Default: 127.0.0.1:8787 only.
   The phone UI can import a monolith ZIP, stage/extract it locally, identify an
   interface manifest when present, and atomically switch the active pointer.
   A locally installed + logged-in Codex CLI is the preferred intelligence seat.
   Shared deterministic interface-organ runtime files are served locally too.
*/

const http=require('http');
const https=require('https');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const childProcess=require('child_process');
const {Transform}=require('stream');
const {pipeline}=require('stream/promises');

const HOST=process.env.AXM_PHONE_BRIDGE_HOST||'127.0.0.1';
const PORT=Number(process.env.AXM_PHONE_BRIDGE_PORT||8787);
const RATE=Number(process.env.AXM_PHONE_BRIDGE_RATE||30);
const MAX_ZIP_BYTES=Number(process.env.AXM_PHONE_MAX_ZIP_BYTES||2147483648);
const MAX_ARCHIVE_ENTRIES=Number(process.env.AXM_PHONE_MAX_ZIP_ENTRIES||250000);
const CODEX_BINARY=process.env.AXM_CODEX_BINARY||'codex';
const CODEX_MODEL=process.env.AXM_PHONE_CODEX_MODEL||'';
const CODEX_TIMEOUT_MS=Number(process.env.AXM_PHONE_CODEX_TIMEOUT_MS||180000);
const ROOT=path.resolve(__dirname,'..');
const STATE_DIR=path.resolve(process.env.AXM_PHONE_STATE_DIR||path.join(ROOT,'phone-state'));
const TOKEN_FILE=path.join(STATE_DIR,'phone-bridge-token.txt');
const LOG_FILE=path.join(STATE_DIR,'phone-bridge.log');
const SAVED_MANIFEST=path.join(STATE_DIR,'monolith-manifest.json');
const ACTIVE_POINTER=path.join(STATE_DIR,'active-monolith.json');
const INCOMING_DIR=path.join(STATE_DIR,'incoming');
const MONOLITHS_DIR=path.join(STATE_DIR,'monoliths');
const ADAPTERS_DIR=path.join(STATE_DIR,'adapters');
const MONOLITH_ROOT=process.env.AXM_PHONE_MONOLITH_ROOT?path.resolve(process.env.AXM_PHONE_MONOLITH_ROOT):'';
const EXPLICIT_MANIFEST=process.env.AXM_PHONE_MONOLITH_MANIFEST?path.resolve(process.env.AXM_PHONE_MONOLITH_MANIFEST):'';
const LOCAL_URL=(process.env.AXM_PHONE_LOCAL_URL||'').replace(/\/+$/,'');

for(const dir of [STATE_DIR,INCOMING_DIR,MONOLITHS_DIR,ADAPTERS_DIR])fs.mkdirSync(dir,{recursive:true});

function audit(message){
  const row=new Date().toISOString()+'  '+message;
  try{console.log('[phone-bridge] '+message);}catch(_){ }
  try{fs.appendFileSync(LOG_FILE,row+'\n');}catch(_){ }
}
function token(){let t='';try{t=fs.readFileSync(TOKEN_FILE,'utf8').trim();}catch(_){ }if(!t){t=crypto.randomBytes(24).toString('hex');fs.writeFileSync(TOKEN_FILE,t+'\n',{mode:0o600});}return t;}
const TOKEN=token();
function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function selfOrigins(){return [`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`];}
function allowed(req){const origin=String(req.headers.origin||'');if(origin&&selfOrigins().includes(origin))return 'origin:'+origin;if(req.headers['sec-fetch-site']==='same-origin')return 'same-origin';const t=req.headers['x-axm-token'];if(t&&safeEqual(t,TOKEN))return 'token';return null;}
function headers(req){const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};const o=String(req.headers.origin||'');if(o&&selfOrigins().includes(o)){h['access-control-allow-origin']=o;h['access-control-allow-headers']='content-type,x-axm-token,x-axm-filename';h['access-control-allow-methods']='GET,POST,OPTIONS';}return h;}
function send(req,res,status,obj){res.writeHead(status,headers(req));res.end(JSON.stringify(obj));}
function readBody(req,max=5e6){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d;if(s.length>max){reject(new Error('request too large'));req.destroy();}});req.on('end',()=>resolve(s));req.on('error',reject);});}
function atomicJson(file,value){const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(_){return null;}}
function activePointer(){const p=readJson(ACTIVE_POINTER);if(!p||!p.root)return null;try{const r=path.resolve(p.root);if(r!==MONOLITHS_DIR&&!r.startsWith(MONOLITHS_DIR+path.sep))return null;if(!fs.existsSync(r))return null;return p;}catch(_){return null;}}

const MANIFEST_CANDIDATES=['axm-cartridge.json','AXM_MONOLITH_MANIFEST.json','AXM_TOTALITY_MANIFEST.json','monolith-manifest.json','manifest.json'];
function manifestCandidates(){const list=[];if(EXPLICIT_MANIFEST)list.push(EXPLICIT_MANIFEST);const active=activePointer();if(active&&active.manifestPath)list.push(active.manifestPath);list.push(SAVED_MANIFEST);if(MONOLITH_ROOT)for(const n of MANIFEST_CANDIDATES)list.push(path.join(MONOLITH_ROOT,n));return [...new Set(list)];}
function validateManifest(v){if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('manifest must be a JSON object');if(!v.id&&!v.name)throw new Error('manifest requires id or name');return v;}
function loadManifest(){const active=activePointer();for(const p of manifestCandidates()){try{if(!fs.existsSync(p))continue;const raw=JSON.parse(fs.readFileSync(p,'utf8'));return {manifest:validateManifest(raw),source:p,active};}catch(err){audit('manifest candidate rejected '+p+' · '+err.message);}}return {manifest:null,source:null,active};}
function boundedContext(m){if(!m)return 'No phone monolith manifest is currently identified. Do not claim monolith capabilities.';const caps=Array.isArray(m.capabilities)?m.capabilities:[];const shown=caps.slice(0,128).map((c,i)=>{if(typeof c==='string')return c+':declared';const obj=c&&typeof c==='object'?c:{};const id=String(obj.id||obj.name||`cap-${i+1}`);const status=typeof obj.status==='string'&&obj.status?obj.status:(obj.verified===true?'verified':'declared');return id+':'+status;});return ['You are connected through the AXM phone-local monolith bridge.',`Monolith: ${String(m.name||m.id)} (${String(m.id||m.name)}) version ${String(m.version||'unknown')}.`,`Capabilities declared in manifest: ${caps.length}. Context sample: ${shown.join(', ')||'none'}.`,caps.length>shown.length?`Capability context truncated to ${shown.length}; do not infer unseen capability details.`:'',m.provenance&&m.provenance.interfaceManifest===false?'The archive is installed through a bridge-owned body-only adapter because no native interface manifest was found. Do not infer archive capabilities from its presence.':'','Declared is not verified. A conversation reply is not execution evidence.','Preserve Truth, Agency/non-domination, Continuity, and Wisdom before speed.'].filter(Boolean).join('\n');}

function execText(command,args,options={}){return new Promise((resolve,reject)=>{childProcess.execFile(command,args,{encoding:'utf8',maxBuffer:128*1024*1024,timeout:10*60*1000,...options},(err,stdout,stderr)=>err?reject(new Error(`${command} failed: ${String(stderr||stdout||err.message).trim()}`)):resolve(String(stdout||'')));});}
function cleanArchiveName(name){const b=path.basename(String(name||'monolith.zip')).replace(/[^A-Za-z0-9._-]+/g,'_');return b.toLowerCase().endsWith('.zip')?b:b+'.zip';}
async function streamZip(req,dest){const declared=Number(req.headers['content-length']||0);if(declared&&declared>MAX_ZIP_BYTES)throw new Error(`ZIP exceeds configured ${MAX_ZIP_BYTES} byte limit`);let bytes=0;const hash=crypto.createHash('sha256');const limiter=new Transform({transform(chunk,enc,cb){bytes+=chunk.length;if(bytes>MAX_ZIP_BYTES)return cb(new Error(`ZIP exceeds configured ${MAX_ZIP_BYTES} byte limit`));hash.update(chunk);cb(null,chunk);}});await pipeline(req,limiter,fs.createWriteStream(dest,{flags:'wx',mode:0o600}));return {bytes,sha256:hash.digest('hex')};}
async function inspectZip(zipPath){const names=(await execText('unzip',['-Z1',zipPath])).split(/\r?\n/).filter(Boolean);if(!names.length)throw new Error('ZIP contains no entries');if(names.length>MAX_ARCHIVE_ENTRIES)throw new Error(`ZIP has ${names.length} entries; limit is ${MAX_ARCHIVE_ENTRIES}`);for(const raw of names){const n=String(raw).replace(/\\/g,'/');if(!n||n.includes('\0')||n.startsWith('/')||/^[A-Za-z]:\//.test(n)||n.split('/').includes('..'))throw new Error('ZIP contains unsafe path: '+raw);}const detail=await execText('zipinfo',['-l',zipPath]);if(detail.split(/\r?\n/).some(line=>/^\s*l[rwx-]{9}\s/.test(line)))throw new Error('ZIP symlink entries are not accepted');return {entries:names.length};}
function findManifestInTree(root){const wanted=new Set(MANIFEST_CANDIDATES);const found=[];const stack=[root];let seen=0;while(stack.length){const dir=stack.pop();for(const ent of fs.readdirSync(dir,{withFileTypes:true})){seen++;if(seen>MAX_ARCHIVE_ENTRIES)throw new Error('extracted tree exceeds entry limit');const p=path.join(dir,ent.name);if(ent.isSymbolicLink())throw new Error('extracted symlink rejected: '+p);if(ent.isDirectory())stack.push(p);else if(ent.isFile()&&wanted.has(ent.name))found.push(p);}}found.sort((a,b)=>a.split(path.sep).length-b.split(path.sep).length||MANIFEST_CANDIDATES.indexOf(path.basename(a))-MANIFEST_CANDIDATES.indexOf(path.basename(b)));for(const p of found){try{return {path:p,manifest:validateManifest(JSON.parse(fs.readFileSync(p,'utf8')))};}catch(err){audit('extracted manifest candidate rejected '+p+' · '+err.message);}}return null;}
function bodyOnlyAdapter({archiveName,sha256,root,installId}){return {contractVersion:'0.1',id:'axm-import-'+installId,name:archiveName.replace(/\.zip$/i,''),version:'unknown',description:'Imported AXM monolith archive. No native interface manifest was found, so capabilities are intentionally not inferred.',capabilities:[],permissions:[],provenance:{archiveImported:true,interfaceManifest:false,archiveName,sha256,bodyRoot:root,truthBoundary:'Archive body is present. Capability identity/execution remains unknown until an exact interface manifest or evidenced runtime adapter exists.'}};}
async function installZip(req){const archiveName=cleanArchiveName(req.headers['x-axm-filename']);const installId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex');const incoming=path.join(INCOMING_DIR,installId+'.zip');const stage=path.join(MONOLITHS_DIR,installId);try{const streamed=await streamZip(req,incoming);const inspected=await inspectZip(incoming);fs.mkdirSync(stage,{recursive:false});await execText('unzip',['-q',incoming,'-d',stage]);const hit=findManifestInTree(stage);let manifest,manifestPath,interfaceManifest;if(hit){manifest=hit.manifest;manifestPath=hit.path;interfaceManifest=true;}else{manifest=bodyOnlyAdapter({archiveName,sha256:streamed.sha256,root:stage,installId});manifestPath=path.join(ADAPTERS_DIR,installId+'.json');atomicJson(manifestPath,manifest);interfaceManifest=false;}const pointer={schema:'axm.phone-active-monolith/v0.1',installId,root:stage,archiveName,archiveSha256:streamed.sha256,archiveBytes:streamed.bytes,archiveEntries:inspected.entries,manifestPath,interfaceManifest,activatedAt:new Date().toISOString()};atomicJson(ACTIVE_POINTER,pointer);fs.rmSync(incoming,{force:true});audit(`ZIP activated ${archiveName} · ${installId} · manifest:${interfaceManifest?'native':'body-only-adapter'}`);return {ok:true,manifest,pointer:{installId,root:stage,archiveName,archiveSha256:streamed.sha256,archiveBytes:streamed.bytes,archiveEntries:inspected.entries,interfaceManifest}};}catch(err){try{fs.rmSync(incoming,{force:true});}catch(_){ }try{fs.rmSync(stage,{recursive:true,force:true});}catch(_){ }throw err;}}

let codexStatusCache={at:0,value:null};
function codexStatus(force=false){
  const now=Date.now();
  if(!force&&codexStatusCache.value&&now-codexStatusCache.at<15000)return codexStatusCache.value;
  const result=childProcess.spawnSync(CODEX_BINARY,['login','status'],{encoding:'utf8',timeout:3500,env:{...process.env}});
  const inaccessible=!!(result.error&&['ENOENT','EACCES','EPERM'].includes(result.error.code));
  const timedOut=!!(result.error&&(result.error.code==='ETIMEDOUT'||result.error.killed));
  const output=String(result.stdout||'')+'\n'+String(result.stderr||'');
  const installed=!inaccessible;
  const loginVerified=installed&&!timedOut&&result.status===0&&/\blogged\s+in\b/i.test(output);
  const authMode=/using\s+ChatGPT/i.test(output)?'chatgpt':(/API\s+key/i.test(output)?'api-key':(loginVerified?'logged-in':'none'));
  const value={configured:loginVerified,installed,accessible:installed&&!timedOut,loginVerified,timedOut,authMode,model:CODEX_MODEL||null,label:'Codex CLI local seat',reason:loginVerified?'ready':(!installed?'codex binary not found':(timedOut?'codex login status timed out':'run codex login on this device'))};
  codexStatusCache={at:now,value};
  return value;
}
function messageContent(v){if(typeof v==='string')return v;if(Array.isArray(v))return v.map(x=>x&&typeof x==='object'?(x.text||JSON.stringify(x)):String(x??'')).join('\n');return String(v??'');}
function codexPrompt(system,messages){
  const tail=(Array.isArray(messages)?messages:[]).slice(-24);
  let transcript=tail.map(m=>`${String(m&&m.role||'user').toUpperCase()}:\n${messageContent(m&&m.content)}`).join('\n\n');
  if(transcript.length>120000)transcript=transcript.slice(-120000);
  return [system,'You are the phone-local Codex CLI seat connected to the active AXM monolith. This bridge invocation is read-only. You may inspect files under the active monolith working directory, but do not claim you modified or executed monolith capabilities unless separate evidence proves it.','Conversation transcript:',transcript,'Reply to the final user message. Return only the conversational answer intended for the user.'].filter(Boolean).join('\n\n');
}
function runCodex(prompt,opts={}){
  return new Promise((resolve,reject)=>{
    const status=codexStatus(true);
    if(!status.installed)return reject(new Error('Codex CLI not found on this phone'));
    if(!status.loginVerified)return reject(new Error('Codex CLI is not logged in; run `codex login` in Termux, then reload the AXM phone page'));
    const active=activePointer();
    const cwd=(active&&active.root)||MONOLITH_ROOT||ROOT;
    const outFile=path.join(STATE_DIR,`codex-last-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.txt`);
    const args=['exec','--skip-git-repo-check','--ephemeral','--sandbox','read-only','--color','never','--output-last-message',outFile];
    const model=String(opts.model||CODEX_MODEL||'').trim();
    if(model)args.push('--model',model);
    args.push('-');
    const env={...process.env};
    delete env.OPENAI_API_KEY;
    delete env.CODEX_API_KEY;
    const child=childProcess.spawn(CODEX_BINARY,args,{cwd,env,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',finished=false;
    const timer=setTimeout(()=>{if(finished)return;finished=true;try{child.kill('SIGKILL');}catch(_){ }try{fs.rmSync(outFile,{force:true});}catch(_){ }reject(new Error(`Codex CLI timed out after ${CODEX_TIMEOUT_MS} ms`));},CODEX_TIMEOUT_MS);
    const add=(key,chunk)=>{if(key==='out')stdout+=chunk.toString();else stderr+=chunk.toString();if(stdout.length>16*1024*1024||stderr.length>16*1024*1024){try{child.kill('SIGKILL');}catch(_){ }}};
    child.stdout.on('data',d=>add('out',d));child.stderr.on('data',d=>add('err',d));
    child.on('error',err=>{if(finished)return;finished=true;clearTimeout(timer);try{fs.rmSync(outFile,{force:true});}catch(_){ }reject(err);});
    child.on('close',code=>{if(finished)return;finished=true;clearTimeout(timer);let text='';try{text=fs.readFileSync(outFile,'utf8').trim();}catch(_){ }try{fs.rmSync(outFile,{force:true});}catch(_){ }if(code!==0)return reject(new Error(`Codex CLI exited ${code}: ${String(stderr||stdout).trim().slice(-4000)}`));if(!text)text=String(stdout).trim();if(!text)return reject(new Error('Codex CLI returned no final message'));resolve(text);});
    child.stdin.on('error',()=>{});child.stdin.end(prompt);
  });
}

let stamps=[];
function overRate(){const n=Date.now();stamps=stamps.filter(t=>n-t<60000);if(stamps.length>=RATE)return true;stamps.push(n);return false;}
function jsonRequest(urlString,method,extraHeaders,body){return new Promise((resolve,reject)=>{const u=new URL(urlString);const lib=u.protocol==='https:'?https:http;const data=body==null?'':String(body);const q=lib.request({hostname:u.hostname,port:u.port||undefined,path:u.pathname+u.search,method,headers:Object.assign({},extraHeaders||{},data?{'content-length':Buffer.byteLength(data)}:{})},res=>{let out='';res.on('data',d=>out+=d);res.on('end',()=>{let j;try{j=JSON.parse(out||'{}');}catch(_){return reject(new Error('provider returned non-JSON'));}if(res.statusCode<200||res.statusCode>=300)return reject(new Error((j.error&&j.error.message)||j.error||`provider HTTP ${res.statusCode}`));resolve(j);});});q.on('error',reject);if(data)q.write(data);q.end();});}
function firstProvider(){const codex=codexStatus();if(codex.configured)return 'codex';if(process.env.OPENAI_API_KEY&&process.env.AXM_PHONE_OPENAI_MODEL)return 'chatgpt';if(LOCAL_URL)return 'local';if(process.env.ANTHROPIC_API_KEY&&process.env.AXM_PHONE_CLAUDE_MODEL)return 'claude';return null;}
function providerStatus(){const claudeModel=process.env.AXM_PHONE_CLAUDE_MODEL||'';const openaiModel=process.env.AXM_PHONE_OPENAI_MODEL||'';return {primary:'codex',codex:codexStatus(),chatgpt:{configured:!!process.env.OPENAI_API_KEY&&!!openaiModel,hasKey:!!process.env.OPENAI_API_KEY,model:openaiModel||null,label:'OpenAI API route'},local:{configured:!!LOCAL_URL,url:LOCAL_URL||null,model:process.env.AXM_PHONE_LOCAL_MODEL||'local-model',label:'phone-local fallback'},claude:{configured:!!process.env.ANTHROPIC_API_KEY&&!!claudeModel,hasKey:!!process.env.ANTHROPIC_API_KEY,model:claudeModel||null,label:'optional compatibility'}};}
async function callAI(payload){payload=payload&&typeof payload==='object'?payload:{};const opts=payload.opts&&typeof payload.opts==='object'?payload.opts:{};let which=String(opts.aiProvider||opts.targetProvider||opts.provider||firstProvider()||'');if(which==='auto'||which==='bridge')which=firstProvider()||'';if(!which)throw new Error('no fully configured phone AI provider');const loaded=loadManifest();const system=[boundedContext(loaded.manifest),String(opts.system||'')].filter(Boolean).join('\n\n');const messages=Array.isArray(payload.messages)?payload.messages:[];if(which==='codex'){const text=await runCodex(codexPrompt(system,messages),opts);return {text,provider:'codex'};}if(which==='chatgpt'){const key=process.env.OPENAI_API_KEY||'';const model=String(opts.model||process.env.AXM_PHONE_OPENAI_MODEL||'');if(!key)throw new Error('OPENAI_API_KEY not set on phone');if(!model)throw new Error('set AXM_PHONE_OPENAI_MODEL on phone');const body=JSON.stringify({model,messages:system?[{role:'system',content:system},...messages]:messages,max_completion_tokens:Number(opts.maxTokens||1024),temperature:typeof opts.temperature==='number'?opts.temperature:0});const j=await jsonRequest('https://api.openai.com/v1/chat/completions','POST',{'content-type':'application/json','authorization':'Bearer '+key},body);return {text:String(j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||''),provider:'chatgpt'};}if(which==='local'){if(!LOCAL_URL)throw new Error('local provider not configured; set AXM_PHONE_LOCAL_URL');const body=JSON.stringify({model:opts.model||process.env.AXM_PHONE_LOCAL_MODEL||'local-model',messages:system?[{role:'system',content:system},...messages]:messages,max_tokens:Number(opts.maxTokens||1024),temperature:typeof opts.temperature==='number'?opts.temperature:0});const j=await jsonRequest(LOCAL_URL+'/v1/chat/completions','POST',{'content-type':'application/json'},body);return {text:String(j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||''),provider:'local'};}if(which==='claude'){const key=process.env.ANTHROPIC_API_KEY||'';const model=String(opts.model||process.env.AXM_PHONE_CLAUDE_MODEL||'');if(!key)throw new Error('ANTHROPIC_API_KEY not set on phone');if(!model)throw new Error('set AXM_PHONE_CLAUDE_MODEL on phone');const body=JSON.stringify({model,max_tokens:Number(opts.maxTokens||1024),messages,system,temperature:typeof opts.temperature==='number'?opts.temperature:0});const j=await jsonRequest('https://api.anthropic.com/v1/messages','POST',{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body);const text=Array.isArray(j.content)?j.content.filter(x=>x&&x.type==='text').map(x=>x.text||'').join('\n'):'';return {text,provider:'claude'};}throw new Error('unknown provider: '+which);}

const STATIC={'/':path.join(ROOT,'mobile','phone-local.html'),'/mobile/':path.join(ROOT,'mobile','phone-local.html'),'/mobile/phone-local.html':path.join(ROOT,'mobile','phone-local.html'),'/mobile/index.html':path.join(ROOT,'mobile','index.html'),'/shared/host-core.js':path.join(ROOT,'shared','host-core.js'),'/shared/chat-transport.js':path.join(ROOT,'shared','chat-transport.js'),'/shared/interface-organs.js':path.join(ROOT,'shared','interface-organs.js'),'/shared/interface-renderer.js':path.join(ROOT,'shared','interface-renderer.js')};
function staticType(p){return p.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8';}
function serveStatic(req,res){const p=STATIC[req.url];if(!p)return false;try{const b=fs.readFileSync(p);res.writeHead(200,{'content-type':staticType(p),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(b);}catch(err){res.writeHead(500,{'content-type':'text/plain'});res.end('AXM phone UI file missing: '+err.message);}return true;}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,headers(req));return res.end();}
  if(req.method==='GET'&&serveStatic(req,res))return;
  if(req.method==='GET'&&req.url==='/health'){const m=loadManifest();const a=m.active;return send(req,res,200,{ok:true,locked:true,mode:'phone-local-monolith-bridge',host:HOST,port:PORT,monolith:{installed:!!(a&&a.root)||!!MONOLITH_ROOT,identified:!!m.manifest,source:m.source,id:m.manifest&&String(m.manifest.id||m.manifest.name),name:m.manifest&&String(m.manifest.name||m.manifest.id),version:m.manifest&&String(m.manifest.version||'unknown'),root:(a&&a.root)||MONOLITH_ROOT||null,archiveName:a&&a.archiveName||null,interfaceManifest:a&&typeof a.interfaceManifest==='boolean'?a.interfaceManifest:null},providers:providerStatus()});}
  if(req.method==='GET'&&req.url==='/monolith'){const pass=allowed(req);if(!pass)return send(req,res,403,{error:'refused: phone bridge local UI/token required'});const m=loadManifest();if(!m.manifest)return send(req,res,404,{error:'no monolith manifest identified',candidates:manifestCandidates(),active:m.active});return send(req,res,200,{ok:true,manifest:m.manifest,source:m.source,active:m.active});}
  if(req.method==='POST'&&req.url==='/monolith/install-manifest'){const pass=allowed(req);if(!pass)return send(req,res,403,{error:'refused: phone bridge local UI/token required'});try{const body=JSON.parse(await readBody(req));const manifest=validateManifest(body.manifest||body);atomicJson(SAVED_MANIFEST,manifest);audit('monolith manifest installed via '+pass+' · '+String(manifest.id||manifest.name));return send(req,res,200,{ok:true,path:SAVED_MANIFEST,id:String(manifest.id||manifest.name)});}catch(err){return send(req,res,400,{error:String(err.message||err)});}}
  if(req.method==='POST'&&req.url==='/monolith/install-zip'){const pass=allowed(req);if(!pass)return send(req,res,403,{error:'refused: phone bridge local UI/token required'});try{return send(req,res,200,await installZip(req));}catch(err){audit('ZIP install failed · '+String(err.message||err));return send(req,res,400,{error:String(err.message||err)});}}
  if(req.method==='POST'&&req.url==='/ask'){const pass=allowed(req);if(!pass){audit('REFUSED /ask');return send(req,res,403,{error:'refused: phone bridge local UI/token required'});}if(overRate())return send(req,res,429,{error:`phone bridge rate cap: ${RATE}/min`});try{const payload=JSON.parse(await readBody(req));audit('ask via '+pass+' · '+((payload.messages&&payload.messages.length)||0)+' message(s)');return send(req,res,200,await callAI(payload));}catch(err){audit('ask error · '+String(err.message||err));return send(req,res,502,{error:String(err.message||err)});}}
  return send(req,res,404,{error:'not found'});
});

server.listen(PORT,HOST,()=>{const m=loadManifest();const codex=codexStatus(true);audit(`phone bridge v0.4 up on http://${HOST}:${PORT} · monolith:${m.manifest?'identified':'not-identified'} · providers:${JSON.stringify(providerStatus())}`);console.log('Open on this phone: http://127.0.0.1:'+PORT+'/');console.log('Primary intelligence route: Codex CLI when installed + logged in.');console.log('Codex seat: '+(codex.configured?'READY':codex.reason));console.log('Non-browser machine token: '+TOKEN_FILE);if(!m.manifest)console.log('Choose a monolith ZIP/manifest in the phone page, or set AXM_PHONE_MONOLITH_MANIFEST / AXM_PHONE_MONOLITH_ROOT.');});
