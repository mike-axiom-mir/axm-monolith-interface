import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const Organs=require('../shared/interface-organs.js');
const Renderer=require('../shared/interface-renderer.js');

const system=new Organs.InterfaceOrganSystem({surface:'human-mobile'});
const proposal=system.propose([
  {op:'ensure_surface',surface:{id:'adaptive',title:'Adaptive tools',description:'Safe rendered region',layout:'grid'}},
  {op:'add_component',surfaceId:'adaptive',component:{id:'status',kind:'status',order:1,props:{label:'Connection',source:'host.connection.state'}}},
  {op:'add_component',surfaceId:'adaptive',component:{id:'caps',kind:'capability-list',order:2,props:{statusFilter:['verified']}}},
  {op:'add_component',surfaceId:'adaptive',component:{id:'act',kind:'action',order:3,props:{label:'Open tools',actionId:'open-tools'}}}
],{source:'test'});
system.decide(proposal.id,'approved',{by:'test'});

const model=Renderer.materializeSurface(system.snapshot().state,'adaptive',{
  host:{connection:{state:'connected'}},
  capabilities:[
    {id:'a',name:'A',status:'verified',description:'yes'},
    {id:'b',name:'B',status:'declared',description:'no'}
  ]
});

assert.equal(model.id,'adaptive');
assert.equal(model.layout,'grid');
assert.equal(model.components.length,3);
assert.equal(model.components[0].value,'connected');
assert.equal(model.components[1].items.length,1);
assert.equal(model.components[1].items[0].id,'a');
assert.equal(model.components[2].actionId,'open-tools');

assert.equal(Renderer.getPath({a:{b:3}},'a.b'),3);
assert.equal(Renderer.getPath({a:{b:3}},'a.__proto__.x'),undefined);
assert.throws(()=>Renderer.materializeSurface(system.snapshot().state,'missing',{}),/Unknown interface surface/);

console.log('AXM interface renderer tests: PASS');
