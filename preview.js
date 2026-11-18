/* Public shared testing mode. The staff-only Supabase tables remain protected. */
(() => {
  'use strict';
  const endpoint='https://tzrumhqtimdrytqqhclc.supabase.co/rest/v1/';
  const key='sb_publishable_-6EiRnqvJSrz2nMsK9dBAg_p7R75W74';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const fingerprint=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  const starter=copy(S), status=document.getElementById('previewStatus');
  let ready=false, pending=false, saving=false, blocked=false, initializing=false, refreshing=false;
  let version=0, baseline='', cache=null, timer;
  const data=()=>{const value=copy(S);delete value.cur;delete value.user;return value;};
  function editing(enabled) {
    document.getElementById('v').inert=!enabled;
    document.getElementById('nav').inert=!enabled;
    document.getElementById('user').disabled=!enabled;
  }
  function announce(message,recover=false) {
    status.replaceChildren(document.createTextNode(message));
    if(recover) {
      const download=document.createElement('button');download.textContent='Download unsaved copy';download.onclick=backup;
      const reload=document.createElement('button');reload.textContent='Reload shared data';reload.onclick=()=>{if(confirm('Download your unsaved copy first if needed. Discard unsaved changes and reload?'))location.reload();};
      status.append(download,reload);
    }
  }
  function backup() {
    const url=URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),version,data:data()},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='gourmandise-testing-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function api(path,body) {
    const response=await fetch(endpoint+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();
    if(!response.ok)throw Error(result.message||'Shared saving is unavailable.');
    return result;
  }
  function applyRecord(row) {
    const cur=S.cur,user=S.user;
    S=copy(row.data);S.cur=S.items[cur]&&!S.items[cur].archived?cur:(S.items.find(i=>!i.archived)?.id||0);S.user=user||'';
    salesMonth=S.salesEntryMonth||salesMonth;
    for(let i=PRODUCTION_SCHEDULE.length-1;i>=0;i--)if(PRODUCTION_SCHEDULE[i].custom)PRODUCTION_SCHEDULE.splice(i,1);
    restoreCustomProductionSchedule();
    version=Number(row.version);baseline=fingerprint(data());cache=JSON.stringify(S);
  }
  function failed(error) {
    blocked=true;editing(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    announce('Changes have NOT been saved online. '+error.message,true);
  }
  function save() {
    cache=JSON.stringify(S);
    if(!ready||blocked||fingerprint(data())===baseline&&!saving)return;
    pending=true;announce('Saving shared test changes… Keep this tab open.');
    clearTimeout(timer);timer=setTimeout(flush,250);
  }
  async function flush() {
    if(!pending||saving||blocked||!ready)return;
    pending=false;saving=true;
    const snapshot=data(),sent=fingerprint(snapshot);
    try {
      const row=await api('rpc/erp_preview_save',{p_data:snapshot,p_version:version});
      version=Number(row.version);baseline=fingerprint(row.data);
      pending=fingerprint(data())!==sent;
      announce(pending?'Saving more shared changes…':'Shared testing · All changes saved online. No sign-in required.');
    } catch(error) {pending=true;failed(error);}
    finally {saving=false;if(pending&&!blocked)void flush();}
  }
  async function initialize(fromBrowser) {
    if(initializing||ready)return;
    initializing=true;
    try {
      S=copy(starter);
      if(fromBrowser) {
        const stored=localStorage.getItem('bakery5');
        if(!stored)throw Error('No earlier bakery data was found in this browser on this website.');
        const candidate=JSON.parse(stored);
        if(!candidate||!['items','tx','sales','orders'].every(k=>Array.isArray(candidate[k])))throw Error('The browser data is incomplete.');
        S=candidate;ensureScheduleCatalog();ensureForecastCatalog();restoreCustomProductionSchedule();enforcePlanProductCatalog();S.weekdayExtras||={};S.forecastOverrides||={};
      }
      const row=await api('rpc/erp_preview_save',{p_data:data(),p_version:version});
      applyRecord(row);ready=true;render();editing(true);
      announce('Shared testing · All changes saved online. No sign-in required.');
    } catch(error){announce(error.message+' Reload if another person already initialized the shared copy.');}
    finally{initializing=false;}
  }
  async function start() {
    editing(false);
    try {
      const rows=await api('erp_preview_state?select=data,version&id=eq.1');
      if(rows.length!==1)throw Error('The shared testing row is missing.');
      version=Number(rows[0].version);
      if(!rows[0].data) {
        document.getElementById('nav').innerHTML='';
        document.getElementById('v').innerHTML='<section class="card"><h2>Start shared testing</h2><p>This copy is editable by anyone with access to the site. Choose the starting data once; other devices will load the same copy.</p><button class="p" onclick="ERPPreview.initialize(false)">Start with the sample catalog and records</button><button class="s" onclick="ERPPreview.initialize(true)">Share this browser’s earlier bakery data</button></section>';
        document.getElementById('v').inert=false;
        announce('Shared testing · Choose starting data once. No sign-in required.');return;
      }
      applyRecord(rows[0]);ready=true;render();editing(true);
      announce('Shared testing · All changes saved online. No sign-in required.');
    } catch(error) {
      document.getElementById('nav').innerHTML='';
      document.getElementById('v').textContent='The shared testing database needs its setup SQL. Once setup is complete, refresh this page.';
      announce('Shared testing is not ready yet. '+error.message);
    }
  }
  setInterval(async()=>{
    if(!ready||pending||saving||blocked||refreshing||document.hidden||document.querySelector('dialog[open]')||/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName))return;
    refreshing=true;
    try {
      const rows=await api('erp_preview_state?select=data,version&id=eq.1');
      if(rows[0]?.data&&Number(rows[0].version)!==version&&!pending&&!saving&&!blocked) {
        applyRecord(rows[0]);render();announce('Shared testing · Updated with the latest changes from another device.');
      }
    } catch(error){announce('Could not refresh shared data. '+error.message);}
    finally{refreshing=false;}
  },10000);
  window.addEventListener('beforeunload',event=>{if(pending||saving||blocked){event.preventDefault();event.returnValue='';}});
  window.ERPPreview={save,initialize,backup,cacheGet:()=>cache,cacheSet:value=>{cache=value;}};
  void start();
})();
