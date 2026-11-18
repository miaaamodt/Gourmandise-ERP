const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const server = http.createServer((req,res) => {
  const file = req.url === '/cloud.js' ? 'cloud.js' : 'index.html';
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');
  res.end(fs.readFileSync(path.join(__dirname,file)));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let row={data:null,version:0}, role='management', conflict=false, requests=0;
  await page.route('https://tzrumhqtimdrytqqhclc.supabase.co/**',async route=>{
    const req=route.request(), u=req.url(); let result;
    if(u.includes('/auth/v1/token')) result={access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600};
    else if(u.includes('/auth/v1/logout')) result={};
    else if(u.includes('/erp_members')) result=[{role}];
    else if(u.includes('/erp_state')) result=[row];
    else if(u.includes('/rpc/erp_save')) {
      requests++;
      const body=req.postDataJSON();
      if(conflict || body.p_version!==row.version) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'ERP_CONFLICT: Another device saved changes.'})});
      row={data:JSON.parse(JSON.stringify(body.p_data,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)),version:row.version+1}; result=row;
    } else throw Error('Unexpected request '+u);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.addInitScript(()=>{
    sessionStorage.setItem('bakeryErpRoleV2','management');
    localStorage.setItem('bakery5','{"legacy":"preserve this"}');
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('heading',{name:'Sign in to Bakery ERP'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('bakery5')),'{"legacy":"preserve this"}');
  assert.equal(await page.getByRole('button',{name:'Sign in as Employee'}).count(),0);
  async function signIn(){
    await page.getByLabel('Email',{exact:true}).fill('test@example.com');
    await page.getByLabel('Password',{exact:true}).fill('test-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
  }
  await signIn();
  await page.getByRole('button',{name:'Use the starter catalog and sample records'}).click();
  await page.getByText('Shared bakery data initialized and saved online.',{exact:true}).waitFor();
  assert.equal(row.version,1);assert(row.data.items.length>100);assert.equal(row.data.cur,undefined);
  await page.evaluate(()=>{S.items[0].safety=123;save();});
  await page.getByText('All changes saved online.',{exact:true}).waitFor();
  assert.equal(row.data.items[0].safety,123);
  const previous=requests;
  await page.evaluate(()=>{S.cur=1;S.user='Display name';save();});
  await page.waitForTimeout(350);
  assert.equal(requests,previous,'Per-device product/name changes must not write shared state');
  assert(!(await page.evaluate(()=>sessionStorage.getItem('gourmandise.supabase.session.v1'))).includes('test-password'));
  await page.evaluate(()=>logout());
  await page.getByRole('heading',{name:'Sign in to Bakery ERP'}).waitFor();
  role='employee';await signIn();
  await page.getByText('Connected. All changes saved online.',{exact:true}).waitFor();
  assert.equal(await page.locator('#nav').getByRole('button',{name:'Products',exact:true}).count(),0);
  await page.evaluate(()=>addTx({type:'prod',qty:2,loc:'Main Fridge'}));
  await page.getByText('All changes saved online.',{exact:true}).waitFor();
  assert.equal(row.data.tx.at(-1).qty,2);
  conflict=true;
  await page.evaluate(()=>addTx({type:'prod',qty:3,loc:'Main Fridge'}));
  await page.getByRole('button',{name:'Download unsaved copy'}).waitFor();
  assert(await page.locator('#cloudStatus').innerText().then(t=>t.includes('NOT been saved')));
  assert.equal(await page.locator('#v').evaluate(e=>e.inert),true);
  assert.equal(row.data.tx.at(-1).qty,2,'Conflicted draft must not overwrite shared data');
  assert.deepEqual(errors,[]);
  await browser.close();server.close();
  console.log('Browser tests passed: sign-in, role enforcement in UI, initialization, shared saves, local preferences, legacy data preservation, and conflict recovery.');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
