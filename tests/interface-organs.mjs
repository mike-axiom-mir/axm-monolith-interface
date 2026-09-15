import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const Organs=require('../shared/interface-organs.js');

assert.equal(Organs.VERSION,'0.1.0-experimental');
assert.equal(Organs.BUILTIN_ORGANS.length,7);
assert.deepEqual(Organs.ROOTS,['truth','agency','continuity','wisdom']);

const changes=[
  {op:'ensure_surface',surface:{id:'phone-tools',title:'Phone tools',layout:'stack'}},
  {op:'add_component',surfaceId:'phone-tools',component:{id:'status',kind:'status',order:10,props:{label:'Connection'}}},
  {op:'add_component',surfaceId:'phone-tools',component:{id:'caps',kind:'capability-list',order:20,props:{filter:['verified','declared']}}},
  {op:'set_preference',key:'density',value:'compact'}
];

const system=new Organs.InterfaceOrganSystem({surface:'human-mobile',userType:'human'});
const boot=system.snapshot();
assert.equal(boot.organs.length,7);
assert.ok(boot.supportedOperations.includes('add_component'));
assert.ok(boot.supportedOperations.includes('set_preference'));
const beforeHash=boot.stateHash;

const proposal=system.propose(changes,{source:'test-monolith',reason:'Test adaptive phone tools.'});
assert.equal(proposal.status,'pending');
assert.equal(proposal.requiresApproval,true);
assert.equal(system.snapshot().stateHash,beforeHash,'proposal must not mutate live interface state');
assert.notEqual(proposal.afterHash,beforeHash);

const twin=new Organs.InterfaceOrganSystem({surface:'human-mobile',userType:'human'});
const twinProposal=twin.propose(changes,{source:'test-monolith',reason:'Test adaptive phone tools.'});
assert.equal(twinProposal.afterHash,proposal.afterHash,'same state + proposal must produce deterministic preview hash');

const applied=system.decide(proposal.id,'approved',{by:'current-user'});
assert.equal(applied.proposal.status,'applied');
assert.equal(applied.state.revision,1);
assert.equal(applied.state.surfaces['phone-tools'].components.length,2);
assert.equal(applied.state.preferences.density,'compact');
assert.equal(system.snapshot().checkpoints.length,1,'approval must checkpoint previous state');

const adjust=system.propose([
  {op:'update_component',surfaceId:'phone-tools',componentId:'status',patch:{props:{label:'Machine online'},order:30}},
  {op:'move_component',surfaceId:'phone-tools',componentId:'caps',slot:'secondary',order:5},
  {op:'set_surface',surfaceId:'phone-tools',patch:{layout:'grid'}}
],{source:'host-personalization'});
const adjusted=system.decide(adjust.id,'approved',{by:'current-user'});
assert.equal(adjusted.state.revision,2);
assert.equal(adjusted.state.surfaces['phone-tools'].layout,'grid');
assert.equal(adjusted.state.surfaces['phone-tools'].components[0].id,'caps');
assert.equal(adjusted.state.surfaces['phone-tools'].components.find(x=>x.id==='status').props.label,'Machine online');

const denied=system.propose([
  {op:'remove_component',surfaceId:'phone-tools',componentId:'caps'}
],{source:'test-monolith'});
const deniedResult=system.decide(denied.id,'denied',{by:'current-user'});
assert.equal(deniedResult.proposal.status,'denied');
assert.ok(system.snapshot().state.surfaces['phone-tools'].components.some(x=>x.id==='caps'));

assert.throws(()=>system.propose([
  {op:'add_component',surfaceId:'phone-tools',component:{id:'bad',kind:'panel',props:{innerHTML:'<script>bad()</script>'}}}
]),/not allowed/);
assert.throws(()=>system.propose([
  {op:'add_component',surfaceId:'phone-tools',component:{id:'bad-kind',kind:'arbitrary-html'}}
]),/Unsupported component kind/);
assert.throws(()=>system.propose([
  {op:'update_component',surfaceId:'phone-tools',componentId:'status',patch:{kind:'chat'}}
]),/identity\/kind cannot be silently rewritten/);

const stale=system.propose([{op:'set_preference',key:'accent',value:'cyan'}],{source:'test'});
const other=system.propose([{op:'set_preference',key:'fontScale',value:1.1}],{source:'test'});
system.decide(other.id,'approved',{by:'current-user'});
assert.throws(()=>system.decide(stale.id,'approved',{by:'current-user'}),/state changed since proposal/);

const checkpoint=system.checkpoint('manual-before-rollback-test');
const mutate=system.propose([{op:'set_preference',key:'density',value:'comfortable'}],{source:'test'});
system.decide(mutate.id,'approved',{by:'current-user'});
const revisionBeforeRollback=system.snapshot().state.revision;
const restored=system.rollback(checkpoint.id,{by:'current-user'});
assert.equal(restored.preferences.density,'compact');
assert.equal(restored.revision,revisionBeforeRollback+1,'rollback should preserve monotonic revision history');
assert.equal(restored.metadata.rolledBackFrom,checkpoint.id);

console.log('AXM interface organ fabric tests: PASS');
