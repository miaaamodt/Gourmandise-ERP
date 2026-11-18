const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const server=http.createServer((req,res)=>{const file=req.url==='/preview.js'?'preview.js':'index.html';res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(__dirname,file)));});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  let row={data:null,version:0};const errors=[],requests=[];
  const site='http://127.0.0.1:'+server.address().port;
  async function device(){
    const context=await browser.newContext(),page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await context.addInitScript(()=>{window.setInterval=callback=>(window.__poll=callback,0);localStorage.setItem('bakery5','{"prior":"preserved"}');});
    await context.route('https://tzrumhqtimdrytqqhclc.supabase.co/**',async route=>{
      const req=route.request();requests.push(req.url());
      if(req.url().includes('/erp_preview_state?'))return route.fulfill({contentType:'application/json',body:JSON.stringify([row])});
      if(req.url().includes('/rpc/erp_preview_save')){
        const body=req.postDataJSON();
        if(body.p_version!==row.version)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'ERP_CONFLICT: Another person saved first.'})});
        row={data:body.p_data,version:row.version+1};return route.fulfill({contentType:'application/json',body:JSON.stringify(row)});
      }
      throw Error('Unexpected request: '+req.url());
    });
    await page.goto(site);return page;
  }
  const first=await device();
  await first.getByRole('button',{name:'Start with the sample catalog and records'}).click();
  await first.getByText('Shared testing · All changes saved online. No sign-in required.',{exact:true}).waitFor();
  assert.equal(await first.locator('#loginEmail').count(),0);
  assert.equal(await first.locator('#logoutButton').isVisible(),false);
  assert.equal(await first.evaluate(()=>localStorage.getItem('bakery5')),'{"prior":"preserved"}');
  const second=await device();
  await second.getByText('Shared testing · All changes saved online. No sign-in required.',{exact:true}).waitFor();
  await first.getByRole('button',{name:'Move',exact:true}).click();
  await first.getByLabel('Employee name',{exact:true}).fill('Test baker');
  await first.getByLabel('Quantity (units)',{exact:true}).fill('5');
  await first.getByRole('button',{name:'Record movement',exact:true}).click();
  await first.getByText('Shared testing · All changes saved online. No sign-in required.',{exact:true}).waitFor();
  assert.equal(row.data.tx.at(-1).qty,5);
  await second.evaluate(()=>window.__poll());
  assert.equal(await second.evaluate(()=>S.tx.at(-1).qty),5);
  await second.evaluate(()=>{S.items[0].safety=123;save();});
  await second.getByText('Shared testing · All changes saved online. No sign-in required.',{exact:true}).waitFor();
  await first.evaluate(()=>{S.items[0].safety=456;save();});
  await first.getByRole('button',{name:'Download unsaved copy'}).waitFor();
  assert.equal(await first.locator('#v').evaluate(el=>el.inert),true);
  assert.equal(row.data.items[0].safety,123);
  assert(requests.every(url=>url.includes('/rest/v1/erp_preview_state?')||url.includes('/rest/v1/rpc/erp_preview_save')));
  assert.deepEqual(errors,[]);
  await browser.close();server.close();
  console.log('Shared preview browser tests passed: no login, two-device saving and refresh, preserved local data, and conflict recovery.');
})().catch(error=>{console.error(error);server.close();process.exit(1);});
