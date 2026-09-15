(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;}
  if(root){root.AXMInterfaceRenderer=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='0.1.0-experimental';

  function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
  function getPath(object,path){
    if(!object||typeof path!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(path)) return undefined;
    return path.split('.').reduce((value,key)=>value&&typeof value==='object'?value[key]:undefined,object);
  }
  function text(value){
    if(value===null||value===undefined) return '';
    if(typeof value==='string') return value;
    if(typeof value==='number'||typeof value==='boolean') return String(value);
    return JSON.stringify(value);
  }
  function sourceValue(props,context){
    return props&&props.source?getPath(context,String(props.source)):undefined;
  }
  function materializeComponent(component,context={}){
    const props=component&&component.props&&typeof component.props==='object'?component.props:{};
    const base={id:component.id,kind:component.kind,slot:component.slot||'main',order:Number(component.order||0),visible:component.visible!==false};
    if(component.kind==='text') return Object.assign(base,{text:text(props.text)});
    if(component.kind==='status'||component.kind==='metric') return Object.assign(base,{label:text(props.label||component.id),value:text(sourceValue(props,context)??props.value)});
    if(component.kind==='panel') return Object.assign(base,{title:text(props.title||''),body:text(props.body||'')});
    if(component.kind==='list') return Object.assign(base,{label:text(props.label||''),items:Array.isArray(props.items)?props.items.map(text):[]});
    if(component.kind==='capability-list'){
      const caps=Array.isArray(context.capabilities)?context.capabilities:[];
      const filter=Array.isArray(props.statusFilter)?new Set(props.statusFilter.map(String)):null;
      return Object.assign(base,{items:caps.filter(c=>!filter||filter.has(String(c.status))).map(c=>({id:String(c.id||''),name:text(c.name||c.id),status:text(c.status||'declared'),description:text(c.description||'')}))});
    }
    if(component.kind==='permission-list'){
      const permissions=context.permissions&&typeof context.permissions==='object'?context.permissions:{};
      return Object.assign(base,{items:Object.entries(permissions).map(([id,decision])=>({id,decision:text(decision)}))});
    }
    if(component.kind==='evidence-log'){
      const rows=Array.isArray(context.evidence)?context.evidence:[];
      return Object.assign(base,{items:rows.slice(-(Number(props.limit)||50)).map(row=>({seq:row.seq,time:text(row.time),type:text(row.type),message:text(row.message)}))});
    }
    if(component.kind==='action') return Object.assign(base,{label:text(props.label||component.id),actionId:text(props.actionId||component.id),disabled:props.disabled===true});
    if(component.kind==='chat') return Object.assign(base,{label:text(props.label||'Conversation'),messages:Array.isArray(context.messages)?clone(context.messages):[]});
    if(component.kind==='spacer') return Object.assign(base,{size:Math.max(0,Math.min(10,Number(props.size)||1))});
    return base;
  }
  function materializeSurface(state,surfaceId,context={}){
    if(!state||!state.surfaces||!state.surfaces[surfaceId]) throw new Error(`Unknown interface surface: ${surfaceId}`);
    const surface=state.surfaces[surfaceId];
    return {
      id:surface.id,
      title:text(surface.title),
      description:text(surface.description),
      layout:surface.layout||'stack',
      components:(Array.isArray(surface.components)?surface.components:[]).filter(c=>c.visible!==false).map(c=>materializeComponent(c,context)).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))
    };
  }
  function appendText(doc,parent,tag,value,className){
    const node=doc.createElement(tag);if(className)node.className=className;node.textContent=text(value);parent.appendChild(node);return node;
  }
  function renderItemList(doc,parent,items){
    const list=doc.createElement('div');list.className='axm-organ-list';
    items.forEach(item=>{
      const row=doc.createElement('div');row.className='axm-organ-list-row';
      if(item&&typeof item==='object') row.textContent=[item.name||item.id||item.type||'',item.status||item.decision||item.message||''].filter(Boolean).join(' · ');
      else row.textContent=text(item);
      list.appendChild(row);
    });
    parent.appendChild(list);
  }
  function renderSurface(container,state,surfaceId,context={}){
    if(!container||!container.ownerDocument) throw new Error('Renderer requires a DOM container.');
    const doc=container.ownerDocument,model=materializeSurface(state,surfaceId,context);
    while(container.firstChild)container.removeChild(container.firstChild);
    container.dataset.axmSurface=model.id;container.dataset.axmLayout=model.layout;
    if(model.title)appendText(doc,container,'h2',model.title,'axm-organ-surface-title');
    if(model.description)appendText(doc,container,'p',model.description,'axm-organ-surface-description');
    const body=doc.createElement('div');body.className='axm-organ-surface-body';container.appendChild(body);
    model.components.forEach(component=>{
      const node=doc.createElement('section');node.className=`axm-organ-component axm-organ-${component.kind}`;node.dataset.componentId=component.id;node.dataset.slot=component.slot;node.dataset.kind=component.kind;
      if(component.kind==='text') appendText(doc,node,'p',component.text);
      else if(component.kind==='status'||component.kind==='metric'){appendText(doc,node,'strong',component.label);appendText(doc,node,'span',component.value);}
      else if(component.kind==='panel'){if(component.title)appendText(doc,node,'strong',component.title);if(component.body)appendText(doc,node,'p',component.body);}
      else if(component.kind==='list'){if(component.label)appendText(doc,node,'strong',component.label);renderItemList(doc,node,component.items);}
      else if(['capability-list','permission-list','evidence-log'].includes(component.kind)) renderItemList(doc,node,component.items);
      else if(component.kind==='action'){
        const button=doc.createElement('button');button.type='button';button.textContent=component.label;button.disabled=component.disabled;button.dataset.actionId=component.actionId;
        button.addEventListener('click',()=>{
          if(typeof container.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function') container.dispatchEvent(new CustomEvent('axm-interface-action',{bubbles:true,detail:{surfaceId:model.id,componentId:component.id,actionId:component.actionId}}));
        });
        node.appendChild(button);
      }
      else if(component.kind==='chat'){appendText(doc,node,'strong',component.label);renderItemList(doc,node,component.messages.map(m=>typeof m==='object'?`${m.role||'message'}: ${m.content||''}`:m));}
      else if(component.kind==='spacer'){node.setAttribute('aria-hidden','true');node.dataset.size=String(component.size);}
      body.appendChild(node);
    });
    return clone(model);
  }

  return Object.freeze({VERSION,getPath,materializeComponent,materializeSurface,renderSurface});
});
