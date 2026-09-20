import {tyreLapCost,pitLossAt} from './race-strategy-engine.js?v=8.3';
// A per-lap explanation using exactly the same costs as the plan evaluator.
// Positive balance means time saved against staying on the current tyres.
export function buildPitLedger(context, settings, plan) {
 let tyreSavings = 0, pitCost = 0, warmupCost = 0, trafficCost = 0, noStopCost = 0, planCost = 0;
 const rows = [{progress:0, lap:context.lap, balance:0, tyreSavings:0, pitCost:0, warmupCost:0, trafficCost:0, lapGain:0, noStopCost:0, planCost:0, noStopLapCost:0, planLapCost:0, stopLoss:0, cold:0, traffic:0, stop:null}];
 for (const segment of plan.segments) {
  for (let j = 0; j < segment.length; j++) {
   const i = segment.from + j, progress = i + 1;
   const noStopLapCost = tyreLapCost(context.compound,context.age+i,settings);
   const planLapCost = tyreLapCost(segment.compound,segment.age+j,settings);
   const lapGain = noStopLapCost-planLapCost;
   const stop = plan.stops.find(s => s.after === progress) || null;
   const cold = segment.from > 0 && j === 0 ? settings.warmup : 0;
   const traffic = segment.from > 0 && j === 0 ? (settings.trafficLoss??0) : 0;
   tyreSavings += lapGain;
   warmupCost += cold;
   trafficCost += traffic;
   const stopLoss = stop ? pitLossAt(settings,progress) : 0;
   pitCost += stopLoss;
   noStopCost += noStopLapCost;
   planCost += planLapCost+cold+traffic+stopLoss;
   rows.push({progress, lap:context.lap+i, balance:tyreSavings-pitCost-warmupCost-trafficCost,
    tyreSavings, pitCost, warmupCost, trafficCost, lapGain, cold, traffic, stop, compound:segment.compound,
    noStopCost, planCost, noStopLapCost, planLapCost, stopLoss});
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

// A shared, explicit teaching scale restores the common lap-time component.
// It affects the vertical scale only, never strategy rankings or time savings.
export const STORY_BASE_LAP_SECONDS = 90;
export function cumulativeTimingPoints(ledger, baseLapSeconds = 0) {
 if (!Number.isFinite(baseLapSeconds) || baseLapSeconds < 0) throw Error('基础圈时必须为非负有限数。');
 const noStop = [], strategy = [];
 for (const row of ledger.rows) {
  const common = row.progress*baseLapSeconds;
  noStop.push({progress:row.progress,seconds:common+row.noStopCost});
  // Duplicate x at the pit event: draw the lap first, then the expense as a
  // vertical step. This is a lap-end accounting convention, not a trajectory.
  if (row.stop) strategy.push({progress:row.progress,seconds:common+row.planCost-row.stopLoss,beforeStop:true});
  strategy.push({progress:row.progress,seconds:common+row.planCost});
 }
 return {noStop,strategy};
}
