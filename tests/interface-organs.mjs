import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const Organs=require('../shared/interface-organs.js');

assert.equal(Organs.VERSION,'0.2.1-persistence');
assert.equal(Organs.PERSISTENCE_SCHEMA,'axm.interface-persistence/v0.1');
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

class MemoryStorage{
  constructor(){this.map=new Map();}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

const storage=new MemoryStorage();
const persistence=new Organs.InterfacePersistence({surface:'human-mobile',storage,maxCheckpoints:20,maxEvidence:500});
assert.equal(persistence.available(),true);
const approvedPlan='cartridge-a@1.0.0:deadbeef';
const deniedPlan='cartridge-a@1.0.0:feedcafe';
const saveResult=persistence.save({id:'cartridge-a',version:'1.0.0'},system,{reason:'test-save',approvedPlanKeys:[approvedPlan],deniedPlanKeys:[deniedPlan]});
assert.equal(saveResult.saved,true);
assert.ok(saveResult.stateHash);

const persisted=persistence.load({id:'cartridge-a',version:'1.0.0'});
assert.equal(persisted.cartridgeId,'cartridge-a');
assert.equal(persisted.versionChanged,false);
assert.ok(persisted.approvedPlanKeys.includes(approvedPlan));
assert.ok(persisted.deniedPlanKeys.includes(deniedPlan));
assert.ok(persisted.checkpoints.length>=1,'checkpoint lineage should persist');

const newer=persistence.load({id:'cartridge-a',version:'2.0.0'});
assert.equal(newer.versionChanged,true,'same cartridge id may inherit across a visible version change');
assert.equal(newer.savedVersion,'1.0.0');
assert.equal(newer.currentVersion,'2.0.0');
assert.ok(newer.approvedPlanKeys.includes('cartridge-a@2.0.0:deadbeef'),'identical approved plan fingerprint should carry forward across version drift');
assert.ok(newer.deniedPlanKeys.includes('cartridge-a@2.0.0:feedcafe'),'identical denied plan fingerprint should carry forward across version drift');
assert.ok(!newer.approvedPlanKeys.includes('cartridge-a@2.0.0:aaaaaaaa'),'different plan content must not inherit approval');

const restoredSystem=persistence.restoreSystem(newer,{userType:'human'});
assert.equal(restoredSystem.snapshot().stateHash,newer.stateHash);
assert.equal(restoredSystem.snapshot().checkpoints.length,newer.checkpoints.length);
assert.ok(restoredSystem.snapshot().evidence.some(row=>row.type==='organ_restore'));
assert.equal(persistence.load({id:'cartridge-b',version:'1.0.0'}),null,'different cartridge must not inherit another cartridge interface');

const corruptKey=persistence.key('cartridge-corrupt');
storage.setItem(corruptKey,JSON.stringify({schema:Organs.PERSISTENCE_SCHEMA,deviceId:persistence.deviceId,surface:'human-mobile',cartridgeId:'different-id',state:{}}));
assert.throws(()=>persistence.load({id:'cartridge-corrupt',version:'1'}),/different cartridge/);

console.log('AXM interface organ fabric tests: PASS');
