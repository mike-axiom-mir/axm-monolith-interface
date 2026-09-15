(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  if(root){root.AXMInterfaceOrgans=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='0.1.0-experimental';
  const STATE_SCHEMA='axm.interface-state/v0.1';
  const ROOTS=Object.freeze(['truth','agency','continuity','wisdom']);
  const COMPONENT_KINDS=Object.freeze([
    'text','panel','status','list','action','chat','capability-list',
    'permission-list','evidence-log','spacer','metric'
  ]);
  const BUILTIN_ORGANS=Object.freeze([
    {id:'registry',version:'0.1.0',purpose:'Track available interface organs and safe declarative operations.',operations:['ensure_surface','set_surface']},
    {id:'composer',version:'0.1.0',purpose:'Add, update, move and remove declarative interface components.',operations:['add_component','update_component','move_component','remove_component']},
    {id:'validator',version:'0.1.0',purpose:'Reject unknown, executable or structurally invalid interface changes.',operations:[]},
    {id:'migration',version:'0.1.0',purpose:'Normalize interface state into the current deterministic schema.',operations:[]},
    {id:'personalization',version:'0.1.0',purpose:'Apply local presentation preferences without rewriting source truth.',operations:['set_preference']},
    {id:'evidence',version:'0.1.0',purpose:'Record proposals, decisions, applications and recovery receipts.',operations:[]},
    {id:'recovery',version:'0.1.0',purpose:'Checkpoint interface state before approved changes and restore known state.',operations:[]}
  ]);

  function clone(value){
    if(value===undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }
  function asObject(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function now(){return new Date().toISOString();}
  function stable(value){
    if(Array.isArray(value)) return value.map(stable);
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(key=>{out[key]=stable(value[key]);});
      return out;
    }
    return value;
  }
  function canonical(value){return JSON.stringify(stable(value));}
  function hash(value){
    const text=typeof value==='string'?value:canonical(value);
    let h=0x811c9dc5;
    for(let i=0;i<text.length;i++){
      h^=text.charCodeAt(i);
      h=Math.imul(h,0x01000193)>>>0;
    }
    return h.toString(16).padStart(8,'0');
  }
  function validId(value){return typeof value==='string'&&/^[A-Za-z0-9._:-]{1,80}$/.test(value);}
  function cleanString(value,max=500){return String(value==null?'':value).slice(0,max);}
  function rejectExecutable(value,pathName='value'){
    if(value===null||value===undefined) return;
    if(typeof value==='function') throw new Error(`${pathName} may not contain executable functions.`);
    if(Array.isArray(value)){value.forEach((item,index)=>rejectExecutable(item,`${pathName}[${index}]`));return;}
    if(typeof value==='object'){
      for(const [key,item] of Object.entries(value)){
        if(/^(?:on[a-z]+|html|innerhtml|outerhtml|srcdoc|script)$/i.test(key)) throw new Error(`${pathName}.${key} is not allowed in declarative interface state.`);
        rejectExecutable(item,`${pathName}.${key}`);
      }
    }
  }
  function normalizeComponent(raw){
    raw=asObject(raw);
    if(!validId(raw.id)) throw new Error('Component id is required and must be stable.');
    const kind=String(raw.kind||'');
    if(!COMPONENT_KINDS.includes(kind)) throw new Error(`Unsupported component kind: ${kind||'(empty)'}`);
    const props=clone(asObject(raw.props));
    rejectExecutable(props,'component.props');
    return {
      id:raw.id,
      kind,
      slot:validId(raw.slot)?raw.slot:'main',
      order:Number.isFinite(raw.order)?Number(raw.order):0,
      visible:raw.visible!==false,
      props
    };
  }
  function normalizeSurface(raw){
    raw=asObject(raw);
    if(!validId(raw.id)) throw new Error('Surface id is required and must be stable.');
    return {
      id:raw.id,
      title:cleanString(raw.title||raw.id,160),
      description:cleanString(raw.description||'',500),
      layout:['stack','grid','chat','dock'].includes(raw.layout)?raw.layout:'stack',
      components:Array.isArray(raw.components)?raw.components.map(normalizeComponent):[]
    };
  }
  function emptyState(surface='unknown'){
    return {
      schema:STATE_SCHEMA,
      revision:0,
      surface:String(surface||'unknown'),
      surfaces:{},
      preferences:{},
      metadata:{createdBy:'interface-organs',organVersion:VERSION}
    };
  }
  function migrateState(input,surface='unknown'){
    if(!input) return emptyState(surface);
    const raw=clone(input);
    if(raw.schema&&raw.schema!==STATE_SCHEMA) throw new Error(`Unsupported interface state schema: ${raw.schema}`);
    const state=emptyState(raw.surface||surface);
    state.revision=Number.isInteger(raw.revision)&&raw.revision>=0?raw.revision:0;
    state.preferences=clone(asObject(raw.preferences));
    rejectExecutable(state.preferences,'preferences');
    state.metadata=Object.assign({},state.metadata,clone(asObject(raw.metadata)));
    const source=raw.surfaces;
    if(Array.isArray(source)){
      source.forEach(item=>{const s=normalizeSurface(item);state.surfaces[s.id]=s;});
    }else if(source&&typeof source==='object'){
      Object.entries(source).forEach(([id,item])=>{const s=normalizeSurface(Object.assign({},asObject(item),{id:item&&item.id||id}));state.surfaces[s.id]=s;});
    }
    return state;
  }
  function stateHash(state){return hash(state);}
  function findComponent(state,surfaceId,componentId){
    const surface=state.surfaces[surfaceId];
    if(!surface) throw new Error(`Unknown surface: ${surfaceId}`);
    const index=surface.components.findIndex(component=>component.id===componentId);
    return {surface,index,component:index>=0?surface.components[index]:null};
  }
  function applyChange(state,change){
    change=asObject(change);
    const op=String(change.op||'');
    if(!op) throw new Error('Interface change requires op.');
    rejectExecutable(change,'change');

    if(op==='ensure_surface'){
      const incoming=normalizeSurface(change.surface||change.value);
      if(state.surfaces[incoming.id]) throw new Error(`Surface already exists: ${incoming.id}`);
      state.surfaces[incoming.id]=incoming;
      return;
    }
    if(op==='set_surface'){
      const id=String(change.surfaceId||'');
      if(!validId(id)||!state.surfaces[id]) throw new Error(`Unknown surface: ${id}`);
      const patch=asObject(change.patch);
      if('id' in patch||'components' in patch) throw new Error('set_surface cannot replace identity or component state.');
      if('title' in patch) state.surfaces[id].title=cleanString(patch.title,160);
      if('description' in patch) state.surfaces[id].description=cleanString(patch.description,500);
      if('layout' in patch){if(!['stack','grid','chat','dock'].includes(patch.layout)) throw new Error(`Unsupported surface layout: ${patch.layout}`);state.surfaces[id].layout=patch.layout;}
      return;
    }
    if(op==='add_component'){
      const surfaceId=String(change.surfaceId||'');
      if(!state.surfaces[surfaceId]) throw new Error(`Unknown surface: ${surfaceId}`);
      const component=normalizeComponent(change.component);
      if(state.surfaces[surfaceId].components.some(item=>item.id===component.id)) throw new Error(`Component already exists: ${component.id}`);
      state.surfaces[surfaceId].components.push(component);
      state.surfaces[surfaceId].components.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
      return;
    }
    if(op==='update_component'){
      const surfaceId=String(change.surfaceId||''),componentId=String(change.componentId||'');
      const found=findComponent(state,surfaceId,componentId);
      if(!found.component) throw new Error(`Unknown component: ${componentId}`);
      const patch=asObject(change.patch);
      if('id' in patch||'kind' in patch) throw new Error('Component identity/kind cannot be silently rewritten. Remove and add explicitly instead.');
      if('slot' in patch){if(!validId(patch.slot)) throw new Error('Invalid component slot.');found.component.slot=patch.slot;}
      if('order' in patch){if(!Number.isFinite(patch.order)) throw new Error('Component order must be numeric.');found.component.order=Number(patch.order);}
      if('visible' in patch) found.component.visible=patch.visible!==false;
      if('props' in patch){const props=clone(asObject(patch.props));rejectExecutable(props,'component.patch.props');found.component.props=Object.assign({},found.component.props,props);}
      found.surface.components.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
      return;
    }
    if(op==='move_component'){
      const surfaceId=String(change.surfaceId||''),componentId=String(change.componentId||'');
      const found=findComponent(state,surfaceId,componentId);
      if(!found.component) throw new Error(`Unknown component: ${componentId}`);
      if(change.slot!==undefined){if(!validId(change.slot)) throw new Error('Invalid component slot.');found.component.slot=change.slot;}
      if(change.order!==undefined){if(!Number.isFinite(change.order)) throw new Error('Component order must be numeric.');found.component.order=Number(change.order);}
      found.surface.components.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
      return;
    }
    if(op==='remove_component'){
      const surfaceId=String(change.surfaceId||''),componentId=String(change.componentId||'');
      const found=findComponent(state,surfaceId,componentId);
      if(!found.component) throw new Error(`Unknown component: ${componentId}`);
      found.surface.components.splice(found.index,1);
      return;
    }
    if(op==='set_preference'){
      const key=String(change.key||'');
      if(!validId(key)) throw new Error('Preference key must be stable.');
      rejectExecutable(change.value,'preference.value');
      state.preferences[key]=clone(change.value);
      return;
    }
    throw new Error(`Unknown interface operation: ${op}`);
  }

  class InterfaceOrganSystem{
    constructor(options={}){
      this.surface=String(options.surface||'unknown');
      this.userType=String(options.userType||'human');
      this.state=migrateState(options.state,this.surface);
      this.organs=new Map();
      this.proposals=new Map();
      this.checkpoints=[];
      this.evidence=[];
      this.maxCheckpoints=Math.max(1,Number(options.maxCheckpoints||20));
      BUILTIN_ORGANS.forEach(def=>this.registerTrustedOrgan(def));
      this.record('organ_boot','interface organ system created',{version:VERSION,surface:this.surface,userType:this.userType,stateHash:stateHash(this.state)});
    }
    record(type,message,data=null){
      const row={seq:this.evidence.length+1,time:now(),type:String(type),message:String(message),data:data==null?null:clone(data)};
      this.evidence.push(row);return clone(row);
    }
    registerTrustedOrgan(definition){
      const def=asObject(definition);
      if(!validId(def.id)) throw new Error('Organ id must be stable.');
      const normalized={id:def.id,version:cleanString(def.version||'0',40),purpose:cleanString(def.purpose||'',300),operations:Array.isArray(def.operations)?def.operations.map(String):[],trust:'host-code'};
      this.organs.set(normalized.id,normalized);
      return clone(normalized);
    }
    organReport(){return [...this.organs.values()].map(clone);}
    supportedOperations(){return [...new Set(this.organReport().flatMap(organ=>organ.operations))].sort();}
    checkpoint(reason='manual'){
      const cp={id:`cp-${this.state.revision}-${stateHash(this.state)}`,reason:String(reason),state:clone(this.state),stateHash:stateHash(this.state),time:now()};
      this.checkpoints.push(cp);
      while(this.checkpoints.length>this.maxCheckpoints) this.checkpoints.shift();
      this.record('checkpoint','interface checkpoint created',{id:cp.id,reason:cp.reason,stateHash:cp.stateHash});
      return clone(cp);
    }
    propose(changes,meta={}){
      if(!Array.isArray(changes)||!changes.length) throw new Error('Interface proposal requires at least one change.');
      if(changes.length>64) throw new Error('Interface proposal exceeds 64-change bound.');
      const before=clone(this.state),preview=clone(this.state);
      changes.forEach(change=>applyChange(preview,change));
      preview.revision=before.revision+1;
      preview.metadata=Object.assign({},preview.metadata,{lastProposalSource:cleanString(meta.source||'unknown',120)});
      const digest=hash({before:stateHash(before),changes,after:stateHash(preview)});
      const proposal={
        id:`proposal-${before.revision+1}-${digest}`,
        status:'pending',
        createdAt:now(),
        source:cleanString(meta.source||'unknown',120),
        reason:cleanString(meta.reason||'',500),
        roots:ROOTS.slice(),
        requiresApproval:true,
        beforeHash:stateHash(before),
        afterHash:stateHash(preview),
        changes:clone(changes),
        preview
      };
      this.proposals.set(proposal.id,proposal);
      this.record('interface_proposal','interface change proposal staged',{id:proposal.id,source:proposal.source,changes:changes.length,beforeHash:proposal.beforeHash,afterHash:proposal.afterHash});
      return clone(proposal);
    }
    decide(proposalId,decision,meta={}){
      const proposal=this.proposals.get(String(proposalId));
      if(!proposal) throw new Error(`Unknown interface proposal: ${proposalId}`);
      if(proposal.status!=='pending') throw new Error(`Interface proposal is already ${proposal.status}.`);
      if(!['approved','denied'].includes(decision)) throw new Error('Decision must be approved or denied.');
      if(decision==='denied'){
        proposal.status='denied';proposal.decidedAt=now();proposal.decidedBy=cleanString(meta.by||this.userType,120);
        this.record('interface_decision','interface proposal denied',{id:proposal.id,by:proposal.decidedBy});
        return {proposal:clone(proposal),state:this.snapshot().state};
      }
      if(stateHash(this.state)!==proposal.beforeHash) throw new Error('Interface state changed since proposal; re-plan instead of applying stale change.');
      this.checkpoint(`before:${proposal.id}`);
      this.state=clone(proposal.preview);
      proposal.status='applied';proposal.decidedAt=now();proposal.decidedBy=cleanString(meta.by||this.userType,120);
      this.record('interface_apply','approved interface proposal applied',{id:proposal.id,by:proposal.decidedBy,stateHash:stateHash(this.state),revision:this.state.revision});
      return {proposal:clone(proposal),state:clone(this.state)};
    }
    rollback(checkpointId,meta={}){
      const cp=this.checkpoints.find(item=>item.id===checkpointId);
      if(!cp) throw new Error(`Unknown checkpoint: ${checkpointId}`);
      const previousRevision=this.state.revision;
      const restored=clone(cp.state);
      restored.revision=previousRevision+1;
      restored.metadata=Object.assign({},restored.metadata,{rolledBackFrom:checkpointId,rollbackBy:cleanString(meta.by||this.userType,120)});
      this.state=restored;
      this.record('interface_rollback','interface state restored from checkpoint',{checkpointId,revision:this.state.revision,stateHash:stateHash(this.state)});
      return clone(this.state);
    }
    snapshot(){
      return {
        organFabric:{version:VERSION,schema:STATE_SCHEMA,roots:ROOTS.slice(),surface:this.surface,userType:this.userType},
        state:clone(this.state),
        stateHash:stateHash(this.state),
        organs:this.organReport(),
        supportedOperations:this.supportedOperations(),
        pending:[...this.proposals.values()].filter(p=>p.status==='pending').map(p=>({id:p.id,source:p.source,reason:p.reason,beforeHash:p.beforeHash,afterHash:p.afterHash,changes:clone(p.changes)})),
        checkpoints:this.checkpoints.map(cp=>({id:cp.id,reason:cp.reason,stateHash:cp.stateHash,time:cp.time})),
        evidence:clone(this.evidence)
      };
    }
  }

  return Object.freeze({VERSION,STATE_SCHEMA,ROOTS,COMPONENT_KINDS,BUILTIN_ORGANS,canonical,hash,stateHash,migrateState,InterfaceOrganSystem});
});
