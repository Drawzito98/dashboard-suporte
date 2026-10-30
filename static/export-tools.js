/* Fixed export dependencies. No downloads until an export requests them. */
(function(root){
  'use strict';
  const catalog=Object.freeze({
    image:{url:'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',present:()=>typeof root.html2canvas==='function'},
    pdf:{url:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',present:()=>typeof root.jspdf?.jsPDF==='function'},
    excel:{url:'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',present:()=>typeof root.XLSX?.writeFile==='function'}
  });
  function create({loadScript,session,notify=()=>{}}){
    const pending=new Map();
    function ensure(name){
      if(!Object.prototype.hasOwnProperty.call(catalog,name))return Promise.reject(Error('Formato de exportação desconhecido.'));
      const item=catalog[name];if(item.present())return Promise.resolve();
      if(!pending.has(name)){
        const promise=Promise.resolve().then(()=>loadScript(item.url)).then(()=>{if(!item.present())throw Error('Ferramenta de exportação indisponível.');});
        pending.set(name,promise);promise.catch(()=>{if(pending.get(name)===promise)pending.delete(name);});
      }
      return pending.get(name);
    }
    async function ready(...names){
      const token=session?.token();
      if(token&&!session.current(token))return false;
      try{
        if(names.some(name=>catalog[name]&&!catalog[name].present()))notify('Preparando exportação…','ok');
        await Promise.all(names.map(ensure));
        return !token||session.current(token);
      }catch(_){
        if(!token||session.current(token))notify('Não foi possível preparar a exportação. Verifique a conexão e tente novamente.','error');
        return false;
      }
    }
    return{ready};
  }
  root.ExportDependencies={create};
  if(typeof module!=='undefined')module.exports={create};
  if(typeof document==='undefined')return;
  root.ExportTools=create({session:root.AppDataSession,notify:(...args)=>{if(typeof root.showToast==='function')root.showToast(...args);},loadScript:url=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');let settled=false;
    function finish(error){if(settled)return;settled=true;clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error);}else resolve();}
    script.src=url;script.async=true;script.dataset.exportDependency='true';
    const timer=setTimeout(()=>finish(Error('Tempo de carregamento excedido.')),30000);
    script.onload=()=>finish();script.onerror=()=>finish(Error('Falha ao carregar exportação.'));
    document.head.appendChild(script);
  })});
})(typeof window!=='undefined'?window:globalThis);
