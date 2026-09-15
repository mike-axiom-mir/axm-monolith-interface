import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const state=fs.mkdtempSync(path.join(os.tmpdir(),'axm-phone-bridge-'));
const port=18787;
const child=spawn(process.execPath,[path.join(repo,'phone-bridge','axm-phone-bridge.js')],{
  cwd:repo,
  env:{...process.env,AXM_PHONE_BRIDGE_PORT:String(port),AXM_PHONE_STATE_DIR:state,AXM_PHONE_BRIDGE_HOST:'127.0.0.1',AXM_PHONE_LOCAL_URL:'',ANTHROPIC_API_KEY:'',OPENAI_API_KEY:''},
  stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',d=>output+=d.toString());
child.stderr.on('data',d=>output+=d.toString());
await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('phone bridge startup timeout: '+output)),5000);
  const poll=setInterval(()=>{if(output.includes('Open on this phone:')){clearInterval(poll);clearTimeout(timeout);resolve();}},25);
  child.once('exit',code=>{clearInterval(poll);clearTimeout(timeout);reject(new Error('phone bridge exited early '+code+': '+output));});
});
try{
  const base=`http://127.0.0.1:${port}`;
  const health=await fetch(base+'/health').then(r=>r.json());
  assert.equal(health.ok,true);
  assert.equal(health.mode,'phone-local-monolith-bridge');
  assert.equal(health.monolith.identified,false);
  assert.equal(Object.values(health.providers).some(p=>p.configured),false);

  const page=await fetch(base+'/').then(r=>r.text());
  assert.match(page,/Your monolith, on this phone\./);

  const refused=await fetch(base+'/monolith');
  assert.equal(refused.status,403);

  const token=fs.readFileSync(path.join(state,'phone-bridge-token.txt'),'utf8').trim();
  assert.ok(token.length>=32);
  const auth={'x-axm-token':token};
  const absent=await fetch(base+'/monolith',{headers:auth});
  assert.equal(absent.status,404);

  const manifest={id:'test-phone-monolith',name:'Test Phone Monolith',version:'1',capabilities:[{id:'state',status:'verified'}],permissions:[]};
  const installed=await fetch(base+'/monolith/install-manifest',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({manifest})});
  assert.equal(installed.status,200);
  const after=await fetch(base+'/health').then(r=>r.json());
  assert.equal(after.monolith.identified,true);
  assert.equal(after.monolith.id,'test-phone-monolith');

  const readback=await fetch(base+'/monolith',{headers:auth}).then(r=>r.json());
  assert.equal(readback.manifest.id,'test-phone-monolith');

  const noMind=await fetch(base+'/ask',{method:'POST',headers:{...auth,'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hello'}],opts:{provider:'auto'}})});
  assert.equal(noMind.status,502);
  const noMindBody=await noMind.json();
  assert.match(noMindBody.error,/no fully configured phone AI provider/);

  console.log('AXM phone-local bridge live test: PASS');
} finally {
  child.kill('SIGTERM');
}
