#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {HostSession}=require('../shared/host-core.js');
const {ChatSession}=require('../shared/chat-transport.js');
function out(value){process.stdout.write(JSON.stringify(value)+'\n');}
function fail(error){return {ok:false,error:String(error&&error.message?error.message:error)};}
const host=new HostSession({surface:'machine-jsonl',userType:'machine'});
const chat=new ChatSession({host,baseUrl:process.env.AXM_MACHINE_BRIDGE_URL||'http://127.0.0.1:8787',token:process.env.AXM_MACHINE_BRIDGE_TOKEN||'',provider:process.env.AXM_MACHINE_PROVIDER||'auto',model:process.env.AXM_MACHINE_MODEL||''});
async function execute(msg){
  if(!msg||typeof msg!=='object') throw new Error('Command must be a JSON object.');
  switch(msg.command){
    case 'load': if(!msg.manifest)throw new Error('load requires manifest.');return {ok:true,result:host.load(msg.manifest)};
    case 'snapshot': return {ok:true,result:host.snapshot()};
    case 'capabilities': return {ok:true,result:host.listCapabilities()};
    case 'permission': return {ok:true,result:host.setPermission(String(msg.id||''),String(msg.decision||''))};
    case 'propose_action': return {ok:true,result:host.proposeAction(String(msg.capabilityId||''),String(msg.operation||''),msg.input||{})};
    case 'evidence': return {ok:true,result:host.snapshot().evidence};
    case 'disconnect': chat.clear();return {ok:true,result:host.disconnect()};
    case 'chat_config': return {ok:true,result:chat.configure({baseUrl:msg.baseUrl,token:msg.token,provider:msg.provider,model:msg.model})};
    case 'chat_health': return {ok:true,result:await chat.health()};
    case 'chat': return {ok:true,result:await chat.send(String(msg.text||''),{provider:msg.provider,model:msg.model,maxTokens:msg.maxTokens})};
    case 'chat_history': return {ok:true,result:chat.history()};
    case 'chat_clear': return {ok:true,result:chat.clear()};
    default: throw new Error(`Unknown command: ${msg.command}`);
  }
}
const args=process.argv.slice(2);
if(args[0]==='serve'||args.length===0){
  const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
  out({ok:true,event:'ready',protocol:'axm-monolith-interface/machine',version:'0.2.0',chat:true});
  rl.on('line',async line=>{const text=line.trim();if(!text)return;try{out(await execute(JSON.parse(text)));}catch(err){out(fail(err));}});
}else{
  const manifestPath=args[0];const command=args[1]||'snapshot';
  try{host.load(JSON.parse(fs.readFileSync(manifestPath,'utf8')));let message={command};if(command==='propose_action')message={command,capabilityId:args[2],operation:args[3],input:args[4]?JSON.parse(args[4]):{}};else if(!['capabilities','snapshot','evidence'].includes(command))throw new Error('One-shot mode supports snapshot, capabilities, evidence, or propose_action. Use serve for chat and persistent flows.');out(await execute(message));}catch(err){out(fail(err));process.exitCode=1;}
}
