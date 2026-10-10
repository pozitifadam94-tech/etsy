const {test}=require('node:test');const assert=require('node:assert/strict');const {newer}=require('./updates');
test('Sürüm karşılaştırması sayısal yapılır',()=>{assert.equal(newer('1.10.0','1.9.0'),true);assert.equal(newer('1.1.0','1.1.0'),false);assert.equal(newer('1.0.0','1.1.0'),false);assert.throws(()=>newer('not-a-version','1.1.0'));});
