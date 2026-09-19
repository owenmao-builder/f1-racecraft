/* SPDX-License-Identifier: LGPL-3.0-only
 * Linear, green-flag, no-refuelling subset adapted from TUMFTM/race-simulation
 * calc_racetimes_basic.py and calc_tire_degradation.py, Alexander Heilmeier.
 * Upstream revision 96ef2c2021982217be008fe458df47c1a72da071.
 * Changes: JavaScript; analytic stint sums; omit identical base/fuel/start costs;
 * expose relative strategy costs for an in-race snapshot. The upstream initial
 * cold-tyre term is common to every candidate and removed from all of them.
 * Source and licence: ./licenses/tum-NOTICE.txt and ./licenses/tum-LICENSE.txt
 */
export const DRY=['SOFT','MEDIUM','HARD'];
// Illustrative defaults adapted from upstream A5/A4/A3, NOT fitted to this race.
export const DEFAULT_TYRES={SOFT:{offset:0,rate:.09},MEDIUM:{offset:.5,rate:.05},HARD:{offset:1.2,rate:.02}};
export function stintCost(compound,age,laps,tyres){
 const p=tyres[compound];
 return laps*p.offset+p.rate*(laps*age+laps*(laps-1)/2);
}
export function evaluatePlan(context,settings,stops=[]){
 const {remaining,compound,age,used}=context,{tyres,pitLoss,warmup}=settings;
 let from=0,current=compound,tireAge=age,tireCost=0;
 const segments=[],seen=new Set(used);
 for(const stop of [...stops,{after:remaining,compound:null}]){
  if(!Number.isInteger(stop.after)||stop.after<=from||stop.after>remaining||(!stop.compound&&stop.after!==remaining))throw Error('进站圈次必须递增并位于终点之前。');
  const length=stop.after-from;
  tireCost+=stintCost(current,tireAge,length,tyres);
  segments.push({from,length,compound:current,age:tireAge});
  seen.add(current);from=stop.after;current=stop.compound;tireAge=0;
 }
 const pitCost=stops.length*pitLoss,coldCost=stops.length*warmup;
 const baseline=stintCost(compound,age,remaining,tyres);
 return {stops,segments,tireCost,pitCost,coldCost,total:tireCost+pitCost+coldCost,delta:tireCost+pitCost+coldCost-baseline,compatible:!settings.twoCompounds||seen.size>=2};
}
export function strategyContext(data,evidence,race){
 const c=evidence.first,remaining=race.laps-evidence.request.lap+1;
 if(!c.current||!c.stint||!Number.isFinite(c.age))return {error:'需要所选车手在这一圈的轮胎配方与胎龄，才能开始进站模拟。'};
 if(!DRY.includes(c.stint[3]))return {error:'当前为雨胎或未知配方；这版干地模型不适用，换到有干胎记录的圈次再试。'};
 if(remaining<2)return {error:'已经进入计划最后一圈，没有可比较的后续换胎窗口。'};
 const past=data.stints.filter(s=>s[0]===c.driver.driver_number&&s[1]<=c.current[1]);
 return {remaining,compound:c.stint[3],age:c.age,lap:evidence.request.lap,driver:c.driver.name_acronym,
  used:[...new Set(past.map(s=>s[3]).filter(c=>DRY.includes(c)))],pastWet:past.some(s=>['INTERMEDIATE','WET'].includes(s[3]))};
}
export function comparePitStrategies(context,settings){
 if(!Number.isInteger(context.remaining)||context.remaining<2||context.remaining>100||!DRY.includes(context.compound)||!Number.isFinite(context.age)||context.age<0||!DRY.includes(settings.target))throw Error('模拟起点无效。');
 for(const value of [settings.pitLoss,settings.warmup,...DRY.flatMap(c=>[settings.tyres[c]?.offset,settings.tyres[c]?.rate])])if(!Number.isFinite(value)||value<0)throw Error('模型参数必须是非负数。');
 const plan=(stops=[])=>evaluatePlan(context,settings,stops);
 const curve=Array.from({length:context.remaining-1},(_,i)=>plan([{after:i+1,compound:settings.target}]));
 const delay=Math.max(0,Math.min(context.remaining-2,Math.round(settings.delay)));
 const one=curve.filter(p=>p.compatible).reduce((best,p)=>!best||p.total<best.total-1e-8?p:best,null);
 let two=null;
 for(let a=1;a<context.remaining-1;a++)for(let b=a+1;b<context.remaining;b++)for(const end of DRY){
  const p=plan([{after:a,compound:settings.target},{after:b,compound:end}]);
  if(p.compatible&&(!two||p.total<two.total-1e-8))two=p;
 }
 return {baseline:plan(),now:curve[0],delayed:curve[delay],one,two,curve};
}
