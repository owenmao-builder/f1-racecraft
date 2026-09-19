import {tyreLapCost,pitLossAt} from './race-strategy-engine.js?v=8.3';
// A per-lap explanation using exactly the same costs as the plan evaluator.
// Positive balance means time saved against staying on the current tyres.
export function buildPitLedger(context, settings, plan) {
 let tyreSavings = 0, pitCost = 0, warmupCost = 0, trafficCost = 0;
 const rows = [{progress:0, lap:context.lap, balance:0, tyreSavings:0, pitCost:0, warmupCost:0, trafficCost:0, lapGain:0, stop:null}];
 for (const segment of plan.segments) {
  for (let j = 0; j < segment.length; j++) {
   const i = segment.from + j, progress = i + 1;
   const lapGain = tyreLapCost(context.compound,context.age+i,settings)-tyreLapCost(segment.compound,segment.age+j,settings);
   const stop = plan.stops.find(s => s.after === progress) || null;
   const cold = segment.from > 0 && j === 0 ? settings.warmup : 0;
   const traffic = segment.from > 0 && j === 0 ? (settings.trafficLoss??0) : 0;
   tyreSavings += lapGain;
   warmupCost += cold;
   trafficCost += traffic;
   if (stop) pitCost += pitLossAt(settings,progress);
   rows.push({progress, lap:context.lap+i, balance:tyreSavings-pitCost-warmupCost-trafficCost,
    tyreSavings, pitCost, warmupCost, trafficCost, lapGain, cold, traffic, stop, compound:segment.compound});
  }
 }
 // Only count a lasting recovery after the final pit expense, never the initial
 // zero or a crossing that is lost again through later stops or degradation.
 let recovery = null;
 const lastStop = plan.stops.at(-1)?.after;
 if (lastStop !== undefined && rows.at(-1).balance >= -1e-8) {
  for (let i = rows.length - 1; i > lastStop; i--) {
   if (rows[i].balance < -1e-8) break;
   recovery = rows[i];
  }
 }
 return {rows, recovery, final:rows.at(-1)};
}
