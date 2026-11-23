const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const crypto=require('node:crypto');const testPassword='launch-test-password';const fixture={username:'gourmandiseproduction',salt:'000102030405060708090a0b0c0d0e0f',iterations:1000};fixture.passwordHash=crypto.pbkdf2Sync(testPassword,Buffer.from(fixture.salt,'hex'),fixture.iterations,32,'sha256').toString('hex');
const root=__dirname,clone=x=>JSON.parse(JSON.stringify(x)),report=[];
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),staff=url.pathname==='/staff';let file=staff?'index.html':url.pathname==='/'?'index.html':url.pathname.slice(1);if(file.includes('..')){res.statusCode=403;return res.end();}const target=path.join(root,file);if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(target));});
const csv=rows=>rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n');
function workbook(rows){return execFileSync('python3',['-c',`import sys,json,zipfile,io,html
rows=json.load(sys.stdin);out=io.BytesIO()
def cell(v,r,c):
 ref=chr(65+c)+str(r+1)
 return '<c r="'+ref+'"><v>'+str(v)+'</v></c>' if isinstance(v,(int,float)) else '<c r="'+ref+'" t="inlineStr"><is><t>'+html.escape(str(v))+'</t></is></c>'
sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join('<row r="'+str(r+1)+'">'+''.join(cell(v,r,c) for c,v in enumerate(row))+'</row>' for r,row in enumerate(rows))+'</sheetData></worksheet>'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('xl/worksheets/sheet1.xml',sheet)
sys.stdout.buffer.write(out.getvalue())`],{input:JSON.stringify(rows)});}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const site='http://127.0.0.1:'+server.address().port;
 let row={data:null,version:0},mode='normal',role='management',writes=0;
 const errors=[],unexpected=[];report.push=(...items)=>{console.log(items.join("\n"));return Array.prototype.push.apply(report,items);};
 async function device({staff=false,mobile=false,zone='America/Denver'}={}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,colorScheme:'dark',timezoneId:zone,acceptDownloads:true});
  await context.addInitScript(()=>{window.setInterval=fn=>(window.__poll=fn,0);localStorage.setItem('bakery5','{"backup":"retained"}');});
  await context.route('**/app-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.ERP_CONFIG='+JSON.stringify({accessMode:'shared',management:fixture})+';'}));
  await context.route('https://tzrumhqtimdrytqqhclc.supabase.co/**',async route=>{
   const request=route.request(),url=request.url();
   let result;
   if(url.includes('/auth/v1/token'))result={access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{email:'manager@example.test'}};
   else if(url.includes('/auth/v1/logout'))result={};
   else if(url.includes('/erp_members?'))result=[{role}];
   else if(url.includes('/erp_preview_state?')||url.includes('/erp_state?')){if(mode==='stale_read'){mode='normal';result=[{data:clone(initial),version:0}];}else result=[row];}
   else if(url.includes('/rpc/erp_preview_save')||url.includes('/rpc/erp_save')){
    const body=request.postDataJSON();writes++;
    if(mode==='fail'){mode='normal';return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Test database unavailable'})});}
    if(mode==='conflict'){mode='normal';row.version++;}
    if(body.p_version!==row.version)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'ERP_CONFLICT: Another device saved first.'})});
    row={data:clone(body.p_data),version:row.version+1};result=row;
   }else{unexpected.push(url);return route.abort();}
   await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(site+(staff?'/staff':'/'));return page;
 }
 async function saved(page){await page.locator('#previewStatus,#cloudStatus').filter({hasText:/All changes saved online/}).waitFor();}
 async function plan(page,week='2026-11-23',section='Week 1'){await page.locator('#nav').getByRole('button',{name:'Weekly plan',exact:true}).click();await page.locator('#planWeek').fill(week);await page.locator('#planWeek').press('Tab');await page.locator('.productionTabs').getByRole('button',{name:section,exact:true}).click();}
 async function addTask(page,name,section,day='Wed'){if(section)await page.locator('.productionTabs').getByRole('button',{name:section,exact:true}).click();await page.getByRole('button',{name:'+ Add item',exact:true}).click();await page.locator('#planAddKind').selectOption('task');await page.locator('#planAddTask').fill(name);await page.locator('#planAddDay').selectOption(day);await page.locator('#planAddBatches').fill('3');await page.getByRole('button',{name:'Save item',exact:true}).click();await saved(page);await page.locator('#erpFeatureDialog').waitFor({state:'hidden'});}
 async function openImport(page,rows,{filename='counts.csv',buffer=null}={}){await page.locator('#nav').getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'Import inventory from Excel',exact:true}).click();await page.locator('#inventoryActor').fill('Inventory Tester');await page.locator('#inventoryUpload').setInputFiles({name:filename,mimeType:filename.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv',buffer:buffer||Buffer.from(csv(rows))});await page.locator('#inventoryPreview').filter({hasNotText:'Reading and validating…'}).waitFor();}
 async function confirmImport(page){page.once('dialog',d=>d.accept());await page.locator('#confirmInventoryImport').click();await saved(page);await page.locator('#erpFeatureDialog').waitFor({state:'hidden'});}
 const page=await device();await page.getByRole('button',{name:'Continue as employee'}).waitFor();
 assert.equal(await page.locator('#nav button').count(),0);
 await page.getByLabel('Username',{exact:true}).fill(fixture.username);await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in as management'}).click();await page.getByText('Username or password is incorrect.').waitFor();
 await page.getByLabel('Password',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Sign in as management'}).click();await page.getByRole('button',{name:'Start with the sample catalog and records'}).click();await saved(page);console.log('Management login and incorrect-password rejection passed.');
 const allocationAudit=await page.evaluate(()=>{
  const original=JSON.parse(JSON.stringify(S));try{
   S.tx=[];S.productionNeeds={};S.weeklyPlans={};S.productionPlanOverrides={};
   S.sales=S.items.map(i=>({item:i.id,period:salesMonth,mode:'month',units:1000}));
   const rows=PRODUCTION_SCHEDULE.map(e=>{const item=productionItem(e);if(!item)return {name:e.name,section:e.section,unmatched:true};const r=ERPProductionUI.model(item.id),v=productionValues({...e,key:'r-'+e.id}),divisor=e.section==='Every Week'?4:e.section==='On Demand'?1:2;return {name:e.name,section:e.section,monthly:r.plan.units,actual:v.units,expected:r.plan.units===null?null:r.unit==='units'?Math.ceil(r.plan.units/divisor):Math.round(r.plan.units/divisor*1e6)/1e6};});
   const bacon=S.items.find(i=>i.name==='Bacon Cheddar Scone'),entry=PRODUCTION_SCHEDULE.find(e=>productionItem(e)?.id===bacon.id&&e.section==='Week 1');
   S.sales.find(x=>x.item===bacon.id).units=1120;S.items[bacon.id].productionMinimumOutput=560;
   const example={monthly:ERPProductionUI.model(bacon.id).plan.units,weekly:productionValues({...entry,key:'r-'+entry.id}).units};
   delete S.items[bacon.id].productionMinimumOutput;S.sales.find(x=>x.item===bacon.id).units=1100;
   const pdfExample={monthly:ERPProductionUI.model(bacon.id).plan.units,weekly:productionValues({...entry,key:'r-'+entry.id}).units};
   return {rows,example,pdfExample};
  }finally{S=original;}
 });
 for(const r of allocationAudit.rows.filter(r=>!r.unmatched))assert.equal(r.actual,r.expected,`${r.name}: ${r.section}`);
 assert.deepEqual(allocationAudit.example,{monthly:1680,weekly:840});assert.deepEqual(allocationAudit.pdfExample,{monthly:1650,weekly:825});
 assert(allocationAudit.rows.some(r=>r.section==='On Demand'&&!r.unmatched&&r.monthly>0));
 console.log(`Audited ${allocationAudit.rows.filter(r=>!r.unmatched).length} recurring products/occurrences: monthly final quantity ÷ 2/2/4/1; bacon 1680→840 and PDF yield 1650→825 without extra batch rounding.`);

 const initial=clone(row.data);fs.writeFileSync(path.join(root,'production-mapping-report.json'),JSON.stringify(await page.evaluate(()=>({catalog:S.items.filter(i=>ERPProductionUI.ruleFor(i)).map(i=>({id:i.id,name:i.name,rule:ERPProductionUI.ruleFor(i).key})),schedule:PRODUCTION_SCHEDULE.filter(e=>ERPProductionUI.ruleFor(e)).map(e=>({name:e.name,item:productionItem(e)?.name,rule:ERPProductionUI.ruleFor(e).key}))})),null,2));const ids=await page.evaluate(()=>({plain:S.items.find(i=>i.name==='Cheese Pochette')?.id??S.items.find(i=>!i.archived&&!ERPProductionUI.ruleFor(i)).id,peanut:S.items.find(i=>ERPProductionUI.ruleFor(i)?.key==='peanut-butter-regular').id}));
 await page.evaluate(async ids=>{await ERPPreview.commit(state=>{for(const id of Object.values(ids)){state.tx=state.tx.filter(t=>t.item!==id);state.tx.push({item:id,loc:'Main Fridge',qty:25});state.sales=state.sales.filter(s=>!(s.item===id&&s.period===salesMonth&&s.mode==='month'));state.sales.push({item:id,period:salesMonth,mode:'month',units:100});}});selectTab('Sales & Forecast');},ids);await saved(page);
 assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.units,ids.plain),125);
 await page.evaluate(id=>ERPProductionUI.factor(id,2),ids.plain);await saved(page);assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.units,ids.plain),175);
 const second=await device();await second.getByRole('button',{name:'Continue as employee'}).click();await saved(second);assert.deepEqual(await second.locator('#nav button').allTextContents(),['Move','Cycle count']);assert.equal(await second.evaluate(id=>ERPProductionUI.model(id).multiplier,ids.plain),2);assert(await second.evaluate(()=>{try{ERPFeatures.openAdd();return false}catch{return true}}));await second.evaluate(id=>ERPProductionUI.factor(id,8),ids.plain);assert.equal(row.data.items[ids.plain].productionAdjustment,2);await second.context().close();console.log('Formula, shared multiplier persistence, employee navigation and manager guards passed.');
 await page.evaluate(()=>selectTab('Sales & Forecast'));assert.equal(await page.locator('#forecastqty_'+ids.plain).innerText(),'175');assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.batches,ids.peanut),6);
 await page.evaluate(id=>ERPProductionUI.step(id,1),ids.peanut);await saved(page);assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.units,ids.peanut),1633);const before=writes;await page.evaluate(id=>ERPProductionUI.setBatches(id,5),ids.peanut);assert.equal(writes,before);assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.batches,ids.peanut),7);
 await page.reload();await saved(page);assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.batches,ids.peanut),7);
 await plan(page);const entry=await page.evaluate(id=>{for(const section of PRODUCTION_SECTIONS){productionSection=section;const e=ERPFeatures.entries().find(e=>productionItem(e)?.id===id);if(e){render();return e}}},ids.peanut);assert(entry);assert.equal(await page.evaluate(e=>productionValues(e).units,entry),817);await page.evaluate(key=>ERPFeatures.setQuantity(key,'batches',6),entry.key);await saved(page);await page.evaluate(key=>ERPFeatures.stepBatch(key,1),entry.key);await saved(page);assert.equal(await page.evaluate(e=>productionValues(e).units,entry),1633);const beforeFloor=writes;await page.evaluate(key=>ERPFeatures.setQuantity(key,'batches',2),entry.key);assert.equal(writes,beforeFloor);console.log('Monthly batch choice flows to weekly allocation; allocated floor and one-batch increments passed.');
 await page.evaluate(key=>ERPFeatures.useForecast(key),entry.key);await saved(page);assert.equal(await page.evaluate(e=>productionValues(e).units,entry),817);assert.equal(await page.evaluate(e=>productionValues(e).manualQuantity,entry),false);

 await page.evaluate(async id=>{await ERPPreview.commit(state=>{state.tx.push({item:id,loc:'Main Fridge',qty:10000});});render();},ids.peanut);await saved(page);assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.units,ids.peanut),0);assert.equal(await page.evaluate(id=>ERPProductionUI.model(id).plan.batches,ids.peanut),0);
 await page.evaluate(()=>selectTab('Sales & Forecast'));const downloadEvent=page.waitForEvent('download');await page.evaluate(()=>downloadForecastXlsx());const download=await downloadEvent;const file=path.join(root,'launch-forecast-test.xlsx');await download.saveAs(file);const xml=execFileSync('python3',['-c',"import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read('xl/worksheets/sheet1.xml').decode())",file],{encoding:'utf8'});assert(xml.includes('Production adjustment'));assert(xml.includes('Needed after stock'));assert(xml.includes('<v>175</v>'));
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('Inventory-covered zero overrides batch selection; Excel exports production math; no browser errors.');await browser.close();server.close();
})().catch(error=>{console.error(error);server.close();process.exit(1);});
