/* SPDX-License-Identifier: LGPL-3.0-only
 * APEX extension of the TUM browser adaptation (see licenses/tum-NOTICE.txt).
 * Adds quadratic wear, an optional late-stint knee, inventory constraints,
 * scenario pit costs and explicit traffic costs. Not a fitted 2026 tyre model.
 */
export {DRY,strategyContext} from './tum-strategy-engine.js';
import {DRY} from './tum-strategy-engine.js';

// Engineering scenarios, not measured Pirelli coefficients or tyre safety limits.
export const DEFAULT_TYRES={
 SOFT:{offset:0,rate:.055,curve:.0012,knee:22,cliff:.012},
 MEDIUM:{offset:.35,rate:.035,curve:.00065,knee:30,cliff:.01},
 HARD:{offset:.7,rate:.022,curve:.00035,knee:40,cliff:.008}
};
export const SCENARIOS={low:{label:'低耗胎',wear:.35,knee:1.25},normal:{label:'中等耗胎',wear:1,knee:1},high:{label:'高耗胎',wear:1.8,knee:.85}};
export function scenarioTyres(key='normal'){
 const p=SCENARIOS[key];if(!p)throw Error('未知耗胎情景。');
 return Object.fromEntries(DRY.map(c=>{const t=DEFAULT_TYRES[c];return [c,{...t,rate:t.rate*p.wear,curve:t.curve*p.wear,cliff:t.cliff*p.wear,knee:Math.round(t.knee*p.knee)}];}));
}
export function tyreLapCost(compound,age,settings){
 const t=settings.tyres[compound],scale=settings.wearScale??1;
 return t.offset+scale*(t.rate*age+(t.curve??0)*age**2+(t.cliff??0)*Math.max(0,age-(t.knee??1000))**2);
}
export function pitLossAt(settings,after){
 return after===1&&settings.flag&&settings.flag!=='green'?settings.currentPitLoss:settings.pitLoss;
}
export function validateSettings(context,s){
 if(!Number.isInteger(context.remaining)||context.remaining<2||context.remaining>100||!DRY.includes(context.compound)||!Number.isFinite(context.age)||context.age<0||!['AUTO',...DRY].includes(s.target))throw Error('模拟起点无效。');
 for(const v of [s.pitLoss,s.warmup,s.trafficLoss??0,s.currentPitLoss??s.pitLoss,s.wearScale??1,...DRY.flatMap(c=>{const t=s.tyres[c]||{};return [t.offset,t.rate,t.curve??0,t.knee??1000,t.cliff??0];})])if(!Number.isFinite(v)||v<0)throw Error('模型参数必须是非负有限数。');
 if(s.flag&&!['green','vsc','sc'].includes(s.flag))throw Error('未知旗况假设。');
 if(s.flag&&s.flag!=='green'&&!Number.isFinite(s.currentPitLoss))throw Error('需设置本圈进站损失。');
 if(!Number.isInteger(s.delay)||s.delay<0)throw Error('等待圈数必须是非负整数。');
 for(const c of DRY)if(s.inventory&&(!Number.isInteger(s.inventory[c])||s.inventory[c]<0||s.inventory[c]>10))throw Error('可用胎组数无效。');
}
function evaluator(context,settings){
 validateSettings(context,settings);
 const n=context.remaining;
 // Prefix sums make exhaustive search O(n²), including nonlinear degradation.
 const sums=new Map();
 function stint(compound,age,length){
  const key=compound+':'+age;
  if(!sums.has(key)){const p=[0];for(let i=0;i<n;i++)p.push(p.at(-1)+tyreLapCost(compound,age+i,settings));sums.set(key,p);}
  return sums.get(key)[length];
 }
 const baseline=stint(context.compound,context.age,n);
 return (stops=[])=>{
  let from=0,current=context.compound,age=context.age,tireCost=0;
  const segments=[],seen=new Set(context.used),counts={SOFT:0,MEDIUM:0,HARD:0},reasons=[];
  for(const stop of stops){
   if(!Number.isInteger(stop.after)||stop.after<=from||stop.after>=n||!DRY.includes(stop.compound))throw Error('进站必须递增且位于终点之前。');
   segments.push({from,length:stop.after-from,compound:current,age});
   tireCost+=stint(current,age,stop.after-from);seen.add(current);
   counts[stop.compound]++;from=stop.after;current=stop.compound;age=0;
  }
  segments.push({from,length:n-from,compound:current,age});tireCost+=stint(current,age,n-from);seen.add(current);
  if(settings.twoCompounds&&seen.size<2)reasons.push('未满足两配方假设');
  for(const c of DRY)if(settings.inventory&&counts[c]>settings.inventory[c])reasons.push(`${({SOFT:'软胎',MEDIUM:'中性胎',HARD:'硬胎'})[c]}可用新胎不足`);
  const pitCost=stops.reduce((sum,s)=>sum+pitLossAt(settings,s.after),0),coldCost=stops.length*settings.warmup,trafficCost=stops.length*(settings.trafficLoss??0);
  const total=tireCost+pitCost+coldCost+trafficCost;
  return {stops,segments,tireCost,pitCost,coldCost,trafficCost,total,delta:total-baseline,compatible:reasons.length===0,reasons};
 };
}
export function evaluatePlan(context,settings,stops=[]){return evaluator(context,settings)(stops);}
const better=(a,b)=>!a||b.total<a.total-1e-8?b:a;
export function comparePitStrategies(context,settings){
 const plan=evaluator(context,settings),targets=settings.target==='AUTO'?DRY:[settings.target],n=context.remaining;
 const curve=Array.from({length:n-1},(_,i)=>{
  const options=targets.map(compound=>plan([{after:i+1,compound}]));
  const valid=options.filter(p=>p.compatible);
  return (valid.length?valid:options).reduce(better,null);
 });
 const one=curve.filter(p=>p.compatible).reduce(better,null);
 let two=null;
 for(let a=1;a<n-1;a++)for(let b=a+1;b<n;b++)for(const first of targets)for(const end of DRY){
  const p=plan([{after:a,compound:first},{after:b,compound:end}]);
  if(p.compatible)two=better(two,p);
 }
 const baseline=plan(),now=curve[0],delayed=curve[Math.min(n-2,settings.delay)];
 const best=[baseline,one,two].filter(p=>p?.compatible).reduce(better,null);
 return {baseline,now,delayed,one,two,curve,best};
}
export function sensitivity(context,settings,plan){
 const net=[.75,1,1.25].map(scale=>-evaluatePlan(context,{...settings,wearScale:(settings.wearScale??1)*scale},plan.stops).delta);
 return {min:Math.min(...net),max:Math.max(...net)};
}
