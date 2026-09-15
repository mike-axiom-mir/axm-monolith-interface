(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.AXMChatTransport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='0.1.0';
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function trimSlash(s){return String(s||'').replace(/\/+$/,'');}
  function now(){return new Date().toISOString();}
  function normalizeProvider(v){
    v=String(v||'auto').toLowerCase();
    return ['auto','local','claude','chatgpt'].includes(v)?v:'auto';
  }

  function buildSystemContext(host){
    const s=host&&typeof host.snapshot==='function'?host.snapshot():null;
    if(!s||!s.connection||!s.connection.connected){
      return 'You are communicating through the AXM Monolith Interface. No monolith cartridge is connected. Do not claim access to one.';
    }
    const m=s.cartridge;
    const caps=(m.capabilities||[]).map(c=>`${c.id}:${c.status}`).join(', ')||'none';
    const perms=Object.entries(s.permissions||{}).map(([k,v])=>`${k}:${v}`).join(', ')||'none';
    return [
      'You are communicating through the AXM Monolith Interface.',
      `Connected cartridge: ${m.name} (${m.id}) version ${m.version}.`,
      `Capability truth: ${caps}.`,
      `Current permission decisions: ${perms}.`,
      'Declared capability is not proof of execution. Do not claim actions happened without an execution receipt.',
      'Preserve Truth, Agency/non-domination, Continuity, and Wisdom before speed.'
    ].join('\n');
  }

  class ChatSession{
    constructor(options={}){
      this.host=options.host||null;
      this.fetchImpl=options.fetchImpl||((typeof fetch==='function')?fetch.bind(globalThis):null);
      this.baseUrl=trimSlash(options.baseUrl||'http://127.0.0.1:8787');
      this.token=String(options.token||'');
      this.provider=normalizeProvider(options.provider);
      this.model=options.model?String(options.model):'';
      this.messages=[];
      this.lastHealth=null;
      this.record('chat_transport_boot','chat transport created',{baseUrl:this.baseUrl,provider:this.provider});
    }

    record(type,message,data=null){
      if(this.host&&typeof this.host.record==='function') return this.host.record(type,message,data);
      return {time:now(),type,message,data};
    }

    configure(options={}){
      if(options.baseUrl!==undefined) this.baseUrl=trimSlash(options.baseUrl);
      if(options.token!==undefined) this.token=String(options.token||'');
      if(options.provider!==undefined) this.provider=normalizeProvider(options.provider);
      if(options.model!==undefined) this.model=String(options.model||'');
      this.record('chat_transport_config','chat transport configuration changed',{baseUrl:this.baseUrl,provider:this.provider,hasToken:!!this.token,model:this.model||null});
      return this.config();
    }

    config(){return {baseUrl:this.baseUrl,provider:this.provider,model:this.model,hasToken:!!this.token};}
    history(){return clone(this.messages);}
    clear(){this.messages=[];this.record('chat_clear','conversation cleared');return this.history();}

    async request(path,options={}){
      if(!this.fetchImpl) throw new Error('No fetch implementation available.');
      if(!this.baseUrl) throw new Error('No machine bridge URL configured.');
      const headers=Object.assign({'content-type':'application/json'},options.headers||{});
      if(this.token) headers['x-axm-token']=this.token;
      const res=await this.fetchImpl(this.baseUrl+path,Object.assign({},options,{headers}));
      let body={};
      try{body=await res.json();}catch(_){throw new Error(`Bridge returned non-JSON response (${res.status}).`);}
      if(!res.ok) throw new Error(body.error||`Bridge request failed (${res.status}).`);
      return body;
    }

    async health(){
      const body=await this.request('/health',{method:'GET'});
      this.lastHealth=clone(body);
      this.record('chat_health','machine bridge health checked',{ok:!!body.ok,locked:body.locked!==false});
      return clone(body);
    }

    async send(text,options={}){
      text=String(text||'').trim();
      if(!text) throw new Error('Message is empty.');
      if(!this.host||!this.host.snapshot().connection.connected) throw new Error('Connect a monolith before starting a machine conversation.');
      const user={role:'user',content:text,time:now()};
      this.messages.push(user);
      this.record('chat_send','message sent to connected machine',{chars:text.length,provider:this.provider});
      const provider=normalizeProvider(options.provider||this.provider);
      const opts={
        aiProvider:provider==='auto'?undefined:provider,
        system:options.system||buildSystemContext(this.host),
        maxTokens:Number(options.maxTokens||1024)
      };
      const model=options.model||this.model;
      if(model) opts.model=String(model);
      const payload={messages:this.messages.map(m=>({role:m.role,content:m.content})),opts};
      try{
        const body=await this.request('/ask',{method:'POST',body:JSON.stringify(payload)});
        const assistant={role:'assistant',content:String(body.text||''),provider:String(body.provider||provider||'unknown'),time:now()};
        this.messages.push(assistant);
        this.record('chat_receive','machine response received',{chars:assistant.content.length,provider:assistant.provider});
        return clone(assistant);
      }catch(err){
        this.record('chat_error','machine conversation failed',{error:String(err&&err.message?err.message:err)});
        throw err;
      }
    }
  }

  return Object.freeze({VERSION,ChatSession,buildSystemContext,normalizeProvider});
});
