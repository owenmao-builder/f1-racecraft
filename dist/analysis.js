import { mountPitAnalysis } from './pit-analysis.js?v=12.0';
import { analyse, availableOpponents, compareChoices, number } from './analysis-engine.js';
const cache=new Map();
let disposePit=()=>{};
let current=null,revision=0,result=null,request=null,settings=null,onRace,onAnalysis=()=>{};
let preferences={driver:'RUS',opponent:'VER',lap:32,corner:3};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(x,d=1)=>number(x)?x.toFixed(d):'—';
const compound={SOFT:'软胎',MEDIUM:'中性胎',HARD:'硬胎',INTERMEDIATE:'半雨胎',WET:'全雨胎'};
const repoLinks=`<a href="https://github.com/theOehrly/Fast-F1" target="_blank" rel="noreferrer">FastF1 ↗</a> · <a href="https://github.com/br-g/openf1" target="_blank" rel="noreferrer">OpenF1 ↗</a> · <a href="https://github.com/TUMFTM/race-simulation" target="_blank" rel="noreferrer">TUM race-simulation ↗</a>`;
export function customEntry(){return `<div class="analysis-tabs" aria-label="从精选赛点开始推演"><span class="analysis-location">官方精选</span><button data-view="custom">到策略研究院，自己试一次 ↗</button></div>`;}
export function customSelection(){return current&&request&&result?{race:current.id,...request}:null;}
export function setCustomAnalysisMode(mode){$('#strategy-custom').dataset.mode=mode;}

