(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  if(root){root.AXMHostCore=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='0.3.0-interface-organs';
  const ROOTS=Object.freeze(['truth','agency','continuity','wisdom']);

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function now(){return new Date().toISOString();}
  function asArray(v){return Array.isArray(v)?v:[];}

  function normalizeCapability(c,index){
    if(typeof c==='string') return {id:c,name:c,description:'',status:'declared',permissions:[],surfaces:[]};
    c=c&&typeof c==='object'?c:{};
    return {
      id:String(c.id||`cap-${index+1}`),
      name:String(c.name||c.id||`Capability ${index+1}`),
      description:String(c.description||''),
      status:['declared','verified','blocked','experimental'].includes(c.status)?c.status:(c.verified?'verified':'declared'),
      permissions:asArray(c.permissions).map(String),
      surfaces:asArray(c.surfaces).map(String),
      machineOperations:asArray(c.machineOperations).map(String),
      evidence:asArray(c.evidence)
    };
  }

  function normalizeManifest(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('Cartridge manifest must be an object.');
    const id=raw.id||raw.name;
    if(!id) throw new Error('Cartridge manifest requires id or name.');
    const capabilities=asArray(raw.capabilities).map(normalizeCapability);
    const permissions=asArray(raw.permissions).map(p=>{
      if(typeof p==='string') return {id:p,description:'',scope:'cartridge'};
      p=p&&typeof p==='object'?p:{};
      return {id:String(p.id||''),description:String(p.description||''),scope:String(p.scope||'cartridge')};
    }).filter(p=>p.id);
    return {
      contractVersion:String(raw.contractVersion||'0.1'),
      id:String(id),
      name:String(raw.name||id),
      version:String(raw.version||'unknown'),
      description:String(raw.description||''),
      capabilities,
      permissions,
      surfaces:asArray(raw.surfaces),
      machine:raw.machine&&typeof raw.machine==='object'?clone(raw.machine):{},
      personalization:raw.personalization&&typeof raw.personalization==='object'?clone(raw.personalization):{},
      interface:raw.interface&&typeof raw.interface==='object'&&!Array.isArray(raw.interface)?clone(raw.interface):{},
      provenance:raw.provenance&&typeof raw.provenance==='object'?clone(raw.provenance):{}
    };
  }

  class HostSession{
    constructor(options={}){
      this.surface=String(options.surface||'unknown');
      this.userType=String(options.userType||'human');
      this.cartridge=null;
      this.permissions=new Map();
      this.evidence=[];
      this.preferences=options.preferences&&typeof options.preferences==='object'?clone(options.preferences):{};
      this.record('boot','host session created',{surface:this.surface,userType:this.userType,version:VERSION});
    }

    record(type,message,data=null){
      const row={seq:this.evidence.length+1,time:now(),type:String(type),message:String(message),data:data===undefined?null:clone(data)};
      this.evidence.push(row);return clone(row);
    }

    load(raw){
      const manifest=normalizeManifest(raw);
      this.cartridge=manifest;
      this.permissions.clear();
      manifest.permissions.forEach(p=>this.permissions.set(p.id,'unreviewed'));
      this.record('connect','cartridge manifest loaded',{id:manifest.id,version:manifest.version,capabilities:manifest.capabilities.length,interfacePlan:!!(manifest.interface&&Array.isArray(manifest.interface.changes)&&manifest.interface.changes.length)});
      return this.snapshot();
    }

    disconnect(){
      const id=this.cartridge&&this.cartridge.id;
      this.cartridge=null;this.permissions.clear();
      this.record('disconnect','cartridge disconnected',{id:id||null});
      return this.snapshot();
    }

    setPreference(key,value){
      this.preferences[String(key)]=clone(value);
      this.record('preference','local presentation preference changed',{key:String(key)});
      return clone(this.preferences);
    }

    setPermission(id,decision){
      if(!this.cartridge) throw new Error('No cartridge loaded.');
      if(!this.permissions.has(id)) throw new Error(`Unknown permission: ${id}`);
      if(!['approved','denied','unreviewed'].includes(decision)) throw new Error('Permission decision must be approved, denied, or unreviewed.');
      this.permissions.set(id,decision);
      this.record('permission','permission decision changed',{id,decision});
      return this.permissionState();
    }

    permissionState(){return Object.fromEntries(this.permissions.entries());}

    listCapabilities(){return this.cartridge?clone(this.cartridge.capabilities):[];}

    capability(id){return this.cartridge?clone(this.cartridge.capabilities.find(c=>c.id===id)||null):null;}

    proposeAction(capabilityId,operation,input={}){
      if(!this.cartridge) throw new Error('No cartridge loaded.');
      const cap=this.cartridge.capabilities.find(c=>c.id===capabilityId);
      if(!cap) throw new Error(`Unknown capability: ${capabilityId}`);
      const missing=cap.permissions.filter(id=>this.permissions.get(id)!=='approved');
      const receipt={
        receiptId:`axm-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        time:now(),
        cartridgeId:this.cartridge.id,
        capabilityId,
        operation:String(operation||''),
        input:clone(input),
        permissionsSatisfied:missing.length===0,
        missingPermissions:missing,
        execution:'not_executed',
        reason:missing.length?'permission_not_approved':'runtime_adapter_not_wired'
      };
      this.record('action_proposal','action proposal recorded',receipt);
      return clone(receipt);
    }

    snapshot(){
      const caps=this.listCapabilities();
      return {
        host:{version:VERSION,surface:this.surface,userType:this.userType,roots:ROOTS},
        connection:{connected:!!this.cartridge,cartridge:this.cartridge?{id:this.cartridge.id,name:this.cartridge.name,version:this.cartridge.version}:null},
        counts:{capabilities:caps.length,verified:caps.filter(c=>c.status==='verified').length,permissions:this.permissions.size},
        permissions:this.permissionState(),
        preferences:clone(this.preferences),
        cartridge:this.cartridge?clone(this.cartridge):null,
        evidence:clone(this.evidence)
      };
    }
  }

  return Object.freeze({VERSION,ROOTS,normalizeManifest,HostSession});
});
