/* Production adjustment planning. Existing sales and inventory history are retained. */
(() => {
  'use strict';
  const M=window.ERPProductionMath;
  const canonical=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const aliases=new Map();
  for(const rule of window.ERP_PRODUCTION_RULES)for(const name of rule.aliases){const key=canonical(name),old=aliases.get(key);if(old&&old.key!==rule.key)throw Error('Ambiguous production rule: '+name);aliases.set(key,rule);}
  const fmt=value=>value===null||value===undefined?'—':Number(value).toLocaleString(undefined,{maximumFractionDigits:6});
  const originalProductionItem=productionItem;
  productionItem=e=>{if(e.productId!==null&&e.productId!==undefined)return S.items.find(i=>i.id===e.productId)||null;const found=originalProductionItem(e);if(found)return found;const target=PRODUCTION_ITEM_ALIASES[canonical(e.name)],named=target?S.items.find(i=>canonical(i.name)===canonical(target)):null;if(named)return named;const rule=aliases.get(canonical(e.name));if(!rule)return null;const matches=S.items.filter(i=>!i.archived&&aliases.get(canonical(i.name))?.key===rule.key);return matches.length===1?matches[0]:null;};
  let busy=false,batchProduct=null;
  function manager(){if(activeRole!=='management')throw Error('Management access is required.');}
  function itemFor(entry,state=S){
    if(entry.productId!==null&&entry.productId!==undefined)return state.items.find(i=>i.id===entry.productId);
    if(!entry.section)return state.items.find(i=>i.id===entry.id&&i.name===entry.name)||entry;
    return productionItem(entry);
  }
  function ruleFor(entry,state=S){
    if(!entry||entry.temporary&&entry.productId===null)return null;
    const item=itemFor(entry,state),base=aliases.get(canonical(entry.name))||aliases.get(canonical(item?.name));
    if(!base)return null;
    const custom=Number(item?.productionMinimumOutput);
    return {...base,minimumOutput:custom>0&&Number.isFinite(custom)?custom:base.minimumOutput};
  }
  function savedSales(id,state=S){const rows=state.sales.filter(x=>x.item===id&&x.mode==='month'&&x.period===salesMonth);return rows.length?rows.reduce((n,x)=>n+Number(x.units||0),0):'';}
  function inputSales(id){return salesDraft[id]??savedSales(id);}
  const forecastMonth=()=>monthAfter(salesMonth);
  function model(id,value=inputSales(id),state=S){
    const item=state.items[id];if(!item)throw Error('Product not found.');
    const rule=ruleFor(item,state),inventory=state.tx.reduce((n,x)=>x.item===id&&(x.loc||'Main Fridge')==='Main Fridge'?n+Number(x.qty):n,0);
    const requirement=M.requirement(value,M.factor(item),inventory,rule?.unit||'units');
    const override=state.productionPlanOverrides?.[forecastMonth()]?.[id]?.batches;
    return {...requirement,rule,unit:rule?.unit||'units',plan:M.plan(requirement.net,rule,override),override};
  }
  forecast=id=>{const r=model(id,savedSales(id));return {available:r.available,monthly:r.adjusted,w:r.available?r.adjusted/FORECAST_WEEKS:0,net:r.net,planned:r.plan.units,period:salesMonth,g:(r.multiplier-1)*100,src:r.available?`${formatMonth(salesMonth)} sales × ${r.multiplier}; inventory deducted once in production need`:`no sales saved for ${formatMonth(salesMonth)}`};};
  monthlyProductionNeed=id=>model(id,savedSales(id)).net;
  forecastForSales=(id,value)=>{const r=model(id,value);return !r.available||r.plan.needsYield?'':r.plan.units;};
  needs=(id=S.cur)=>{const r=model(id,savedSales(id)),runs=productionRunsPerMonth(id),net=r.net===null?0:r.net;return {f:r.available?r.adjusted/FORECAST_WEEKS:0,base:r.available?r.adjusted/FORECAST_WEEKS:0,g:(r.multiplier-1)*100,src:r.available?`${formatMonth(salesMonth)} × ${r.multiplier} − inventory once`:'No saved sales',oh:r.onHand,sf:0,net:runs>0?(r.unit==='units'?Math.ceil(net/runs):net/runs):net};};
  function allocation(e){
    const item=productionItem(e);if(!item)return null;
    const r=model(item.id,savedSales(item.id)),divisor=M.scheduleDivisor(e.section);
    return {monthly:r.plan.units,units:M.scheduledQuantity(r.plan.units,e.section,r.unit),batches:r.plan.batches===null?null:r.plan.batches/divisor,divisor,unit:r.unit,needsYield:r.plan.needsYield};
  }
  defaultProductionUnits=e=>allocation(e)?.units??null;
  function weeklyRule(e){const rule=ruleFor(e);if(!rule)return null;const divisor=M.scheduleDivisor(e.section);return {...rule,minBatches:rule.minBatches/divisor,minimumOutput:rule.minimumOutput===null?null:rule.minimumOutput/divisor};}
  function weeklyValues(e,current,hasSaved){
    const share=allocation(e),rule=weeklyRule(e),step=rule?M.stepOutput(rule):current.amount?.qty;
    const amount=rule?{qty:step,unit:rule.unit,batchRule:rule}:current.amount;
    const extra={amount,allocation:share,manualQuantity:hasSaved,batchRule:rule,minimumBatches:rule?.minBatches,needsYield:share?.needsYield||false};
    if(!hasSaved&&share){return {...current,...extra,units:share.units,batches:share.batches??(step&&share.units!==null?share.units/step:null)};}
    if(!hasSaved||!rule)return {...current,...extra};
    // Explicit quantities belong to this week and remain unchanged by forecast updates.
    const units=current.units??(current.batches!==null&&step?Math.round(current.batches*step*1e6)/1e6:null);
    const batches=current.batches??(units!==null&&step?units/step:null);
    return {...current,...extra,units,batches,needsYield:step===null};
  }
  function weeklyPair(e,field,value,current){
    const rule=weeklyRule(e);if(!rule)return null;
    const n=M.numeric(value,field==='units'?'Units':'Batches'),step=M.stepOutput(rule);
    if(n===0){const item=itemFor(e),net=item?.id!==undefined?monthlyProductionNeed(item.id):null;if(net===0)return {units:0,batches:0};throw Error('This occurrence has an allocated minimum of '+fmt(rule.minBatches)+' batches.');}
    if(step===null)throw Error('Set this product’s minimum-run output in Sales & Forecast first.');
    const batches=field==='batches'?n:n/step;
    if(batches<rule.minBatches-1e-8)throw Error('This occurrence has an allocated minimum of '+fmt(rule.minBatches)+' batches.');
    const units=field==='units'?n:(rule.unit==='units'?Math.round(batches*step):Math.round(batches*step*1e6)/1e6);
    return {units,batches};
  }
  function batchControls(id,r){
    if(!r.rule)return '<span class="mu">Not listed</span>';
    if(r.plan.needsYield)return `<button class="s compact" onclick="ERPProductionUI.openYield(${id})">Set batch yield</button>`;
    const disabled=!r.available||r.net===0||r.plan.batches===null;
    return `<div class="batchStepper"><button type="button" aria-label="Decrease batches for ${esc(S.items[id].name)}" ${disabled||r.plan.batches<=r.rule.minBatches?'disabled':''} onclick="ERPProductionUI.step(${id},-1)">−</button><input id="forecastbatches_${id}" aria-label="Planned batches for ${esc(S.items[id].name)}" type="number" min="${r.net===0?0:r.rule.minBatches}" step="1" value="${r.plan.batches??''}" ${disabled?'disabled':''} onchange="ERPProductionUI.setBatches(${id},this.value)"><button type="button" aria-label="Increase batches for ${esc(S.items[id].name)}" ${disabled?'disabled':''} onclick="ERPProductionUI.step(${id},1)">+</button></div><div class="mu batchMinimum">Minimum ${r.rule.minBatches}; ${fmt(r.rule.minimumOutput)} ${esc(r.unit)}${r.override!==undefined?` <button class="textButton" onclick="ERPProductionUI.resetBatches(${id})">Use calculated</button>`:''}</div>`;
  }
  function rowMarkup(item){const r=model(item.id),q=inputSales(item.id);return `<tr class="salesProductRow" data-search="${esc(item.name.toLowerCase())}" id="salesrow_${item.id}"><td>${esc(item.name)}<div class="mu">${esc(r.unit)}</div></td><td><input id="salesqty_${item.id}" aria-label="${esc(item.name)} sales quantity" type="number" min="0" step="any" value="${esc(q)}" oninput="draftSales(${item.id},this.value)"></td><td><div class="factorInput"><span aria-hidden="true">×</span><input id="productionfactor_${item.id}" aria-label="Production adjustment for ${esc(item.name)}" type="number" min="0" step="0.1" value="${r.multiplier}" onchange="ERPProductionUI.factor(${item.id},this.value)"></div></td><td id="adjustedqty_${item.id}">${fmt(r.adjusted)}</td><td id="onhandqty_${item.id}">${fmt(r.onHand)}</td><td id="netqty_${item.id}">${fmt(r.net)}</td><td id="batchcontrols_${item.id}">${batchControls(item.id,r)}</td><td id="forecastqty_${item.id}">${r.plan.needsYield?'Set yield':fmt(r.plan.units)}</td>${r.rule?`<td><button class="textButton" onclick="ERPProductionUI.openYield(${item.id})">Batch details</button></td>`:'<td>—</td>'}</tr>`;}
  salesForecastView=()=>{
    const products=S.items.filter(i=>!i.archived).sort((a,b)=>broad(a.cat).localeCompare(broad(b.cat))||a.name.localeCompare(b.name)),total=products.reduce((n,i)=>n+(Number(inputSales(i.id))||0),0);
    return `<div class="card"><h2>Sales history &amp; forecast</h2><div class="row"><div><label for="salesMonth">Last month’s sales</label><input id="salesMonth" type="month" value="${salesMonth}" onchange="salesMonth=this.value;S.salesEntryMonth=salesMonth;S.forecastMonth=monthAfter(salesMonth);salesDraft={};msg.sales='';save();render()"></div><div><label for="salesFile">Upload sales history</label><input id="salesFile" type="file" accept=".xlsx,.csv" onchange="importMonthlySales(this)"><p class="mu">Product names in column A, quantities in column B. Existing sales upload formats are supported.</p></div><div><label>Entered sales total</label><div class="big" id="monthlyTotal">${fmt(total)}</div><span class="mu">Quantities use each product’s measure; this total may mix measures.</span></div></div><p class="productionFormula">Production need = last month’s sales × <b>Production adjustment</b> − on-hand inventory. Default adjustment: <b>1.5</b>. Negative results become zero.</p><p class="mu">Production units are rounded up to the required batch run where a PDF minimum is listed. If inventory covers the adjusted sales target, production is 0. Units/buckets/gallons/trays stay in their listed measure. Safety-stock and catering values are retained but are not added to this formula.</p><label for="salesSearch">Search products</label><input id="salesSearch" type="search" value="${esc(salesSearch)}" placeholder="Search products…" oninput="filterSalesTable(this.value)" onsearch="filterSalesTable(this.value)"><div class="tw"><table class="productionForecastTable"><thead><tr><th>Product and measure</th><th>${esc(formatMonth(salesMonth))} sales</th><th>Production adjustment</th><th>Adjusted sales target</th><th>On hand</th><th>Needed after stock</th><th>Production batches</th><th>Production quantity ${esc(formatMonth(forecastMonth()))}</th><th>Batch setup</th></tr></thead><tbody>${products.map(rowMarkup).join('')}</tbody><tfoot><tr><th>Entered quantities</th><th id="totalUnits">${fmt(total)}</th><th colspan="7">Review quantities by product and measure.</th></tr></tfoot></table></div><button class="p" onclick="saveMonthlySales()">Save ${esc(formatMonth(salesMonth))} sales</button> <button class="s" onclick="downloadForecastXlsx()">Download Excel forecast</button><div class="msg" role="status">${msg.sales||''}</div></div>`;
  };
  draftSales=(id,value)=>{
    salesDraft[id]=value;
    try{const r=model(id,value);for(const [prefix,val] of [['adjustedqty_',r.adjusted],['onhandqty_',r.onHand],['netqty_',r.net],['forecastqty_',r.plan.units]]){const target=document.getElementById(prefix+id);if(target)target.textContent=r.plan.needsYield&&prefix==='forecastqty_'?'Set yield':fmt(val);}const controls=document.getElementById('batchcontrols_'+id);if(controls)controls.innerHTML=batchControls(id,r);const total=S.items.reduce((n,i)=>n+(Number(salesDraft[i.id]??savedSales(i.id))||0),0);for(const key of ['monthlyTotal','totalUnits']){const el=document.getElementById(key);if(el)el.textContent=fmt(total);}}catch(error){msg.sales='<span class="bad">'+esc(error.message)+'</span>';}
  };
  async function perform(mutator,message){manager();if(busy)return false;busy=true;try{const storage=window.ERPPreview||window.ERPCloud;if(!storage?.commit)throw Error('Shared saving is not ready.');await storage.commit(mutator);msg.sales='<span class="ok">'+esc(message)+'</span>';render();return true;}catch(error){msg.sales='<span class="bad">Not saved: '+esc(error.message)+'</span>';const el=document.getElementById('batchSetupError');if(el)el.textContent=error.message;return false;}finally{busy=false;}}
  async function factor(id,value){try{const n=M.numeric(value,'Production adjustment');await perform(state=>{state.items[id].productionAdjustment=n;},'Production adjustment saved.');}catch(error){msg.sales='<span class="bad">'+esc(error.message)+'</span>';render();}}
  async function setBatches(id,value){try{const r=model(id),n=M.validBatches(value,r.rule);if(!r.available||r.net===0)throw Error('No production is needed for this product.');await perform(state=>{const next=model(id,inputSales(id),state);if(next.net===0)throw Error('Inventory now covers the target. Refresh the calculation.');state.productionPlanOverrides||={};state.productionPlanOverrides[forecastMonth()]||={};state.productionPlanOverrides[forecastMonth()][id]={batches:n};},'Production batches saved.');}catch(error){msg.sales='<span class="bad">'+esc(error.message)+'</span>';render();}}
  function step(id,delta){const r=model(id);if(!r.available||r.net===0||r.plan.batches===null)return;const n=r.plan.batches+delta;if(n<r.rule.minBatches)return;void setBatches(id,n);}
  function resetBatches(id){void perform(state=>{if(state.productionPlanOverrides?.[forecastMonth()])delete state.productionPlanOverrides[forecastMonth()][id];},'Calculated batch recommendation restored.');}
  const dialog=document.createElement('dialog');dialog.id='productionBatchDialog';dialog.className='productManagerDialog';document.body.append(dialog);
  function openYield(id){manager();batchProduct=id;const item=S.items[id],r=ruleFor(item);if(!r)return;dialog.innerHTML=`<div class="productDialogHead"><h2>Batch yield · ${esc(item.name)}</h2><button class="s" onclick="document.getElementById('productionBatchDialog').close()">Close</button></div><p>Minimum production run: <b>${r.minBatches} batches</b>. This minimum cannot be lowered here.</p><label for="minimumRunOutput">Output at ${r.minBatches} batches (${esc(r.unit)})</label><input id="minimumRunOutput" type="number" min="0.000001" step="any" value="${r.minimumOutput??''}"><p class="mu">Enter the full output at the listed minimum, not the amount for a single batch. ${r.note?esc(r.note)+'. ':''}Sales and inventory must use the same measure.</p><p class="mu">One additional batch averages ${M.stepOutput(r)===null?'an output that must be set':fmt(M.stepOutput(r))+' '+esc(r.unit)}. Whole-piece totals are rounded only after calculation.</p><button class="p" onclick="ERPProductionUI.saveYield()">Save batch yield</button><p id="batchSetupError" role="status"></p>`;dialog.showModal();}
  async function saveYield(){try{const n=M.numeric(document.getElementById('minimumRunOutput').value,'Minimum-run output');if(!(n>0))throw Error('Enter a value above zero.');if(await perform(state=>{state.items[batchProduct].productionMinimumOutput=n;},'Batch yield saved.'))dialog.close();}catch(error){document.getElementById('batchSetupError').textContent=error.message;}}
  function xlsx(rows){const sheet=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{let n=ci+1,c='';while(n){c=String.fromCharCode(65+(n-1)%26)+c;n=Math.floor((n-1)/26);}const ref=c+(ri+1);return typeof v==='number'?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(v??'')}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;return zipStoredFiles([['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Production forecast" sheetId="1" r:id="rId1"/></sheets></workbook>'],['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',sheet]]);}
  downloadForecastXlsx=()=>{const rows=[['Product',formatMonth(salesMonth)+' sales','Production adjustment', 'Adjusted sales target','On hand','Needed after stock','Production batches','Minimum batches','Production quantity','Measure'],...S.items.filter(i=>!i.archived).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>{const r=model(i.id);return [i.name,r.sales??'',r.multiplier,r.adjusted??'',r.onHand,r.net??'',r.plan.batches??'',r.rule?.minBatches??'',r.plan.needsYield?'Set yield':r.plan.units??'',r.unit];})],url=URL.createObjectURL(xlsx(rows)),link=document.createElement('a');link.href=url;link.download=`bakery-forecast-${forecastMonth()}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  window.ERPProductionUI={model,ruleFor,allocation,weeklyValues,weeklyPair,factor,setBatches,step,resetBatches,openYield,saveYield,fmt};
})();