export async function prepareCustomAnalysis(input,races){
 const keys=['race','driver','opponent','lap','corner'];
 const race=races.find(r=>r.id===input?.race);
 if(!input||Object.keys(input).length!==5||Object.keys(input).some(k=>!keys.includes(k))||!race||typeof input.driver!=='string'||typeof input.opponent!=='string'||!Number.isInteger(input.lap)||input.lap<1||input.lap>race.laps||!Number.isInteger(input.corner)||input.corner<1||input.corner>30)throw Error('Invalid custom analysis request');
 let data=cache.get(race.id);if(!data){const response=await fetch(`./data/${race.id}.json`);if(!response.ok)throw Error('Race evidence unavailable');data=await response.json();cache.set(race.id,data);}
 const evidence=analyse(data,input);preferences={driver:input.driver,opponent:input.opponent,lap:input.lap,corner:input.corner};return {evidenceScope:'lap-start; corner not mapped',gapSeconds:evidence.gap,gapIssue:evidence.gapIssue,tyreAges:[evidence.first.age,evidence.second.age],priorLapCounts:[evidence.first.prior.length,evidence.second.prior.length]};
}
export async function mountCustomAnalysis({race,races,changeRace,mode='research',onAnalysed=()=>{}}) {
 disposePit();const v=++revision;current=race;onRace=changeRace;onAnalysis=onAnalysed;result=null;request=null;settings=null;setCustomAnalysisMode(mode);onAnalysis(null);
 $('#strategy-custom').innerHTML=`
 <form id="custom-form" class="panel custom-query"><div class="query-grid">
 <label>比赛<select id="custom-race">${races.map(r=>`<option value="${r.id}" ${r.id===race.id?'selected':''}>${r.short} · ${r.date}</option>`).join('')}</select></label>
 <label>分析车手<select id="custom-driver" disabled><option>载入参赛名单…</option></select></label>
 <label>对手<select id="custom-opponent" disabled><option>载入参赛名单…</option></select></label>
 <label>车手圈数<input id="custom-lap" type="number" min="1" max="${race.laps}" step="1" value="${Math.min(preferences.lap,race.laps)}" required></label>
 <label>目标弯号<input id="custom-corner" type="number" min="1" max="30" step="1" value="${preferences.corner}" required></label>
 </div><div class="query-bottom"><p>综合查看车距、轮胎、节奏与策略取舍。</p><button type="submit" id="custom-submit" class="button primary" disabled>分析赛点 <span>↗</span></button></div>
 <p class="query-scope">圈数以所选车手为准。当前证据定位到起圈时刻；目标弯号尚未与轨迹标定，不会把起圈数据当作弯心数据。</p><p id="custom-status" role="status">正在读取本场公开数据…</p></form>
 <div id="custom-result"></div>`;
 $('#custom-race').addEventListener('change',e=>onRace(e.target.value));
 $('#custom-form').addEventListener('submit',e=>{e.preventDefault();runAnalysis();});
 for(const id of ['custom-driver','custom-opponent','custom-lap','custom-corner'])$('#'+id).addEventListener('input',()=>{if(result){result=null;disposePit();$('#custom-result').hidden=true;$('#custom-status').textContent='条件已修改，请重新分析。';onAnalysis(null);}});
 try{
  let data=cache.get(race.id);
  if(!data){const response=await fetch(`./data/${race.id}.json`);if(!response.ok)throw Error('本场数据暂时无法读取，请重试。');data=await response.json();if(data.schema!==1||!Array.isArray(data.laps))throw Error('本场数据格式暂不支持。');cache.set(race.id,data);}
  if(v!==revision)return;
  const options=data.drivers.map(d=>`<option value="${esc(d.name_acronym)}">${esc(d.name_acronym)} · ${esc(d.full_name)}</option>`).join('');
  for(const [id,value] of [['custom-driver',preferences.driver],['custom-opponent',preferences.opponent]]){const el=$('#'+id);el.innerHTML=options;el.disabled=false;if(data.drivers.some(d=>d.name_acronym===value))el.value=value;}
  $('#custom-submit').disabled=false;runAnalysis();
 }catch(e){if(v!==revision)return;$('#custom-status').textContent=e.message;$('#custom-submit').textContent='重新载入';$('#custom-submit').disabled=false;$('#custom-submit').type='button';$('#custom-submit').onclick=()=>mountCustomAnalysis({race,races,changeRace,mode:$('#strategy-custom').dataset.mode,onAnalysed});}
}
function runAnalysis(){
 if(!$('#custom-form').reportValidity())return;
 preferences={driver:$('#custom-driver').value,opponent:$('#custom-opponent').value,lap:Number($('#custom-lap').value),corner:Number($('#custom-corner').value)};
 if(preferences.driver===preferences.opponent){result=null;onAnalysis(null);$('#custom-status').textContent='分析车手和对手不能是同一人。';$('#custom-result').hidden=true;return;}
 const data=cache.get(current.id);
 try{request={...preferences};result=analyse(data,request);settings=null;renderResult(data);$('#custom-result').hidden=false;$('#custom-status').textContent=`已读取 ${current.short}站 · ${request.driver} 第 ${request.lap} 圈起点的公开记录。T${request.corner} 攻防仍需轨迹或影像核实。`;onAnalysis(customSelection());}
 catch(e){result=null;onAnalysis(null);$('#custom-result').hidden=true;$('#custom-status').textContent=e.message;}
}
function driverCard(c){return `<article class="driver-evidence"><div><span class="driver-acronym">${esc(c.driver.name_acronym)}</span><span>${esc(c.driver.team_name)}</span></div><h3>${esc(c.driver.full_name)}</h3><div class="evidence-metrics"><div><span>起圈时排名</span><strong>${c.position?'P'+c.position:'—'}</strong></div><div><span>正在进行</span><strong>${c.current?'L'+c.current[1]:'无记录'}</strong></div><div><span>轮胎配方</span><strong class="tyre-${esc(c.stint?.[3])}">${compound[c.stint?.[3]]||'此时未知'}</strong></div><div><span>胎龄 · 已跑圈数</span><strong>${c.age??'—'}<small> 圈</small></strong></div></div>${c.absence?`<p class="driver-availability">${esc(c.absence)} 赛后分类仅用于解释资料范围，不代表已确定退赛的精确时刻。</p>`:''}</article>`;}
function tyreFact(c){return `<span class="individual-fact"><b>${esc(c.driver.name_acronym)}</b> ${c.stint?`${compound[c.stint[3]]||esc(c.stint[3])} · ${c.age===null?'胎龄未知':c.age+' 圈'}`:'此时无轮胎记录'}</span>`;}
function paceFact(c){return `<span class="individual-fact"><b>${esc(c.driver.name_acronym)}</b> ${number(c.pace)?`${f(c.pace,2)} s / 圈<small>${c.prior.length} 个有效完整圈</small>`:`${c.prior.length} 个有效完整圈<small>不足以计算此前平均节奏</small>`}</span>`;}
function recoveryOptions(data,r){
 if(number(r.gap)&&r.first.stint&&r.second.stint&&number(r.paceDelta))return '';
 const candidates=availableOpponents(data,request);
 return `<div class="comparison-recovery"><h3>保留 ${esc(request.driver)} 第 ${request.lap} 圈，换一位有可比较数据的对手</h3>${candidates.length?`<div class="recovery-options">${candidates.map(c=>`<button class="button" data-valid-opponent="${esc(c.id)}">改为 ${esc(c.id)}${c.position?' · P'+c.position:''}<span>约 ${f(c.gap)} 秒 ↗</span></button>`).join('')}</div><p>按可用间隔由近到远排列；有数据不代表两车已在 T${request.corner} 展开缠斗。</p>`:'<p>当前时刻没有满足双车对比条件的其他车手。可以换一圈，或继续查看下方单车数据。</p>'}</div>`;
}
function renderResult(data){
 disposePit();
 const r=result,a=r.first,b=r.second;
 let verdict=!a.current||!b.current?'这组车手在所选时刻无法做双车对比。':number(r.gap)?r.gap>1.5?'先核实：这真的是一场直接缠斗吗？':'两车接近，但“为什么争”还需要下一层证据。':'车距暂不能比较，已有的单车数据仍然可看。';
 let detail=number(r.gap)?`在 ${request.driver} 第 ${request.lap} 圈起点，两车相对领跑者差值估计约为 ${f(r.gap)} 秒。${r.gap>1.5?'这不能支持“正在 T'+request.corner+' 贴身攻防”的前提；也不能排除这一圈稍后发生变化。':'起圈接近值得继续检查，但不能据此确认在 T'+request.corner+' 已经展开攻防。'}`:esc(r.gapIssue?.text||'间隔记录不足，暂不生成双车车距。');
 const utc=new Date(Date.parse(data.session.date_start)+r.time*1000).toISOString().slice(11,23);
 $('#custom-result').innerHTML=`<div class="custom-context"><div><span class="eyebrow">${esc(current.short)} / L${request.lap} / T${request.corner}（待定位）</span><h2>${request.driver} <span>×</span> ${request.opponent}</h2></div><span>证据时间：${utc} UTC<br>圈起点，不是 T${request.corner} 弯心</span></div>
 <nav class="lab-result-nav" aria-label="本次推演步骤"><button type="button" data-analysis-target="custom-evidence">01 / 赛点证据</button><button type="button" data-analysis-target="pit-analysis">02 / 进站与轮胎</button><button type="button" data-analysis-target="custom-battle">03 / 进攻或跟车</button></nav>
 <article id="custom-evidence" class="evidence-verdict"><span class="chip ${number(r.gap)&&r.gap<=1.5?'lime':'orange'}">先验证前提</span><h2>${verdict}</h2><p>${detail}</p>${recoveryOptions(data,r)}</article>
 <div class="driver-evidence-grid">${driverCard(a)}${driverCard(b)}</div>
 <section id="pit-analysis" class="pit-analysis panel research-only" aria-label="进站与轮胎策略推演"></section>
 <details id="custom-explanation" class="research-evidence panel"><summary>展开距离、轮胎、圈速与策略解读</summary><div class="factor-grid">
 ${factor('01','距离与位置',number(r.gap)?'采样估计':esc(r.gapIssue?.label||'记录不足'),number(r.gap)?`约 ${f(r.gap)} 秒`:'此时无法比较',number(r.gap)?`由两车相对领跑者的差值估计。样本均在起圈前 8 秒内，彼此不超过 3 秒；不是精确空间距离。`:esc(r.gapIssue?.text))}
 ${factor('02','轮胎与使用阶段',a.stint&&b.stint?'双方可用':a.stint||b.stint?'单车可用':'此时无记录',tyreFact(a)+tyreFact(b),'分别展示两位车手的轮胎记录。配方与胎龄不等于温度或磨损，缺少一方记录时不生成双车轮胎优劣结论。')}
 ${factor('03','之前的比赛节奏',number(r.paceDelta)?'可以比较':number(a.pace)||number(b.pace)?'单车可用':'样本不足',number(r.paceDelta)?`${request.driver} 平均${r.paceDelta>=0?'快':'慢'} ${f(Math.abs(r.paceDelta),2)} 秒 / 圈`:paceFact(a)+paceFact(b),`有效完整圈：${request.driver} ${a.prior.length} 个，${request.opponent} ${b.prior.length} 个；每人至少 2 个才计算平均节奏。排除进出站圈，未校正交通、燃油和旗况。`)}
 ${factor('04','大局目标与未知信息','尚未接入',`计划剩余 ${current.laps-request.lap+1} 圈`,'计划圈数包括当前圈。能量、完整无线电和车队目标尚未接入；这些是分析能力的边界，不是前三项基础数据全部缺失。')}
 </div>
 <div class="custom-two-col"><article class="panel"><div class="panel-title"><h2>决策之前，圈速怎样变化？</h2><span class="chip">真实圈速</span></div>${paceChart(a,b)}<p class="caption">各自最近的有效完整圈，均早于证据时刻。两车的圈号与行驶时间可能不同。</p></article><article class="panel"><span class="eyebrow">WHY / POSSIBLE EXPLANATIONS</span><h2>这个赛点，关键考量是什么？</h2>${reasoning(r)}<p class="caption">以上为条件解读，无法证明车手或策略组当时的真实想法。</p></article></div></details>
 <details class="analysis-details panel"><summary>查看时间边界、赛会消息与数据出处</summary><p>驾驶决策的解释仅使用起圈时刻及以前的证据。赛后分类另行标注，用于解释为什么不能进行这组数据对比，不被当作车手当时已知的信息，也不用于认定精确退赛时刻。所选 T${request.corner} 尚未与轨迹标定；${request.driver} 第 ${request.lap} 圈完整圈速不会用于解释这一圈开始时的决策。</p><h3>此前 120 秒内的赛会消息</h3>${r.control.length?'<ul>'+r.control.map(c=>`<li>${new Date(Date.parse(data.session.date_start)+c[0]*1000).toISOString().slice(11,19)} UTC · ${esc(c[5])}</li>`).join('')+'</ul>':'<p>没有收录到这一时间窗的消息。无消息不代表可以确认全场绿旗。</p>'}<p>OpenF1 历史数据快照 · 获取于 ${esc(data.retrievedAt.slice(0,10))} · session ${data.session.session_key}。胎龄为轮胎段开始时已跑圈数 + 当前圈号 − 轮胎段起始圈。</p><div class="evidence-links">${data.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.endpoint)} 原始记录 ↗</a>`).join('')}</div><p>1.5 秒仅用于提示“值得核对是否接近”，不是超车规则、DRS 门槛或成功概率。</p></details>
 <section id="custom-battle" class="custom-simulation panel"><div class="panel-title"><div><span class="eyebrow lime research-only">WHAT IF / 由你设定条件</span><span class="eyebrow lime observe-only">RACECRAFT / 策略师带你看取舍</span><h2>现在争，还是先跟住？</h2></div><span class="chip orange research-only">教学模型 · 非赛事预测</span></div><div class="observe-only"><p class="body-copy">先看当时的距离、轮胎与此前节奏，再讨论进攻、防守或等待的代价。</p>${reasoning(r)}<p class="caption">这些是基于已知条件的解读，不能据此确认 T${request.corner} 发生过缠斗，也不代表车队的真实意图。</p><button class="button primary" data-view="strategy-research">带着这个赛点，去研究院比较方案 ↗</button></div><div class="research-only"><p class="body-copy">将双车关系设为“进攻方在后、目标车在前”。下面全部是你可修改的假设，不自动继承本场遥测，也不证明 T${request.corner} 发生过这次进攻。</p><button class="button primary" id="start-hypothesis">用假设条件比较两种选择 ↗</button><div id="hypothesis-workspace" hidden></div></div></section>
 <details class="analysis-details panel"><summary>已接入哪些开源能力？还有哪些边界？</summary><div class="reuse-grid"><div><h3>OpenF1 · 已使用</h3><p>本页的参赛名单、圈速、轮胎段、位置和间隔记录来自其公开历史接口。</p></div><div><h3>FastF1 · 下一步定位到弯</h3><p>提供遥测、圈次与赛道信息，可用于距离对齐和弯角窗口分析；本页尚未接入其遥测。</p></div><div><h3>TUM race-simulation · 基础模型与扩展</h3><p>沿用其分胎段成本模型与搜索思路，扩展非线性衰减、假设库存、交通成本和本圈中和进站窗口。未接入完整 VSE、交通或安全车仿真，也不反推弯道意图。</p></div></div><p>${repoLinks}</p><p class="caption">“进站与轮胎推演”使用 TUM 基础思路的扩展模型，参数尚未对本场标定；“现在争，还是先跟住”仍为本项目的独立教学公式。两者不等于真实最优策略。</p></details>`;
 $('#custom-result').querySelectorAll('[data-analysis-target]').forEach(button=>button.addEventListener('click',()=>{
  const target=$('#strategy-custom').dataset.mode==='observe'&&button.dataset.analysisTarget==='pit-analysis'?'observe-guide':button.dataset.analysisTarget;
  document.getElementById(target)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }));
 disposePit=mountPitAnalysis($('#pit-analysis'),{data,evidence:r,race:current,showStory:false})||(()=>{});
 $('#start-hypothesis').addEventListener('click',startHypothesis);
 document.querySelectorAll('[data-valid-opponent]').forEach(button=>button.addEventListener('click',()=>{$('#custom-opponent').value=button.dataset.validOpponent;runAnalysis();}));
}
function factor(n,title,status,value,description){return `<article class="factor-card"><div><span>${n} / ${title}</span><span class="evidence-label">${status}</span></div><h3>${value}</h3><p>${description}</p></article>`;}
function reasoning(r){
 if(!r.first.current||!r.second.current)return `<div class="analysis-reason"><h3>先换成能够比较的一组数据</h3><p>${esc(r.gapIssue.text)} 当前不会针对这组车手生成“为什么缠斗”的解释。你仍可查看有记录车手的轮胎和圈速，或使用上方推荐对手继续分析。</p></div>`;
 const reasons=[];
 if(!number(r.gap)||r.gap>1.5)reasons.push(['距离优先于动机','先核实两车是否在这一弯相遇。若尚未接近，“选择缠斗”的问题可能应该改成“为什么追赶或控制差距”。']);
 else reasons.push(['机会窗口','若轨迹证实已接近，出口速度与可用空间可能影响是否立即进攻；起圈间隔只能提出这个假设。']);
 if(r.first.stint&&r.second.stint)reasons.push(['轮胎是条件，不是答案',`两车为 ${compound[r.first.stint[3]]||r.first.stint[3]} / ${compound[r.second.stint[3]]||r.second.stint[3]}，胎龄 ${r.first.age??'?'} / ${r.second.age??'?'} 圈。配方和胎龄可解释潜在节奏差，但无法单独确认磨损或抓地力。`]);
 reasons.push(['进攻、防守、等待，一起比较','进攻可能换来清晰赛道，也可能消耗轮胎和时间；防守能保住位置，但缠斗可能让后车追近；先跟住可以等待机会，也可能错失窗口。判断取舍，还需要后车距离、剩余圈数和车队目标。']);
 return reasons.map(([h,p])=>`<div class="analysis-reason"><h3>${h}</h3><p>${p}</p></div>`).join('');
}
function paceChart(a,b){
 const rows=[...a.prior,...b.prior];if(!rows.length)return '<p>没有可比较的完整圈速。</p>';
 const lo=Math.floor(Math.min(...rows.map(l=>l[3]))-1),hi=Math.ceil(Math.max(...rows.map(l=>l[3]))+1),y=v=>155-(v-lo)/(hi-lo)*120;
 let svg=`<svg class="pace-chart" viewBox="0 0 540 200" role="img" aria-label="两车此前最多三个有效完整圈的圈速，纵轴为秒"><text x="5" y="17" fill="#93a1b4" font-size="12">秒 / 圈</text>`;
 for(let i=0;i<3;i++){let v=lo+(hi-lo)*i/2;svg+=`<line x1="48" x2="516" y1="${y(v)}" y2="${y(v)}" stroke="#2a3440"/><text x="5" y="${y(v)+4}" fill="#93a1b4" font-size="12">${v.toFixed(1)}</text>`;}
 [a,b].forEach((c,i)=>{let color=i?'#72b7ff':'#d1fa49';const points=c.prior.map((l,j)=>`${100+j*180},${y(l[3])}`).join(' ');svg+=`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`;c.prior.forEach((l,j)=>{svg+=`<circle cx="${100+j*180}" cy="${y(l[3])}" r="4" fill="${color}"><title>${esc(c.driver.name_acronym)} L${l[1]} · ${l[3]} 秒</title></circle><text x="${100+j*180}" y="${178+i*16}" fill="${color}" text-anchor="middle" font-size="12">${esc(c.driver.name_acronym)} L${l[1]} · ${l[3].toFixed(2)}</text>`;});});return svg+'</svg>';
}
const sliders=[['probability','假设进攻成功率','%',5,95,5,55],['gain','成功后节省的累计时间','s',0,10,.5,4],['failureCost','失败后的额外损失','s',0,6,.5,2],['battleCost','这次缠斗本身的损失','s',0,4,.1,.8],['followCost','继续跟车每圈损失','s / 圈',0,2,.1,.4],['riskCost','损伤等风险的期望代价','s',0,10,.5,1],['horizon','比较未来多少圈','圈',1,8,1,3]];
function startHypothesis(){
 settings=Object.fromEntries(sliders.map(s=>[s[0],s[6]]));$('#start-hypothesis').hidden=true;$('#hypothesis-workspace').hidden=false;
 $('#hypothesis-workspace').innerHTML=`<div class="hypothesis-grid"><div class="hypothesis-controls">${sliders.map(([id,label,unit,min,max,step,value])=>`<label for="hyp-${id}"><span>${label}</span><output id="hyp-value-${id}">${value} ${unit}</output><input id="hyp-${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`).join('')}</div><div id="hypothesis-result" aria-live="polite"></div></div><details class="analysis-details"><summary>展开计算方式与限制</summary><p>进攻净时间代价 = 缠斗损失 + (1 − 成功率) × 失败损失 + 风险期望代价 − 成功率 × 成功收益。跟车代价 = 每圈损失 × 比较圈数。越低越省时间，负值代表净收益。</p><p>成功收益与失败损失均按所选比较时段填写。成功率、接触风险和时间代价全是人为假设，未从赛车遥测拟合；没有建模对手反应、下一弯、积分、再次进攻或进站策略，不能给出真实超车成功率或全场最优选择。</p></details>`;
 sliders.forEach(([id,,unit])=>$('#hyp-'+id).addEventListener('input',e=>{settings[id]=Number(e.target.value);$('#hyp-value-'+id).textContent=settings[id]+' '+unit;renderHypothesis();}));renderHypothesis();
}
function renderHypothesis(){const c=compareChoices(settings),delta=c.attack-c.follow;$('#hypothesis-result').innerHTML=`<span class="eyebrow">在你设定的假设下 / 未来 ${settings.horizon} 圈</span><h3>${Math.abs(delta)<.05?'两种选择的时间代价接近':delta<0?'立即进攻的期望时间代价较低':'先跟住的期望时间代价较低'}</h3><div class="choice-cost ${delta<-.05?'preferred':''}"><span>立即进攻 <small>期望净代价</small></span><strong>${c.attack.toFixed(2)} s</strong></div><div class="choice-cost ${delta>.05?'preferred':''}"><span>先跟住 <small>累计代价</small></span><strong>${c.follow.toFixed(2)} s</strong></div><p>相差 <b>${Math.abs(delta).toFixed(2)} 秒</b>。${c.breakEven<0?'在当前简化条件下，即使假设成功率为零，进攻代价仍更低；请检查输入是否符合场景。':c.breakEven>100?'即使假设成功率为 100%，当前模型中的进攻代价仍较高。':`其余条件不变，成功率约高于 ${c.breakEven.toFixed(0)}% 时，两条选择才会交换顺序。`}</p><div class="explain-box">试着增加风险代价或降低成功率，观察结论如何变化。这个结果解释假设的影响，不代表 ${request.driver} 当时应该这样做。</div>`;}
