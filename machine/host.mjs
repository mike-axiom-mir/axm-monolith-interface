#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {HostSession}=require('../shared/host-core.js');

function out(value){process.stdout.write(JSON.stringify(value)+'\n');}
function fail(error){return {ok:false,error:String(error&&error.message?error.message:error)};}

function execute(host,msg){
  if(!msg||typeof msg!=='object') throw new Error('Command must be a JSON object.');
  switch(msg.command){
    case 'load':
      if(!msg.manifest) throw new Error('load requires manifest.');
      return {ok:true,result:host.load(msg.manifest)};
    case 'snapshot': return {ok:true,result:host.snapshot()};
    case 'capabilities': return {ok:true,result:host.listCapabilities()};
    case 'permission': return {ok:true,result:host.setPermission(String(msg.id||''),String(msg.decision||''))};
    case 'propose_action': return {ok:true,result:host.proposeAction(String(msg.capabilityId||''),String(msg.operation||''),msg.input||{})};
    case 'evidence': return {ok:true,result:host.snapshot().evidence};
    case 'disconnect': return {ok:true,result:host.disconnect()};
    default: throw new Error(`Unknown command: ${msg.command}`);
  }
}

const host=new HostSession({surface:'machine-jsonl',userType:'machine'});
const args=process.argv.slice(2);

if(args[0]==='serve'||args.length===0){
  const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  out({ok:true,event:'ready',protocol:'axm-monolith-interface/machine',version:'0.1.0'});
  rl.on('line',line=>{
    const text=line.trim(); if(!text) return;
    try{out(execute(host,JSON.parse(text)));}catch(err){out(fail(err));}
  });
}else{
  const manifestPath=args[0];
  const command=args[1]||'snapshot';
  try{
    host.load(JSON.parse(fs.readFileSync(manifestPath,'utf8')));
    let message={command};
    if(command==='capabilities'||command==='snapshot'||command==='evidence'){}
    else if(command==='propose_action'){
      message={command,capabilityId:args[2],operation:args[3],input:args[4]?JSON.parse(args[4]):{}};
    }else throw new Error('One-shot mode supports snapshot, capabilities, evidence, or propose_action. Use serve for persistent permission/session flows.');
    out(execute(host,message));
  }catch(err){out(fail(err));process.exitCode=1;}
}
