const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const M=require('./production-math.js'),scope={window:{}};vm.runInNewContext(fs.readFileSync('production-rules.js','utf8'),scope);const rules=scope.window.ERP_PRODUCTION_RULES;
assert.equal(M.requirement(100,1.5,25).net,125);
assert.equal(M.requirement(100,2,25).net,175);
assert.equal(M.factor({growth:90}),1.5);
assert.equal(M.requirement(100,1.5,200).net,0);
assert.equal(M.requirement('',1.5,20).available,false);
assert.equal(M.requirement(1,1.5,.25,'gallons').net,1.25);
for(const rule of rules){assert.throws(()=>M.validBatches(rule.minBatches-1,rule));assert.equal(M.validBatches(rule.minBatches+1,rule),rule.minBatches+1);assert.equal(M.plan(0,rule,100).units,0);if(rule.minimumOutput){assert.equal(M.plan(1,rule).batches,rule.minBatches);assert.equal(M.outputForBatches(rule.minBatches,rule),rule.minimumOutput);}else assert(M.plan(1,rule).needsYield);}
const peanut=rules.find(r=>r.key==='peanut-butter-regular');assert.equal(M.outputForBatches(7,peanut),1633);assert.equal(M.outputForBatches(12,peanut),2800);assert.equal(M.plan(1401,peanut).batches,7);assert.throws(()=>M.validBatches(6.5,peanut));
assert.equal(rules.find(r=>r.key==='pecan-regular').minimumOutput,1300);assert.equal(rules.find(r=>r.key==='thumbprint').minimumOutput,550);for(const key of ['brownies','almond-cake'])assert.equal(rules.find(r=>r.key===key).minimumOutput,18*35);
for(const value of ['',-1,'bad',Infinity])assert.throws(()=>M.numeric(value,'Value'));
console.log('Production arithmetic: formula, stock-covered zero, every PDF minimum, exact batch ratios, sheets, native measures, validation passed.');
