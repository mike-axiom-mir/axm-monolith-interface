(()=>{
  const Core=window.AXMHostCore,Chat=window.AXMChatTransport;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const host=new Core.HostSession({surface:'human-mobile-phone-local',userType:'human'});
  const savedProvider=localStorage.getItem('axm-phone-provider')||'chatgpt';
  const chat=new Chat.ChatSession({host,baseUrl:location.origin,provider:savedProvider});
  let health=null,busy=false,installing=false;

  function view(v){$$('.view').forEach(x=>x.hidden=x.id!==`view-${v}`);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));}
  function bubble(role,text){const b=document.createElement('div');b.className='bubble '+role;b.textContent=text;$('#messages').appendChild(b);b.scrollIntoView({block:'end',behavior:'smooth'});}
  function configured(name){if(!health||!health.providers)return false;if(name==='auto')return Object.values(health.providers).some(x=>x&&x.configured);return !!(health.providers[name]&&health.providers[name].configured);}
  function providerLabel(name){if(name==='chatgpt')return 'OpenAI route';if(name==='local')return 'phone-local model';if(name==='codex')return 'Codex local seat';if(name==='claude')return 'Claude compatibility';return 'automatic available route';}
  function syncProviderOptions(){
    const codex=$('#provider').querySelector('option[value="codex"]');
    const claude=$('#provider').querySelector('option[value="claude"]');
    if(codex)codex.disabled=!(health&&health.providers&&health.providers.codex&&health.providers.codex.configured);
    if(claude)claude.disabled=!(health&&health.providers&&health.providers.claude&&health.providers.claude.configured);
    if(![...$('#provider').options].some(o=>o.value===$('#provider').value&&!o.disabled)){
      const fallback=configured('chatgpt')?'chatgpt':(configured('auto')?'auto':'chatgpt');
      $('#provider').value=fallback;chat.configure({provider:fallback});
    }
  }
  function ready(){
    const bridge=!!(health&&health.ok),monolith=host.snapshot().connection.connected,mind=configured($('#provider').value),ok=bridge&&monolith&&mind&&!busy&&!installing;
    $('#message').disabled=!ok;$('#send').disabled=!ok;$('#bridgeState').textContent=bridge?'bridge local':'bridge offline';$('#bridgeState').classList.toggle('live',bridge);
    $('#mindStatus').textContent=mind?'Intelligence ready':'No active intelligence route';
    $('#mindMeta').textContent=mind?providerLabel($('#provider').value):'OpenAI, local model, Codex, or compatibility provider can attach here';
    $('#zipBtn').disabled=installing;$('#manifestBtn').disabled=installing;
  }
  function render(){
    const s=host.snapshot(),m=s.cartridge,bridgeMonolith=health&&health.monolith;
    $('#monolithStatus').textContent=m?m.name:(bridgeMonolith&&bridgeMonolith.installed?'Archive installed':'No monolith');
    const bodyOnly=!!(m&&m.provenance&&m.provenance.interfaceManifest===false);
    $('#monolithMeta').textContent=m?`${bodyOnly?'body-only · ':''}v${m.version} · ${s.counts.capabilities} capabilities`:'choose a monolith ZIP or manifest';
    $('#archiveMeta').textContent=bridgeMonolith&&bridgeMonolith.archiveName?`Active archive: ${bridgeMonolith.archiveName}${bridgeMonolith.interfaceManifest===false?' · no native interface manifest':''}`:'No ZIP activated yet.';
    const caps=host.listCapabilities();
    $('#caps').innerHTML=caps.length?caps.map(c=>`<div class="cap"><strong>${esc(c.name)}</strong><span>${esc(c.description)}</span><span class="tag">${esc(c.status)}</span></div>`).join(''):`<div class="empty">${bodyOnly?'Archive is connected body-only. No capabilities were invented.':'No identified monolith capabilities.'}</div>`;
    const p=m?m.permissions:[];
    $('#permissions').innerHTML=p.length?p.map(x=>`<div class="perm"><div><strong>${esc(x.id)}</strong><span>${esc(x.description||x.scope)}</span></div><select data-perm="${esc(x.id)}"><option value="unreviewed">Review</option><option value="approved">Allow</option><option value="denied">Deny</option></select></div>`).join(''):'<div class="empty">No permission requests.</div>';
    Object.entries(s.permissions).forEach(([id,val])=>{const el=document.querySelector(`[data-perm="${CSS.escape(id)}"]`);if(el)el.value=val;});
    $$('[data-perm]').forEach(el=>el.onchange=()=>{host.setPermission(el.dataset.perm,el.value);render();});
    $('#log').textContent=s.evidence.map(e=>`[${e.time}] ${e.type.toUpperCase()}\n${e.message}${e.data?'\n'+JSON.stringify(e.data):''}\n`).join('\n');
    syncProviderOptions();ready();
  }
  async function refreshHealth(){health=await chat.health();return health;}
  async function attach(){
    try{await refreshHealth();host.record('phone_bridge_attach','phone-local bridge attached',{mode:health.mode,monolith:health.monolith,providers:health.providers});}
    catch(err){host.record('phone_bridge_error','phone-local bridge unavailable',{error:String(err.message||err)});bubble('system','Phone-local bridge unavailable: '+String(err.message||err));render();return;}
    try{const r=await fetch('/monolith',{headers:{accept:'application/json'}});if(r.ok){const j=await r.json();host.load(j.manifest);bubble('system','Monolith attached locally: '+host.snapshot().cartridge.name);}else bubble('system','Bridge is ready. Choose a monolith ZIP to connect this phone.');}
    catch(err){host.record('monolith_attach_error','monolith identity load failed',{error:String(err.message||err)});}
    render();
  }
  async function installZip(file){
    installing=true;host.record('zip_import_start','monolith ZIP import started',{name:file.name,size:file.size});bubble('system',`Importing ${file.name} into the phone-local monolith store…`);render();
    try{
      const r=await fetch('/monolith/install-zip',{method:'POST',headers:{'content-type':'application/zip','x-axm-filename':file.name},body:file});
      const j=await r.json();if(!r.ok)throw new Error(j.error||'ZIP import failed');
      host.load(j.manifest);await refreshHealth();
      const native=!!(j.pointer&&j.pointer.interfaceManifest);
      host.record('zip_import_complete','monolith ZIP activated',{archive:j.pointer&&j.pointer.archiveName,sha256:j.pointer&&j.pointer.archiveSha256,interfaceManifest:native});
      bubble('system',native?`Connected ${j.pointer.archiveName} with its native interface manifest.`:`Connected ${j.pointer.archiveName} in body-only mode. The archive is installed, but no capabilities were inferred.`);
    }catch(err){host.record('zip_import_error','monolith ZIP import failed',{error:String(err.message||err)});bubble('system','ZIP import failed: '+String(err.message||err));}
    finally{installing=false;$('#zipFile').value='';render();}
  }
  async function installManifest(file){
    installing=true;render();
    try{const manifest=JSON.parse(await file.text());const r=await fetch('/monolith/install-manifest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest})});const j=await r.json();if(!r.ok)throw new Error(j.error||'manifest install failed');host.load(manifest);await refreshHealth();bubble('system','Interface manifest connected: '+host.snapshot().cartridge.name);}
    catch(err){host.record('manifest_install_error','phone manifest install failed',{error:String(err.message||err)});bubble('system','Manifest install failed: '+String(err.message||err));}
    finally{installing=false;$('#manifestFile').value='';render();}
  }
  async function send(){const text=$('#message').value.trim();if(!text||busy)return;busy=true;$('#message').value='';bubble('user',text);ready();try{chat.configure({provider:$('#provider').value});const r=await chat.send(text);bubble('assistant',r.content||'(empty response)');}catch(err){bubble('system','Message failed: '+String(err.message||err));}finally{busy=false;render();}}

  $$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
  $('#provider').value=[...$('#provider').options].some(o=>o.value===savedProvider)?savedProvider:'chatgpt';
  $('#provider').onchange=()=>{localStorage.setItem('axm-phone-provider',$('#provider').value);chat.configure({provider:$('#provider').value});host.record('provider_preference','phone intelligence route changed',{provider:$('#provider').value});render();};
  $('#zipBtn').onclick=()=>$('#zipFile').click();$('#zipFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)installZip(f);};
  $('#manifestBtn').onclick=()=>$('#manifestFile').click();$('#manifestFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)installManifest(f);};
  $('#send').onclick=send;$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
  render();attach();
})();
