// Evidence is evaluated at the selected driver's lap start, never at an invented corner timestamp.
export const number = x => typeof x === 'number' && Number.isFinite(x);
export function atTime(rows, driver, time, age=Infinity) {
 let result=null;
 for(const r of rows){if(r[0]>time)break;if(r[1]===driver)result=r;}
 return result&&time-result[0]<=age?result:null;
}
export function analyse(data, request) {
 const a=data.drivers.find(d=>d.name_acronym===request.driver),b=data.drivers.find(d=>d.name_acronym===request.opponent);
 if(!a||!b)throw Error('本场参赛车手资料中未找到这两位车手。');
 if(a.driver_number===b.driver_number)throw Error('请选择两位不同的车手。');
 const lap=data.laps.find(l=>l[0]===a.driver_number&&l[1]===request.lap);
 if(!lap||!number(lap[2]))throw Error(`${a.name_acronym} 在第 ${request.lap} 圈没有可用起圈记录，可能已退赛、被套圈或数据缺失。请换一个圈次。`);
 const t=lap[2];
 function driverContext(driver){
  const n=driver.driver_number,rows=data.laps.filter(l=>l[0]===n&&number(l[2])&&l[2]<=t),current=rows.at(-1);
  const running=current&&(current[2]===t||(number(current[3])&&current[2]+current[3]+3>=t));
  const stint=running?data.stints.find(s=>s[0]===n&&s[1]<=current[1]&&(s[2]===null||s[2]>=current[1])):null;
  const pitIn=new Set(data.stints.filter(s=>s[0]===n).slice(0,-1).map(s=>s[2]));
  const prior=rows.filter(l=>number(l[3])&&l[3]>0&&l[2]+l[3]<=t&&!l[4]&&!pitIn.has(l[1])).slice(-3);
  const pace=prior.length>=2?prior.reduce((s,l)=>s+l[3],0)/prior.length:null;
  const position=atTime(data.positions,n,t),interval=atTime(data.intervals,n,t,8);
  const gap=interval&&(number(interval[2])?interval[2]:interval[2]===null&&position?.[2]===1?0:null);
  const classification=data.results?.find(x=>x.driver_number===n)||null;
  const absence=!running?`${driver.name_acronym} 在所选时刻没有有效行驶圈记录${classification?.dnf?'；赛后分类为 DNF（退赛）':classification?.dns?'；赛后分类为 DNS（未发车）':''}。`:null;
  return {driver,current:running?current:null,stint,age:stint&&number(stint[4])?stint[4]+current[1]-stint[1]:null,prior,pace,position:running?position?.[2]:null,interval,gap:running?gap:null,classification,absence};
 }
 const first=driverContext(a),second=driverContext(b);
 const aligned=first.interval&&second.interval&&Math.abs(first.interval[0]-second.interval[0])<=3;
 const gap=aligned&&number(first.gap)&&number(second.gap)?Math.abs(first.gap-second.gap):null;
 let gapIssue=null;
 if(!first.current||!second.current)gapIssue={code:'no_simultaneous_lap',label:'不适用',text:[first.absence,second.absence].filter(Boolean).join('')+'不能计算这两名车手在此时的车距。'};
 else if(!first.interval||!second.interval)gapIssue={code:'stale_sample',label:'采样不足',text:'当前缺少起圈前 8 秒内的双车间隔样本。位置和轮胎记录仍可单独查看。'};
 else if(typeof first.interval[2]==='string'||typeof second.interval[2]==='string')gapIssue={code:'lapped',label:'套圈标记',text:'间隔记录包含套圈等非秒数标记，不能直接相减得到双车距离。'};
 else if(!aligned)gapIssue={code:'unaligned',label:'时间未对齐',text:'两车最近的间隔采样相差超过 3 秒，暂不计算双车距离。'};
 else if(gap===null)gapIssue={code:'unknown_reference',label:'参照缺失',text:'至少一名车手缺少可用的领跑者差值，无法计算双车间隔。'};
 const ahead=number(first.gap)&&number(second.gap)?first.gap<second.gap?'driver':'opponent':null;
 const paceDelta=number(first.pace)&&number(second.pace)?second.pace-first.pace:null;
 const control=data.control.filter(c=>c[0]<=t&&c[0]>=t-120).slice(-3);
 return {first,second,time:t,gap,gapIssue,ahead,paceDelta,control,request};
}
export function availableOpponents(data, request) {
 return data.drivers.filter(d=>d.name_acronym!==request.driver&&d.name_acronym!==request.opponent).flatMap(d=>{
  try{const r=analyse(data,{...request,opponent:d.name_acronym});return r.first.current&&r.second.current&&r.first.stint&&r.second.stint&&number(r.gap)&&number(r.paceDelta)?[{id:d.name_acronym,name:d.full_name,gap:r.gap,position:r.second.position}]:[];}catch{return [];}
 }).sort((a,b)=>a.gap-b.gap).slice(0,3);
}
// A transparent teaching calculation. Probability and gains are user assumptions, not predictions.
export function compareChoices({probability,gain,failureCost,battleCost,followCost,riskCost,horizon}) {
 const p=probability/100;
 return {attack:battleCost+(1-p)*failureCost+riskCost-p*gain,follow:followCost*horizon,
  breakEven:100*(battleCost+failureCost+riskCost-followCost*horizon)/(gain+failureCost)};
}
