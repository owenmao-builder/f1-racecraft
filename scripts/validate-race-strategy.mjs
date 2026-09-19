import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DRY,scenarioTyres,tyreLapCost,evaluatePlan,comparePitStrategies,strategyContext,sensitivity} from '../dist/race-strategy-engine.js';
import {buildPitLedger} from '../dist/pit-ledger.js';
import {analyse} from '../dist/analysis-engine.js';
import {races} from '../dist/races.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const context={remaining:41,compound:'HARD',age:14,used:['MEDIUM','HARD'],lap:32};
const settings={tyres:scenarioTyres(),target:'AUTO',pitLoss:21.5,currentPitLoss:13,flag:'green',warmup:1,trafficLoss:0,delay:5,twoCompounds:true,inventory:{SOFT:2,MEDIUM:2,HARD:2}};

// Independent reference: advance one lap at a time, switching tyres after
// completing the pit lap. Does not use the production stint or cost helpers.
function reference(c,s,stops){
 let compound=c.compound,age=c.age,total=0,base=0,cold=false;
 const cost=(name,a)=>{const p=s.tyres[name];return p.offset+(s.wearScale??1)*(p.rate*a+p.curve*a*a+p.cliff*Math.max(0,a-p.knee)**2);};
 for(let i=1;i<=c.remaining;i++){
  total+=cost(compound,age);base+=cost(c.compound,c.age+i-1);age++;
  if(cold){total+=s.warmup+s.trafficLoss;cold=false;}
  const stop=stops.find(x=>x.after===i);
  if(stop){total+=i===1&&s.flag!=='green'?s.currentPitLoss:s.pitLoss;compound=stop.compound;age=0;cold=true;}
 }
 return {total,delta:total-base};
}
let seed=927;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(let i=0;i<120;i++){
 const c={...context,remaining:3+Math.floor(rand()*28),age:Math.floor(rand()*30),compound:DRY[i%3]};
 const s={...settings,flag:['green','vsc','sc'][i%3],tyres:scenarioTyres(['low','normal','high'][i%3]),trafficLoss:rand()*5,warmup:rand()*2,pitLoss:15+rand()*15};
 const a=1+Math.floor(rand()*(c.remaining-2)),b=a+1+Math.floor(rand()*(c.remaining-a-1));
 const stops=[[],[{after:a,compound:DRY[(i+1)%3]}],[{after:a,compound:'MEDIUM'},{after:b,compound:'HARD'}]][i%3];
 const p=evaluatePlan(c,s,stops),r=reference(c,s,stops),l=buildPitLedger(c,s,p);
 close(p.total,r.total);close(p.delta,r.delta);close(l.final.balance,-r.delta);
 close(l.final.trafficCost,p.trafficCost);
 if(l.recovery)assert.ok(l.rows.slice(l.recovery.progress).every(row=>row.balance>=-1e-8));
}
// Known arithmetic, including the quadratic and post-knee terms.
const sample={...settings,tyres:{...settings.tyres,SOFT:{offset:.3,rate:.1,curve:.01,knee:5,cliff:.02}}};
close(tyreLapCost('SOFT',10,sample),2.8);
const current=comparePitStrategies(context,settings);
close(current.one.delta,-20.27605);assert.deepEqual(current.one.stops,[{after:19,compound:'SOFT'}]);
assert.equal(buildPitLedger(context,settings,current.one).recovery.lap,63);
assert.ok(current.now.delta<0,'Immediate replacement can pay off too');
assert.equal(comparePitStrategies({...context,remaining:5},settings).best.stops.length,0,'Near the finish no extra stop is fastest');
assert.equal(comparePitStrategies({...context,remaining:60,compound:'MEDIUM',age:12},{...settings,tyres:scenarioTyres('high')}).best.stops.length,2,'Two stops can beat one in high wear');
const zero={...settings,inventory:{SOFT:0,MEDIUM:0,HARD:0}};
assert.equal(comparePitStrategies(context,zero).one,null);
assert.equal(comparePitStrategies(context,zero).two,null);
assert.equal(comparePitStrategies({...context,used:['HARD']},zero).best,null,'An unmet compound requirement is not recommended');
const flag={...settings,flag:'vsc',trafficLoss:3};
const immediate=evaluatePlan(context,flag,[{after:1,compound:'MEDIUM'},{after:20,compound:'HARD'}]);
close(immediate.pitCost,13+21.5);close(immediate.trafficCost,6);
const traffic=evaluatePlan(context,{...settings,trafficLoss:3},current.two.stops);
close(traffic.delta-current.two.delta,6);
const sensitive=sensitivity(context,settings,current.one);assert.ok(sensitive.min< -current.one.delta&&sensitive.max> -current.one.delta);
const linear={...settings,tyres:Object.fromEntries(DRY.map(c=>[c,{offset:0,rate:0,curve:0,knee:0,cliff:0}]))};
assert.equal(comparePitStrategies(context,linear).best.stops.length,0,'The model has no automatic pit reward');
assert.throws(()=>comparePitStrategies(context,{...settings,trafficLoss:NaN}));
assert.throws(()=>evaluatePlan(context,settings,[{after:41,compound:'SOFT'}]));

// Verify exhaustive search against an independently enumerated small horizon.
const small={...context,remaining:8,used:['HARD']};
const options=[{stops:[],result:reference(small,settings,[])}];
for(let a=1;a<small.remaining;a++)for(const first of DRY){
 const stops=[{after:a,compound:first}];
 if(first!=='HARD')options.push({stops,result:reference(small,settings,stops)});
 for(let b=a+1;b<small.remaining;b++)for(const end of DRY)if(first!=='HARD'||end!=='HARD'){
  const ss=[...stops,{after:b,compound:end}];options.push({stops:ss,result:reference(small,settings,ss)});
 }
}
const best=options.filter(p=>p.stops.length).sort((a,b)=>a.result.total-b.result.total)[0];
close(comparePitStrategies(small,settings).best.total,best.result.total);
let historical=0;
for(const race of races){
 const data=JSON.parse(await readFile(new URL(`../dist/data/${race.id}.json`,import.meta.url)));
 for(const driver of data.drivers.slice(0,2)){
  const lap=Math.floor(race.laps/2),opponent=data.drivers.find(d=>d!==driver);
  let evidence;try{evidence=analyse(data,{driver:driver.name_acronym,opponent:opponent.name_acronym,lap,corner:3,question:'attack'});}catch(error){if(error.message.includes('没有可用起圈记录'))continue;throw error;}
  const c=strategyContext(data,evidence,race);if(c.error)continue;
  const r=comparePitStrategies(c,settings);for(const plan of [r.baseline,r.one,r.two].filter(Boolean))close(buildPitLedger(c,settings,plan).final.balance,-plan.delta);
  historical++;
 }
}
console.log(`PASS: 120 independent lap-by-lap comparisons; ${historical} historical snapshots; search optimum; one/two/no-stop outcomes; inventory; flags; traffic; sensitivity; invalid inputs.`);
