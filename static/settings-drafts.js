// Edição privada separada dos parâmetros oficiais usados pelos indicadores.
window.SettingsDrafts=(()=>{
  const states=new Map(),key=kind=>'sistema_config_rascunho_'+kind+'_v1';
  const clone=value=>JSON.parse(JSON.stringify(value));
  function state(kind){if(!states.has(kind)){let draft=null;try{const v=JSON.parse(appStorage.getItem(key(kind))||'null');if(v&&Array.isArray(v.value)&&typeof v.id==='string')draft=v;}catch(_){}states.set(kind,{draft,busy:false,failed:false});}return states.get(kind);}
  function message(kind,text){const el=document.getElementById('settingsMessage-'+kind);if(el)el.textContent=text;}
  function store(kind,value,raw=null){const s=state(kind);s.draft={id:s.draft?.id||crypto.randomUUID(),value:clone(value),raw};try{appStorage.setItem(key(kind),JSON.stringify(s.draft));s.failed=false;return true;}catch(_){s.failed=true;message(kind,'Não foi possível guardar a edição. Mantenha esta tela aberta.');return false;}}
  function fieldKey(el){return(el.id||el.className)+'|'+(el.dataset.id||el.dataset.ruleId||'');}
  function capture(kind,value,host){const raw={};host.querySelectorAll('input,textarea,select').forEach(el=>{raw[fieldKey(el)]={value:el.value,checked:el.checked};});return store(kind,value,raw);}
  function restore(kind,host){const s=state(kind);for(const el of host.querySelectorAll('input,textarea,select')){const raw=s.draft?.raw?.[fieldKey(el)];if(raw){el.value=raw.value;if(el.type==='checkbox')el.checked=raw.checked;}}if(s.failed)message(kind,'Não foi possível guardar a edição. Mantenha esta tela aberta.');}
  function working(kind,fallback){return clone(state(kind).draft?.value??fallback);}
  function discard(kind){const s=state(kind);if(s.busy||!confirm('Descartar esta edição? Se houve falha de resposta, o último envio pode já ter sido aplicado.'))return false;try{appStorage.removeItem(key(kind));s.draft=null;s.failed=false;return true;}catch(_){s.failed=true;message(kind,'Não foi possível descartar a edição neste dispositivo.');return false;}}
  async function save(kind,value,host,write,render){
    const s=state(kind);if(s.busy||!requireAdmin()||!store(kind,value,s.draft?.raw))return;
    s.busy=true;const token=AppDataSession.token(),controls=[...host.querySelectorAll('button,input,textarea,select')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);host.setAttribute('aria-busy','true');message(kind,'Aguardando confirmação do servidor…');
    try{await write(clone(value),s.draft.id);if(AppDataSession.current(token)){try{appStorage.removeItem(key(kind));s.draft=null;s.failed=false;}catch(_){s.failed=true;}s.busy=false;render();message(kind,s.failed?'Configuração confirmada, mas a edição local ainda precisa ser conferida.':'Configuração confirmada.');}}
    catch(error){if(AppDataSession.current(token))message(kind,error.message||'Configuração não confirmada. A edição foi mantida.');}
    finally{s.busy=false;host.removeAttribute('aria-busy');controls.forEach((el,i)=>{if(el.isConnected)el.disabled=disabled[i];});}
  }
  window.addEventListener('beforeunload',event=>{if([...states.values()].some(s=>s.busy||s.failed)){event.preventDefault();event.returnValue='';}});
  window.addEventListener('settings-confirmed',event=>{if(event.detail?.kind==='alertas'&&typeof renderInsights==='function')renderInsights();});
  return{working,store,capture,restore,discard,save,message,busy:kind=>state(kind).busy};
})();
