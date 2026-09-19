import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluatePlan,comparePitStrategies,strategyContext,DEFAULT_TYRES} from '../dist/tum-strategy-engine.js';
import {analyse} from '../dist/analysis-engine.js';
import {races} from '../dist/races.js';
const fixture=JSON.parse(await readFile(new URL('./tum-parity.json',import.meta.url)));
for(const c of fixture)assert.ok(Math.abs(evaluatePlan(c.context,c.settings,c.stops).delta-c.expectedDelta)<1e-8,'Must match unmodified upstream Python');
let supported=0,unsupported=0;
for(const race of races){
 const data=JSON.parse(await readFile(new URL(`../dist/data/${race.id}.json`,import.meta.url)));
 for(const d of data.drivers.slice(0,4))for(const lap of [2,Math.round(race.laps/2),race.laps]){
  let evidence;try{evidence=analyse(data,{driver:d.name_acronym,opponent:data.drivers.find(x=>x!==d).name_acronym,lap,corner:3,question:'attack'});}catch{continue;}
  const context=strategyContext(data,evidence,race);
  if(context.error){unsupported++;continue;}
  const settings={tyres:DEFAULT_TYRES,pitLoss:21.5,warmup:1,target:'MEDIUM',delay:5,twoCompounds:true};
  const r=comparePitStrategies(context,settings);supported++;
  assert.equal(r.curve.length,context.remaining-1);
  assert.equal(r.baseline.delta,0);
  assert.ok(!r.one||r.curve.filter(p=>p.compatible).every(p=>p.total>=r.one.total-1e-8));
  assert.ok(!r.two||r.two.stops.every((p,i)=>p.after>0&&p.after<context.remaining&&(i===0||p.after>r.two.stops[i-1].after)));
  const past={...data,stints:data.stints.filter(s=>s[0]!==d.driver_number||s[1]<=lap)};
  assert.deepEqual(strategyContext(past,evidence,race),context,'Future tyre choices must not affect snapshot');
 }
}
const c={remaining:2,compound:'HARD',age:12,used:['HARD']};
const s={tyres:DEFAULT_TYRES,pitLoss:21.5,warmup:1,target:'HARD',delay:9,twoCompounds:true};
assert.equal(comparePitStrategies(c,s).one,null);
assert.equal(comparePitStrategies(c,s).two,null);
assert.throws(()=>comparePitStrategies(c,{...s,pitLoss:NaN}));
console.log(`PASS: ${fixture.length} upstream parity cases; ${supported} historical contexts; ${unsupported} unsupported contexts; future-data and end-of-race boundaries.`);
