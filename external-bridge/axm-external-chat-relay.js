#!/usr/bin/env node
'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const os=require('os');

const HOST=process.env.AXM_EXTERNAL_HOST||'0.0.0.0';
const PORT=Number(process.env.AXM_EXTERNAL_PORT||8797);
const UPSTREAM_HOST='127.0.0.1';
const UPSTREAM_PORT=Number(process.env.AXM_BRIDGE_PORT||8787);
const RATE=Number(process.env.AXM_EXTERNAL_RATE||20);
const HERE=__dirname;
const EXTERNAL_TOKEN_FILE=path.join(HERE,'external-token.txt');
const UPSTREAM_TOKEN_FILE=process.env.AXM_UPSTREAM_TOKEN_FILE||path.join(HERE,'bridge-token.txt');
let externalToken='';
try{externalToken=fs.readFileSync(EXTERNAL_TOKEN_FILE,'utf8').trim();}catch(_){ }
if(!externalToken){externalToken=crypto.randomBytes(24).toString('hex');fs.writeFileSync(EXTERNAL_TOKEN_FILE,externalToken+'\n',{mode:0o600});}
let stamps=[];
function overRate(){const n=Date.now();stamps=stamps.filter(t=>n-t<60000);if(stamps.length>=RATE)return true;stamps.push(n);return false;}
function safeEqual(a,b){const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));if(x.length!==y.length)return false;return crypto.timingSafeEqual(x,y);}
function cors(req){return {'content-type':'application/json','access-control-allow-origin':req.headers.origin||'*','access-control-allow-headers':'content-type,x-axm-token','access-control-allow-methods':'GET,POST,OPTIONS','vary':'Origin'};}
function send(req,res,status,obj){res.writeHead(status,cors(req));res.end(JSON.stringify(obj));}
function upstreamToken(){try{return fs.readFileSync(UPSTREAM_TOKEN_FILE,'utf8').trim();}catch(_){return '';}}
function forwardAsk(body){return new Promise((resolve,reject)=>{const tok=upstreamToken();if(!tok)return reject(new Error('local platform bridge token not found; start axm-bridge.js first'));const data=JSON.stringify(body);const q=http.request({hostname:UPSTREAM_HOST,port:UPSTREAM_PORT,path:'/ask',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(data),'x-axm-token':tok}},r=>{let out='';r.on('data',d=>out+=d);r.on('end',()=>{let j;try{j=JSON.parse(out||'{}');}catch(_){return reject(new Error('upstream returned non-JSON'));}if(r.statusCode<200||r.statusCode>=300)return reject(new Error(j.error||`upstream ${r.statusCode}`));resolve({text:String(j.text||''),provider:String(j.provider||'unknown')});});});q.on('error',reject);q.end(data);});}
function upstreamHealth(){return new Promise(resolve=>{const q=http.request({hostname:UPSTREAM_HOST,port:UPSTREAM_PORT,path:'/health',method:'GET'},r=>{let out='';r.on('data',d=>out+=d);r.on('end',()=>{try{resolve(JSON.parse(out||'{}'));}catch(_){resolve({ok:false});}})});q.on('error',()=>resolve({ok:false}));q.end();});}
function authed(req){return safeEqual(req.headers['x-axm-token'],externalToken);}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,cors(req));return res.end();}
  if(req.method==='GET'&&req.url==='/health'){
    const upstream=await upstreamHealth();
    const authorized=authed(req);
    return send(req,res,200,{ok:authorized&&!!upstream.ok,reachable:true,authorized,locked:true,mode:'external-chat-relay',upstream:{ok:!!upstream.ok,providers:upstream.providers||null},scope:['health','ask']});
  }
  if(req.method==='POST'&&req.url==='/ask'){
    if(!authed(req))return send(req,res,403,{error:'external relay refused: invalid token'});
    if(overRate())return send(req,res,429,{error:`external relay rate cap: ${RATE}/min`});
    let raw='';
    req.on('data',d=>{raw+=d;if(raw.length>2e6)req.destroy();});
    req.on('end',async()=>{let body;try{body=JSON.parse(raw||'{}');}catch(_){return send(req,res,400,{error:'bad json'});}try{return send(req,res,200,await forwardAsk(body));}catch(err){return send(req,res,502,{error:String(err.message||err)});}});
    return;
  }
  return send(req,res,404,{error:'not found; external relay exposes only /health and /ask'});
});
server.listen(PORT,HOST,()=>{
  const ips=[];for(const rows of Object.values(os.networkInterfaces()))for(const x of rows||[])if(x.family==='IPv4'&&!x.internal)ips.push(x.address);
  console.log('AXM external chat relay');
  console.log(`Listening: http://${HOST}:${PORT}`);
  for(const ip of ips)console.log(`Phone URL: http://${ip}:${PORT}`);
  console.log(`External token: ${externalToken}`);
  console.log(`Upstream: http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
  console.log('Scope: /health + /ask only. No shell, files, or arbitrary platform routes.');
});
