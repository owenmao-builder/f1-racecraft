import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPitLedger,cumulativeTimingPoints,STORY_BASE_LAP_SECONDS} from '../dist/pit-ledger.js';
import {evaluatePlan,comparePitStrategies,DEFAULT_TYRES} from '../dist/tum-strategy-engine.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const fixtures=JSON.parse(await readFile(new URL('./tum-parity.json',import.meta.url)));
for(const f of fixtures){
 const c={...f.context,lap:7},p=evaluatePlan(c,f.settings,f.stops),ledger=buildPitLedger(c,f.settings,p);
 close(ledger.final.planCost,p.total);
 close(ledger.final.noStopCost,evaluatePlan(c,f.settings,[]).total);
 for(const base of [0,STORY_BASE_LAP_SECONDS,130]){
  const curves=cumulativeTimingPoints(ledger,base);
  close(curves.noStop.at(-1).seconds-curves.strategy.at(-1).seconds,-f.expectedDelta);
  for(const curve of [curves.noStop,curves.strategy])assert.ok(curve.every((v,i)=>i===0||v.seconds>=curve[i-1].seconds),'Cumulative time cannot fall');
  for(const stop of f.stops){
   const at=curves.strategy.filter(v=>v.progress===stop.after);
   assert.equal(at.length,2);close(at[1].seconds-at[0].seconds,f.settings.pitLoss);
  }
 }
 close(ledger.final.balance,-f.expectedDelta); // Independent upstream Python totals.
 close(ledger.final.pitCost,p.pitCost);close(ledger.final.warmupCost,p.coldCost);
 assert.equal(ledger.rows.length,c.remaining+1);
 assert.equal(ledger.final.lap,c.lap+c.remaining-1);
 for(const stop of f.stops){
  close(ledger.rows[stop.after].pitCost-ledger.rows[stop.after-1].pitCost,f.settings.pitLoss);
  close(ledger.rows[stop.after+1].warmupCost-ledger.rows[stop.after].warmupCost,f.settings.warmup);
 }
 if(ledger.recovery){
  assert.ok(ledger.recovery.progress>f.stops.at(-1).after);
  assert.ok(ledger.rows.slice(ledger.recovery.progress).every(r=>r.balance>=-1e-8));
 }
}
const context={remaining:41,compound:'HARD',age:14,used:['MEDIUM','HARD'],lap:32};
const settings={tyres:DEFAULT_TYRES,pitLoss:21.5,warmup:1,target:'MEDIUM',delay:5,twoCompounds:true};
const choices=comparePitStrategies(context,settings),best=buildPitLedger(context,settings,choices.one);
close(best.final.balance,1.03);assert.equal(choices.one.stops[0].after,15);
assert.equal(best.recovery.lap,71);
assert.equal(buildPitLedger(context,settings,choices.now).recovery,null);
assert.equal(buildPitLedger(context,settings,choices.baseline).recovery,null);
const expensive={...settings,pitLoss:35},loss=buildPitLedger(context,expensive,comparePitStrategies(context,expensive).one);
assert.ok(loss.final.balance<0);assert.equal(loss.recovery,null);
// A temporary crossing must not be called lasting recovery if the new tyre
// later degrades fast enough to lose the entire advantage.
const short={remaining:6,compound:'HARD',age:10,used:['HARD'],lap:1};
const fade={...settings,pitLoss:1,warmup:0,tyres:{...DEFAULT_TYRES,HARD:{offset:2,rate:0},SOFT:{offset:0,rate:2}}};
const fading=buildPitLedger(short,fade,evaluatePlan(short,fade,[{after:1,compound:'SOFT'}]));
assert.ok(fading.rows.some(r=>r.balance>0));assert.ok(fading.final.balance<0);assert.equal(fading.recovery,null);
console.log(`PASS: ${fixtures.length} independent upstream totals; expense timing; lasting recovery; no-stop and unprofitable plans. Netherlands example: L46 pit, L71 recovery, +1.03 s net.`);

assert.throws(()=>cumulativeTimingPoints(best,-1));
const noStopLedger=buildPitLedger(context,settings,choices.baseline);
const noStopCurves=cumulativeTimingPoints(noStopLedger,STORY_BASE_LAP_SECONDS);
assert.deepEqual(noStopCurves.noStop,noStopCurves.strategy,'No-stop selection gives coincident rising lines');
assert.ok(cumulativeTimingPoints(best,90).strategy.at(-1).seconds<cumulativeTimingPoints(best,90).noStop.at(-1).seconds,'Profitable strategy ends lower');
assert.ok(cumulativeTimingPoints(loss,90).strategy.at(-1).seconds>cumulativeTimingPoints(loss,90).noStop.at(-1).seconds,'Unprofitable strategy ends higher');
console.log('PASS: cumulative totals agree with independent fixtures; shared time does not change savings; pit jumps occur at the same lap; zero-stop and losing-plan endpoints are honest.');
