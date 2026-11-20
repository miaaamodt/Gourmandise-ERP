const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname;
const server=http.createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(file.includes('..')||!fs.existsSync(path.join(root,file))){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(root,file)));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const errors=[];let reads=0,writes=0;
 async function device(mobile=false){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile,colorScheme:'dark'});
  await ctx.route('https://tzrumhqtimdrytqqhclc.supabase.co/**',async route=>{
   const req=route.request();assert(req.url().includes('/rest/v1/erp_preview_state?'),'Demo must not submit real authentication');
   if(req.method()!=='GET')writes++;reads++;
   const state={items:[{id:0,name:'Demo Bread',cat:'Bread',par:1,routine:{Mon:100}}],tx:[],sales:[],orders:[],salesEntryMonth:'2026-10',customProductionSchedule:[],scheduleMap:{},productionNeeds:{}};
   await route.fulfill({contentType:'application/json',body:JSON.stringify([{id:1,data:state,version:1}])});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);return page;
 }
 const page=await device();await page.getByRole('heading',{name:'Bakery ERP demo login',exact:true}).waitFor();assert.equal(reads,0);assert((await page.locator('.loginCard').innerText()).includes('does not secure'));
 await page.getByLabel('Email',{exact:true}).fill('not-the-demo@example.test');await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('Use the demonstration email and password supplied for this preview.',{exact:true}).waitFor();assert.equal(reads,0);
 async function login(p){await p.getByLabel('Email',{exact:true}).fill('demo@gourmandise.test');await p.getByLabel('Password',{exact:true}).fill('bakery-demo');await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.locator('#previewStatus').filter({hasText:'All changes saved online.'}).waitFor();}
 await login(page);assert.equal(await page.locator('#roleBadge').innerText(),'Demo management');assert(await page.locator('#logoutButton').isVisible());assert.equal(await page.evaluate(()=>sessionStorage.getItem('gourmandise.presentation-login.v1')),'signed-in');assert(!(await page.evaluate(()=>JSON.stringify(sessionStorage))).includes('bakery-demo'));
 await page.locator('#nav').getByRole('button',{name:'Weekly plan',exact:true}).click();assert.equal(await page.getByRole('button',{name:'+ Add item',exact:true}).count(),1);
 await page.reload();await page.locator('#previewStatus').filter({hasText:'All changes saved online.'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Bakery ERP demo login',exact:true}).count(),0);
 await page.locator('#logoutButton').click();await page.getByRole('heading',{name:'Bakery ERP demo login',exact:true}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('gourmandise.presentation-login.v1')),null);
 const phone=await device(true);await phone.getByRole('heading',{name:'Bakery ERP demo login',exact:true}).waitFor();assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await login(phone);assert(await phone.locator('#logoutButton').isVisible());assert.equal(writes,0);assert.deepEqual(errors,[]);
 await browser.close();server.close();console.log('Demo login passed: clearly labelled gate, invalid/correct credentials, no pre-login backend requests, no real auth submissions, tab persistence, logout, desktop/mobile, existing features, and no data writes.');
})().catch(error=>{console.error(error);server.close();process.exit(1);});
