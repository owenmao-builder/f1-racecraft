import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyseDriver} from '../dist/analysis-engine.js';
import {strategyContext,comparePitStrategies,scenarioTyres} from '../dist/race-strategy-engine.js';

const data=JSON.parse(await readFile(new URL('../dist/data/netherlands.json',import.meta.url)));
const request={driver:'RUS',lap:32};
const evidence=analyseDriver(data,request);
assert.equal(evidence.first.stint[3],'HARD');
assert.equal(evidence.first.age,14);
assert.equal(evidence.first.current[1],32);
assert.ok(evidence.first.prior.every(row=>row[2]+row[3]<=evidence.time));
assert.equal('second' in evidence,false);

// A dataset with only Russell must still support the full pit calculation.
const driverNumber=evidence.first.driver.driver_number;
const isolated={...data,drivers:data.drivers.filter(d=>d.driver_number===driverNumber),
 laps:data.laps.filter(r=>r[0]===driverNumber),stints:data.stints.filter(r=>r[0]===driverNumber),
 positions:undefined,intervals:undefined,results:[]};
const single=analyseDriver(isolated,request);
const context=strategyContext(isolated,single,{laps:72});
assert.deepEqual(context,strategyContext(data,evidence,{laps:72}));
assert.equal(context.remaining,41);
const choices=comparePitStrategies(context,{target:'AUTO',delay:5,pitLoss:21.5,currentPitLoss:13,
 flag:'green',warmup:1,trafficLoss:0,twoCompounds:true,tyres:scenarioTyres(),
 inventory:{SOFT:2,MEDIUM:2,HARD:2}});
assert.ok(choices.one&&choices.two&&choices.now&&choices.delayed);
assert.ok(choices.one.delta<0);
assert.throws(()=>analyseDriver(isolated,{driver:'VER',lap:32}),/未找到/);
assert.throws(()=>analyseDriver(isolated,{driver:'RUS',lap:99}),/没有可用起圈记录/);
assert.throws(()=>analyseDriver(isolated,{driver:'RUS',lap:1.5}),/有效的圈次/);
console.log('PASS: single-driver evidence, no opponent/interval dependency, historical time boundary, pit plans and invalid selections.');
