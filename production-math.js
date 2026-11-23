/* Shared arithmetic for the Sales & Forecast table, exports, and production runs. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ERPProductionMath=api;})(globalThis,()=>{
  'use strict';
  const numeric=(value,label,allowNegative=false)=>{const n=Number(value);if(value===''||value===null||value===undefined||!Number.isFinite(n)||(!allowNegative&&n<0))throw Error(label+' must be a valid '+(allowNegative?'number.':'non-negative number.'));return n;};
  function factor(item){const value=item?.productionAdjustment;return value===undefined||value===null||value===''?1.5:numeric(value,'Production adjustment');}
  function requirement(sales,multiplier,inventory,unit='units'){
    if(sales===''||sales===null||sales===undefined)return {available:false,sales:null,multiplier,adjusted:null,onHand:inventory,net:null};
    sales=numeric(sales,'Sales');multiplier=numeric(multiplier,'Production adjustment');inventory=numeric(inventory,'On-hand inventory',true);
    const adjusted=sales*multiplier;
    if(!Number.isFinite(adjusted))throw Error('The production target is too large.');
    return {available:true,sales,multiplier,adjusted,onHand:inventory,net:Math.max(0,unit==='units'?Math.ceil(adjusted-inventory):Math.round((adjusted-inventory)*1e6)/1e6)};
  }
  function scheduleDivisor(section){return section==='Week 1'||section==='Week 2'?2:section==='Every Week'?4:1;}
  function scheduledQuantity(monthly,section,unit='units'){
    if(monthly===null||monthly===undefined)return null;
    const share=numeric(monthly,'Monthly production')/scheduleDivisor(section);
    return unit==='units'?Math.ceil(share):Math.round(share*1e6)/1e6;
  }
  function stepOutput(rule){if(!rule||!(Number(rule.minimumOutput)>0)||!(Number(rule.minBatches)>0))return null;const raw=Number(rule.minimumOutput)/Number(rule.minBatches);return raw;}
  function validBatches(value,rule){const n=numeric(value,'Batches'),min=Number(rule.minBatches);if(n<min-1e-8)throw Error('This product requires at least '+min+' batches per production run.');if(Math.abs((n-min)-Math.round(n-min))>1e-8)throw Error('Change batches in steps of one, starting at '+min+'.');return n;}
  function outputForBatches(value,rule){const batches=validBatches(value,rule),step=stepOutput(rule);if(step===null)throw Error('Set the output at the minimum batch run before planning this product.');const units=Number(rule.minimumOutput)+(batches-Number(rule.minBatches))*step;return rule.unit==='units'?Math.round(units):Math.round(units*1e6)/1e6;}
  function batchesForNeed(need,rule){need=numeric(need,'Production requirement');if(need===0)return 0;const step=stepOutput(rule);if(step===null)return null;return Number(rule.minBatches)+Math.max(0,Math.ceil((need-Number(rule.minimumOutput))/step-1e-9));}
  function plan(need,rule,override){
    if(need===null)return {units:null,batches:null,minimum:rule?.minBatches??null,needsYield:false};
    need=numeric(need,'Production requirement');
    if(need===0)return {units:0,batches:0,minimum:rule?.minBatches??null,needsYield:false};
    if(!rule)return {units:need,batches:null,minimum:null,needsYield:false};
    if(stepOutput(rule)===null)return {units:null,batches:null,minimum:rule.minBatches,needsYield:true};
    const batches=override===undefined||override===null?batchesForNeed(need,rule):validBatches(override,rule);
    return {units:outputForBatches(batches,rule),batches,minimum:rule.minBatches,needsYield:false};
  }
  return {numeric,factor,requirement,scheduleDivisor,scheduledQuantity,stepOutput,validBatches,outputForBatches,batchesForNeed,plan};
});
