/* Supabase's publishable key is public. Staff membership and SQL rules enforce access. */
(() => {
  'use strict';
  const URL = 'https://tzrumhqtimdrytqqhclc.supabase.co';
  const KEY = 'sb_publishable_-6EiRnqvJSrz2nMsK9dBAg_p7R75W74';
  const SESSION_KEY = 'gourmandise.supabase.session.v1';
  let session = null, version = 0, baseline = '', pending = false, saving = false;
  let ready = false, blocked = false, busy = false, timer, epoch = 0, cache = null;
  let selectedProduct = 0, employeeName = '', refreshing = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const fingerprint = value => JSON.stringify(value, (_,v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
  const starter = clone(S);
  const status = document.createElement('aside');
  status.id = 'cloudStatus';
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'position:sticky;top:0;z-index:1000;background:#fff7dc;border:1px solid #c7a44b;padding:12px;color:#292113;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
  document.body.prepend(status);
  function announce(text, actions = false) {
    status.replaceChildren(document.createTextNode(text));
    if (actions) {
      const backup = document.createElement('button');
      backup.textContent = 'Download unsaved copy';
      backup.onclick = exportDraft;
      const reload = document.createElement('button');
      reload.textContent = 'Reload shared data';
      reload.onclick = () => {
        if (confirm('Download your unsaved copy first if needed. Reload and discard unsaved changes?')) location.reload();
      };
      status.append(backup, reload);
    }
  }
  function exportDraft() {
    const blob = new Blob([JSON.stringify({exported_at:new Date().toISOString(), version, data:sharedData()}, null, 2)], {type:'application/json'});
    const url = globalThis.URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'gourmandise-unsaved-backup.json'; link.click();
    setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000);
  }
  function sharedData() { const data = clone(S); delete data.cur; delete data.user; return data; }
  function rememberSession(value) {
    session = value;
    try { if(value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); } catch {}
  }
  async function authRequest(path, body) {
    const response = await fetch(URL + '/auth/v1/' + path, {
      method:'POST', headers:{apikey:KEY,'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.msg || result.error_description || result.message || 'Sign-in failed.');
    return result;
  }
  async function refreshSession() {
    if (!session) throw new Error('Sign in again to continue.');
    if (Number(session.expires_at) * 1000 > Date.now() + 60000) return;
    if(!refreshing) refreshing = (async () => {
      const requestEpoch = epoch;
      const result = await authRequest('token?grant_type=refresh_token', {refresh_token:session.refresh_token});
      if (requestEpoch !== epoch) throw new Error('Session changed. Sign in again.');
      rememberSession(result);
    })().finally(() => { refreshing = null; });
    await refreshing;
  }
  async function api(path, body) {
    await refreshSession();
    const response = await fetch(URL + '/rest/v1/' + path, {
      method:body === undefined ? 'GET' : 'POST',
      headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not reach shared storage.');
    return result;
  }
  function applyRecord(row) {
    selectedProduct = S?.cur || 0; employeeName = S?.user || employeeName;
    S = clone(row.data);
    S.cur = S.items[selectedProduct] && !S.items[selectedProduct].archived ? selectedProduct : (S.items.find(i=>!i.archived)?.id || 0);
    S.user = employeeName;
    salesMonth = S.salesEntryMonth || salesMonth;
    for(let i=PRODUCTION_SCHEDULE.length-1;i>=0;i--) if(PRODUCTION_SCHEDULE[i].custom) PRODUCTION_SCHEDULE.splice(i,1);
    restoreCustomProductionSchedule();
    version = Number(row.version); baseline = fingerprint(sharedData()); cache = JSON.stringify(S);
  }
  function lock(error) {
    blocked = true;
    document.getElementById('v').inert = true;
    document.getElementById('nav').inert = true;
    document.getElementById('user').disabled = true;
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    announce('Changes have NOT been saved online. '+error.message+' Download your unsaved copy before reloading.', true);
  }
  async function flush() {
    if (!pending || saving || blocked || !ready) return;
    pending = false; saving = true;
    const requestEpoch = epoch, outgoing = sharedData(), serialized = fingerprint(outgoing);
    announce('Saving changes online… Keep this tab open.');
    try {
      const row = await api('rpc/erp_save', {p_data:outgoing,p_version:version});
      if (requestEpoch !== epoch) return;
      version = Number(row.version); baseline = fingerprint(row.data);
      // Incorporate server-stamped inventory audit fields without discarding later edits.
      if(fingerprint(sharedData()) === serialized) {
        S.tx = clone(row.data.tx); cache = JSON.stringify(S);
      } else {
        for(let i=0;i<outgoing.tx.length;i++) if(fingerprint(S.tx[i])===fingerprint(outgoing.tx[i])) S.tx[i]=clone(row.data.tx[i]);
        pending = fingerprint(sharedData()) !== baseline;
      }
      announce(pending ? 'Saving more changes…' : 'All changes saved online.');
    } catch(error) { if(requestEpoch === epoch) { pending = true; lock(error); } }
    finally { saving = false; if(pending && !blocked) void flush(); }
  }
  function saveShared() {
    cache = JSON.stringify(S);
    if(!ready || blocked) return;
    if(fingerprint(sharedData()) === baseline && !saving) return;
    pending = true;
    announce('Changes waiting to save online…');
    clearTimeout(timer); timer = setTimeout(flush, 250);
  }
  async function openBakery() {
    const members = await api('erp_members?select=role');
    if(!members.length) throw new Error('Your account has no bakery access yet. Ask your administrator to add you as staff.');
    const role = members[0].role;
    const rows = await api('erp_state?select=data,version&id=eq.1');
    if(rows.length !== 1) throw new Error('The bakery database is not set up yet. Run the setup SQL first.');
    version = Number(rows[0].version);
    if(!rows[0].data) {
      activeRole = ''; render();
      const panel = document.getElementById('v');
      panel.innerHTML = role === 'management' ? '<section class="card"><h2>Set up shared bakery data</h2><p>Choose the first shared copy. Other devices will load this copy after sign-in.</p><button class="p" onclick="ERPCloud.initialize(false)">Use the starter catalog and sample records</button><button class="s" onclick="ERPCloud.initialize(true)">Import this browser’s existing bakery data</button><p>Browser data from other devices is not merged automatically.</p></section>' : '<section class="card">Management needs to set up the shared bakery data first.</section>';
      window.ERPCloud.initialRole = role;
      announce('Signed in. Shared bakery data has not been initialized.');
      return role;
    }
    applyRecord(rows[0]); ready = true; blocked = false; activeRole = role;
    tab = role === 'employee' ? 'Move' : 'Products'; render();
    announce('Connected. All changes saved online.');
    return role;
  }
  async function commit(mutator) {
    if(!ready||blocked||activeRole!=='management')throw Error('Management access and an active connection are required.');
    document.getElementById('v').inert=true;document.getElementById('nav').inert=true;
    document.getElementById('user').disabled=true;clearTimeout(timer);
    try {
      while(saving)await new Promise(resolve=>setTimeout(resolve,30));
      if(pending)await flush();
      while(saving)await new Promise(resolve=>setTimeout(resolve,30));
      if(blocked)throw Error('Earlier changes could not be saved. Reload first.');
      const next=clone(S);mutator(next);delete next.cur;delete next.user;
      saving=true;announce('Saving the complete change online…');
      const row=await api('rpc/erp_save',{p_data:next,p_version:version});
      applyRecord(row);pending=false;render();announce('All changes saved online.');return row;
    } catch(error) {if(saving)lock(error);throw error;}
    finally {saving=false;if(!blocked){document.getElementById('v').inert=false;document.getElementById('nav').inert=false;document.getElementById('user').disabled=false;}}
  }
  async function initialize(fromBrowser) {
    if(busy || window.ERPCloud.initialRole !== 'management') return;
    busy = true;
    try {
      if(!fromBrowser) S = clone(starter);
      if(fromBrowser) {
        const value = localStorage.getItem('bakery5');
        if(!value) throw new Error('No existing bakery data was found in this browser on this website.');
        const candidate = JSON.parse(value);
        if(!candidate || !['items','tx','sales','orders'].every(k=>Array.isArray(candidate[k]))) throw new Error('This browser’s data is incomplete.');
        S = candidate;
        ensureScheduleCatalog(); ensureForecastCatalog(); restoreCustomProductionSchedule(); enforcePlanProductCatalog();
        S.weekdayExtras ||= {}; S.forecastOverrides ||= {};
      }
      const record = await api('rpc/erp_save', {p_data:sharedData(),p_version:version});
      applyRecord(record); ready = true; activeRole = window.ERPCloud.initialRole; render();
      announce('Shared bakery data initialized and saved online.');
    } catch(error) { announce(error.message); }
    finally { busy = false; }
  }
  async function signIn() {
    if(busy) return;
    busy = true; loginMessage = '';
    const username = document.getElementById('loginUsername').value.trim();
    const passwordField = document.getElementById('loginPassword');
    const password = passwordField.value; passwordField.value = '';
    const expectedUsername = String(window.ERP_CONFIG?.managementUsername || '');
    const email = String(window.ERP_CONFIG?.managementEmail || '');
    announce('Signing in…');
    try {
      if(username.toLowerCase() !== expectedUsername.toLowerCase() || !email) throw new Error('Incorrect username or password.');
      rememberSession(await authRequest('token?grant_type=password', {email,password}));
      const role = await openBakery();
      if(role !== 'management') throw new Error('This account does not have management access.');
    } catch(error) {
      rememberSession(null); activeRole = ''; ready = false;
      loginMessage = '<span class="bad">'+esc(error.message)+'</span>'; render();
      announce('Sign-in or database setup needs attention.');
    } finally { busy = false; }
  }
  async function continueAsEmployee() {
    if(busy) return;
    busy = true; loginMessage = '';
    announce('Opening employee access…');
    try {
      rememberSession(await authRequest('signup', {data:{}}));
      const role = await openBakery();
      if(role !== 'employee') throw new Error('Employee access could not be verified.');
    } catch(error) {
      rememberSession(null); activeRole = ''; ready = false;
      loginMessage = '<span class="bad">'+esc(error.message)+'</span>'; render();
      announce('Employee access needs attention.');
    } finally { busy = false; }
  }
  async function signOut() {
    if(saving || pending || blocked) { announce('Save changes or download your unsaved copy before reloading to sign out.', true); return; }
    epoch++; ready = false; activeRole = ''; clearTimeout(timer);
    const oldToken = session?.access_token; rememberSession(null);
    employeeName = ''; S = seed(); cache = null; loginMessage = ''; render();
    announce('Signed out.');
    if(oldToken) try { await fetch(URL+'/auth/v1/logout', {method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+oldToken}}); } catch {}
  }
  window.ERPCloud = {signIn,continueAsEmployee,signOut,commit,save:saveShared,initialize,cacheGet:()=>cache,cacheSet:value=>{cache=value;},initialRole:null};
  window.addEventListener('beforeunload', event => { if(pending || saving || blocked) { event.preventDefault(); event.returnValue = ''; } });
  setInterval(async () => {
    if(!ready || saving || pending || blocked || busy || document.hidden || document.querySelector('dialog[open]') || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    busy = true;
    const requestEpoch = epoch;
    try {
      const rows = await api('erp_state?select=data,version&id=eq.1');
      // Local edits may have started during the request.
      if(requestEpoch === epoch && ready && rows[0]?.data && Number(rows[0].version) > version && !pending && !saving && !blocked) {
        applyRecord(rows[0]); render(); announce('Updated with the latest shared data.');
      }
    } catch(error) { announce('Could not refresh shared data. '+error.message+' New edits will need an online save.'); }
    finally { busy = false; }
  }, 15000);
  async function start() {
    announce('Sign in to access shared bakery data.');
    try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch {}
    if(!session) return;
    busy = true;
    try { await openBakery(); }
    catch(error) { rememberSession(null); activeRole=''; ready=false; loginMessage='<span class="bad">'+esc(error.message)+'</span>'; render(); announce('Please sign in.'); }
    finally { busy=false; }
  }
  void start();
})();

