import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(file,require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,Date,Intl});return exports}
const dates=compile('mobile/src/lib/dates.ts',()=>({}));
const {upcomingWeek}=compile('mobile/src/ui/upcoming-week.tsx',name=>name==='../lib/dates'?dates:{});
const event=(id,from,to=from,yearly=0)=>({id,start_date:from,end_date:to,recurring_yearly:yearly});
const items=upcomingWeek([event('leave','2026-12-20','2027-01-04'),event('salary','2027-01-01'),event('annual','2020-01-02','2020-01-02',1),event('outside','2027-01-04'),event('old','2026-12-27')],'2026-12-28');
assert.deepEqual(Array.from(items,v=>v.event.id),['leave','salary','annual']);assert.equal(items[0].date,'2026-12-28');assert.equal(items[2].date,'2027-01-02');
assert.equal(upcomingWeek([event('overnight','2020-12-30','2021-01-02',1)],'2027-01-01')[0].date,'2027-01-01');
console.log('PASS: seven-day hub window, active leave, annual events, year boundary and deduplication.');
