import {DRY,SCENARIOS,scenarioTyres,strategyContext,comparePitStrategies,evaluatePlan,sensitivity} from './race-strategy-engine.js?v=8.4';
import {mountPitStory} from './pit-story.js?v=12.0';
const names={SOFT:'软胎',MEDIUM:'中性胎',HARD:'硬胎'},short={SOFT:'S',MEDIUM:'M',HARD:'H'};
const signed=n=>(n>=0?'+':'−')+Math.abs(n).toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source='https://github.com/TUMFTM/race-simulation/tree/96ef2c2021982217be008fe458df47c1a72da071';
export function mountPitAnalysis(host,{data,evidence,race,showStory=true}){
 const context=strategyContext(data,evidence,race);
 host.innerHTML=`<div class="panel-title"><div><span class="eyebrow lime">RACE STRATEGY / 进站与轮胎推演</span><h2>这辆车，怎样换胎更省时。</h2></div><span class="chip orange">非线性条件模型</span></div>`;
 if(context.error){host.insertAdjacentHTML('beforeend',`<p class="pit-empty">${context.error}</p>`);return;}
 const s={target:'AUTO',delay:Math.min(5,context.remaining-2),pitLoss:21.5,currentPitLoss:13,flag:'green',warmup:1,trafficLoss:0,twoCompounds:!context.pastWet,tyres:scenarioTyres(),inventory:{SOFT:2,MEDIUM:2,HARD:2}};
 let chosen='auto',computed;
 const q=sel=>host.querySelector(sel);
 host.insertAdjacentHTML('beforeend',`
 <div class="pit-context"><span class="chip lime">带入历史记录</span><strong>${esc(context.driver)} · L${context.lap}</strong><span>${names[context.compound]} / 胎龄 ${context.age} 圈</span><span>计划剩余 ${context.remaining} 圈</span></div>
 <p class="pit-intro">从这一圈开始比较：留在赛道、本圈结束进站，或再等几圈。比较 ${esc(context.driver)} 在不同换胎方案下到终点的累计时间成本。</p>
 <div class="pit-formula"><span>核心判断</span><strong>换胎净收益 = 未来逐圈轮胎收益 − 进站 − 升温 − 交通</strong><p>大于零才省时。轮胎越旧，后期损失可以加速；新胎也会继续变旧。所有方案都算到同一个终点。</p></div>
 <div class="pit-mode-controls pit-controls"><label>耗胎情景<select id="pit-scenario">${Object.entries(SCENARIOS).map(([key,v])=>`<option value="${key}" ${key==='normal'?'selected':''}>${v.label} · 假设参数</option>`).join('')}<option value="custom" disabled>自定义系数</option></select></label><label>下次换哪种胎<select id="pit-target"><option value="AUTO">自动比较软 / 中 / 硬</option>${DRY.map(c=>`<option value="${c}">${names[c]}</option>`).join('')}</select></label></div>
 <p class="pit-assumption">胎龄来自历史记录；性能参数是可调工程情景，未对本场 2026 轮胎标定。低 / 中 / 高耗胎并不自动代表某条赛道。</p>
 ${showStory?'<section class="pit-story" aria-label="换胎策略互动解说"></section>':''}
 <div class="pit-tune-heading"><span class="eyebrow lime">YOUR PIT WALL / 轮到你做策略师</span><h3>改一个条件，看看结论会不会翻转。</h3><p>试着增加进站损失，或改变轮胎衰减。图表和方案会一起重算。</p></div>
 <div class="pit-layout"><div class="pit-controls">
 <label for="pit-delay"><span>再等几圈 <output id="pit-delay-value">${s.delay} 圈</output></span><input id="pit-delay" type="range" min="0" max="${context.remaining-2}" step="1" value="${s.delay}"></label>
 <label for="pit-loss"><span>绿旗进站总损失 <output id="pit-loss-value">21.5 秒</output></span><input id="pit-loss" type="range" min="5" max="40" step=".5" value="21.5"></label>
 <label>本圈旗况假设<select id="pit-flag"><option value="green">绿旗 · 正常进站成本</option><option value="vsc">VSC · 单独设定本圈损失</option><option value="sc">安全车 · 单独设定本圈损失</option></select></label>
 <label id="pit-current-label" hidden>本圈进站总损失（秒）<input id="pit-current-loss" type="number" min="0" max="40" step=".5" value="13" disabled></label>
 <p class="pit-assumption">中和情景只改变本圈结束进站的成本；后续圈恢复绿旗。不预测安全车持续时间、压缩车阵或对手反应。</p>
 <details class="pit-parameters"><summary>调整轮胎与模型假设</summary>
 <p>每圈轮胎代价：D(a) = δ + k₁a + k₂a² + q·max(0, a − A)²。a 是起圈胎龄；A 是性能衰减加速的假设拐点，不是安全寿命。将 k₂、q 设为 0 可回到线性模型。</p>
 <div class="pit-tyre-editors">${DRY.map(c=>`<fieldset><legend class="pit-compound ${c}">${short[c]} ${names[c]}</legend>${[['offset','新胎差值 δ','秒',5],['rate','线性衰减 k₁','秒 / 圈龄',1],['curve','加速衰减 k₂','秒 / 圈龄²',.1],['knee','衰减拐点 A','圈龄',100],['cliff','拐点后系数 q','秒 / 圈龄²',.1]].map(([key,label,unit,max])=>`<label>${label}<small>${unit}</small><input aria-label="${names[c]}${label}" type="number" min="0" max="${max}" step="${key==='knee'?'1':'any'}" value="${s.tyres[c][key]}" data-tyre="${c}" data-parameter="${key}"></label>`).join('')}<label>可用新胎组数<small>假设；未接入真实库存</small><input aria-label="${names[c]}可用新胎组数" type="number" min="0" max="10" step="1" value="2" data-inventory="${c}"></label></fieldset>`).join('')}</div>
 <label>每次新胎升温损失（秒）<input id="pit-warmup" type="number" min="0" max="10" step=".1" value="1"></label>
 <label>每次出站额外交通损失（秒）<input id="pit-traffic" type="number" min="0" max="20" step=".1" value="0"></label>
 <label class="pit-check"><input id="pit-two" type="checkbox" ${s.twoCompounds?'checked':''}>本模拟要求累计使用两种干胎</label>
 <p>仅检查已知历史配方、所设两配方要求和假设库存，不判定整场规则合法性。所有替换胎按新胎计算；雨地、红旗免费换胎、赛事特别要求与真实库存尚未接入。</p>
 </details><p class="pit-assumption">橙色参数均为假设。进站损失包含进出站与停车；结果取决于当前设定，不代表车队的实际最佳方案。</p>
 </div><div class="pit-visual">
 <div id="pit-headline" class="pit-headline" aria-live="polite"></div>
 <div class="pit-chart-title"><h3>哪一圈进站，时间代价最低？</h3><span>与继续用当前胎相比</span></div>
 <div id="pit-window-chart"></div>
 <p class="pit-chart-caption">横轴是进站圈，纵轴是模拟时间差；低于零表示省时。自动模式下各点可对应不同新胎配方。未满足约束的方案仅作时间参照；省时不等于获得赛道位置。</p>
 </div></div>
 <div class="pit-plan-heading"><h3>把几种选择放在同一条时间轴上</h3><span>“一停 / 两停”均指从当前时刻再进站的次数</span></div>
 <div class="pit-legend"><span class="pit-compound SOFT">S 软胎</span><span class="pit-compound MEDIUM">M 中性胎</span><span class="pit-compound HARD">H 硬胎</span><span>各段标注使用圈数</span></div>
 <div id="pit-plans"></div><div id="pit-breakdown" aria-live="polite"></div>
 <details class="analysis-details"><summary>完整公式、公开依据与能力边界</summary><p>每圈：tᵢ = Bᵢ + D配方(aᵢ) + Wᵢ + Qᵢ。方案总耗时：T = Σtᵢ + ΣPⱼ。换胎收益：G = T不再进站 − T换胎方案。G 大于零说明有时间收益；P 是进站损失，W 是升温损失，Q 是假设交通损失。一次换胎把下一圈胎龄归零，后续继续逐圈老化。</p><p>两种选择共同的基础圈速、燃油变轻与赛道演化项 Bᵢ 抵消；不直接用未经燃油、交通和旗况校正的历史圈速拟合轮胎。默认系数是本项目工程假设，不是 Pirelli 或车队数据，也没有完成真实赛事回测。</p><p>沿用 <a href="${source}" target="_blank" rel="noreferrer">TUM race-simulation</a> 的分胎段求和与方案搜索思路；TUM 本身支持二次衰减。当前版本新增后期拐点项、假设库存、交通成本与本圈中和进站窗口，不能称为上游完整仿真器。原线性移植与对照测试仍保留。</p><p><a href="https://press.pirelli.com/tyre-compounds-selected-for-zandvoort-monza-and-madrid/" target="_blank" rel="noreferrer">Pirelli 2026 配方与策略说明</a>展示了赛道负荷、温度和维修区损失如何影响一停、两停取舍；<a href="https://www.formula1.com/en/latest/article/undercut-vs-overcut-why-tyre-strategy-was-so-finely-poised-in-monaco-and-why.1YYMDkEBnFols8bDWtSXiz.1YYMDkEBnFols8bDWtSXiz" target="_blank" rel="noreferrer">F1 官方策略解读</a>说明新胎升温与交通会改变提前进站的收益。这些资料支持模型中的因素，不提供这里的数值系数。</p><p>自动模式同时搜索下一套软 / 中 / 硬胎；手动模式固定下一套配方。两停的第二套始终搜索三种干胎。推荐只限未来零、一、两停及所设库存；不含三停、对手应对、位置变化或精确弯角走线。敏感性范围将所有衰减项同时上下调整 25%，固定同一方案重算，既不是置信区间，也不是胜率。</p><p><a href="./race-strategy-engine.js" target="_blank" rel="noreferrer">当前模型源码 ↗</a> · <a href="./licenses/tum-NOTICE.txt" target="_blank" rel="noreferrer">修改说明与 LGPL-3.0 许可 ↗</a></p></details>`);
 const story=showStory?mountPitStory(q('.pit-story'),{context,onChoose:key=>{chosen=key;render();}}):{update(){},clear(){},dispose(){}};
 function update(){
  const inputs=[...host.querySelectorAll('.pit-controls input[type=number]:not(:disabled)')];
  if(inputs.some(el=>el.value===''||!el.validity.valid)){computed=null;story.clear();q('#pit-headline').textContent='请填写有效的非负参数，图表暂停更新。';q('#pit-window-chart').innerHTML='';q('#pit-plans').innerHTML='';q('#pit-breakdown').innerHTML='';return;}
  inputs.filter(el=>el.dataset.tyre).forEach(el=>s.tyres[el.dataset.tyre][el.dataset.parameter]=Number(el.value));
  inputs.filter(el=>el.dataset.inventory).forEach(el=>s.inventory[el.dataset.inventory]=Number(el.value));
  s.target=q('#pit-target').value;s.delay=Number(q('#pit-delay').value);s.pitLoss=Number(q('#pit-loss').value);s.warmup=Number(q('#pit-warmup').value);s.twoCompounds=q('#pit-two').checked;
  s.flag=q('#pit-flag').value;s.currentPitLoss=Number(q('#pit-current-loss').value);s.trafficLoss=Number(q('#pit-traffic').value);
  q('#pit-delay-value').textContent=s.delay+' 圈';q('#pit-loss-value').textContent=s.pitLoss.toFixed(1)+' 秒';
  computed=comparePitStrategies(context,s);
  render();
 }
 function render(){
  const rows=[['baseline','继续用当前胎',computed.baseline],['now','本圈结束进站',computed.now],['delayed',`再等 ${s.delay} 圈`,computed.delayed],['one','最佳一停时机',computed.one],['two','最佳两停时机',computed.two]];
  const eligible=rows.filter(r=>r[2]?.compatible),best=eligible.reduce((r,x)=>!r||x[2].total<r[2].total-1e-8?x:r,null);
  const key=chosen==='auto'?(best?.[0]??'baseline'):chosen;
  let selected=rows.find(r=>r[0]===key)?.[2];if(!selected){chosen='auto';render();return;}
  if(showStory)q('.pit-story').hidden=false;
  const immediate=selected.stops.length===1?evaluatePlan(context,s,[{after:1,compound:selected.stops[0].compound}]):computed.now;
  const alternatives=rows.filter(r=>['baseline','one','two'].includes(r[0])&&r[2]?.compatible&&JSON.stringify(r[2].stops)!==JSON.stringify(selected.stops)).sort((a,b)=>a[2].total-b[2].total);
  const alt=alternatives[0],alternative=alt?{plan:alt[2],label:alt[1]+(alt[2].stops.length?' / '+alt[2].stops.map(stop=>'L'+(context.lap+stop.after-1)+' '+names[stop.compound]).join(' → '):'')}:null;
  const oldAge=context.age+context.remaining;
  const referenceCaution=!computed.baseline.compatible||oldAge>s.tyres[context.compound].knee+15?`不再进站会把当前${names[context.compound]}用到 ${oldAge} 圈胎龄${!computed.baseline.compatible?'，且未满足两配方假设':''}。下方以它作理论账本参照；长胎段外推的秒数不宜理解为实际能获得的收益，请优先比较上方可行方案。`:'';
  story.update({plan:selected,settings:s,rows,chosen:key,now:immediate,baseline:computed.baseline,sensitivity:sensitivity(context,s,selected),alternative,referenceCaution});
  q('#pit-headline').innerHTML=best?`<span>在当前假设与候选范围内</span><strong>${best[0]==='baseline'?'继续用当前胎的时间代价最低':best[0]==='two'?'再进站两次的时间代价最低':`L${context.lap+best[2].stops[0].after-1} 换${names[best[2].stops[0].compound]}的时间代价最低`}</strong><p>${best[0]==='baseline'?(!computed.one&&!computed.two?'当前没有满足所设配方与库存的换胎方案。':'可行换胎方案的轮胎收益未抵消额外进站成本。'):`比不再进站的时间参照${best[2].delta<=0?'节省':'多用'} <b>${Math.abs(best[2].delta).toFixed(2)} 秒</b>。${!computed.baseline.compatible?'该参照尚未满足所设两配方约束。':''}`}</p>`:'<strong>当前候选未满足所设配方或库存约束</strong>';
  q('#pit-plans').innerHTML=rows.map(([rowKey,label,p])=>p?`<button type="button" class="pit-plan ${key===rowKey?'selected':''}" aria-pressed="${key===rowKey}" data-plan="${rowKey}"><span class="pit-plan-name">${label}<small>${p.stops.length?p.stops.map(stop=>'L'+(context.lap+stop.after-1)).join(' / '):'不再进站'}${!p.compatible?' · '+esc(p.reasons.join('、')):''}</small></span><span class="pit-timeline" aria-label="${p.segments.map(seg=>names[seg.compound]+' '+seg.length+' 圈').join('，')}">${p.segments.map(seg=>`<span class="pit-stint ${seg.compound}" style="flex-grow:${seg.length}" title="${names[seg.compound]}：L${context.lap+seg.from}–L${context.lap+seg.from+seg.length-1}">${seg.length>=Math.max(3,context.remaining/12)?`${short[seg.compound]} ${seg.length}`:''}</span>`).join('')}</span><span class="pit-delta ${p.delta<0?'gain':'loss'}">${signed(p.delta)}<small>秒 / 相对参照</small></span></button>`:`<div class="pit-plan unavailable"><span>${label}</span><span>${rowKey==='two'&&context.remaining<3?'剩余圈数不足以再进站两次':'没有满足所设配方与库存的方案'}</span></div>`).join('');
  q('#pit-plans').querySelectorAll('[data-plan]').forEach(button=>button.addEventListener('click',()=>{chosen=button.dataset.plan;render();}));
  const tyreGain=computed.baseline.tireCost-selected.tireCost;
  q('#pit-breakdown').innerHTML=`<div class="pit-cost-heading"><h3>为什么得出这个差值？</h3><span>${rows.find(r=>r[0]===key)[1]}${!selected.compatible?' · 仅作时间参照':''}</span></div><div class="pit-costs"><div><span>轮胎带来的${tyreGain>=0?'节省':'损失'}</span><strong class="${tyreGain>=0?'gain':'loss'}">${Math.abs(tyreGain).toFixed(2)} s</strong><div class="pit-cost-track"><i style="width:${Math.min(100,Math.abs(tyreGain)/Math.max(1,Math.abs(tyreGain),selected.pitCost,selected.coldCost+selected.trafficCost)*100)}%"></i></div></div><div><span>额外进站损失</span><strong>${selected.pitCost.toFixed(2)} s</strong><div class="pit-cost-track"><i class="pit-cost" style="width:${selected.pitCost/Math.max(1,Math.abs(tyreGain),selected.pitCost,selected.coldCost+selected.trafficCost)*100}%"></i></div></div><div><span>升温 + 交通损失</span><strong>${(selected.coldCost+selected.trafficCost).toFixed(2)} s</strong><div class="pit-cost-track"><i class="pit-cost" style="width:${(selected.coldCost+selected.trafficCost)/Math.max(1,Math.abs(tyreGain),selected.pitCost,selected.coldCost+selected.trafficCost)*100}%"></i></div></div><div><span>合计时间差</span><strong class="${selected.delta<0?'gain':'loss'}">${signed(selected.delta)} s</strong><small>进站 + 升温 + 交通 − 轮胎节省</small></div></div><p class="pit-meaning">${selected.delta<0?'省下的时间是这位车手的理论时间收益。':'付出的时间需要其他收益才能补偿。'} 交通只按你设的额外损失计入。真实剩余胎组和赛道交通仍须核实，净省时间不等于最终名次一定更高。</p>`;
  drawChart();
 }
 function drawChart(){
  if(!computed||!host.isConnected)return;
  const container=q('#pit-window-chart'),w=Math.max(260,container.clientWidth),h=260,L=60,R=12,T=20,B=46;
  const values=computed.curve.map(p=>p.delta),lo=Math.min(0,...values),hi=Math.max(0,...values),span=Math.max(2,hi-lo),min=lo-span*.08,max=hi+span*.08;
  const x=i=>L+5+(w-L-R-10)*(values.length===1?.5:i/(values.length-1)),y=n=>T+5+(h-T-B-10)*(max-n)/(max-min);
  const selected=Math.min(s.delay,values.length-1),bestIndex=computed.one?computed.one.stops[0].after-1:null;
  const ticks=[...new Set([0,Math.floor((values.length-1)/2),values.length-1])];
  container.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(context.driver)} 进站圈次与相对不再进站的模拟时间差"><rect x="${L}" y="${T}" width="${w-L-R}" height="${h-T-B}" fill="none" stroke="var(--line)"/>${[0,.5,1].map(t=>{const val=lo+(hi-lo)*t;return `<line x1="${L}" x2="${w-R}" y1="${y(val)}" y2="${y(val)}" stroke="var(--line)"/><text x="${L-8}" y="${y(val)+4}" text-anchor="end">${val.toFixed(0)}</text>`;}).join('')}<line x1="${L}" x2="${w-R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-dasharray="4 4"/><polyline points="${values.map((v,i)=>x(i)+','+y(v)).join(' ')}" fill="none" stroke="var(--lime)" stroke-width="2.5"/>${bestIndex!==null?`<circle cx="${x(bestIndex)}" cy="${y(values[bestIndex])}" r="6" fill="var(--panel)" stroke="var(--lime)" stroke-width="2"><title>最佳一停 L${context.lap+bestIndex}：${signed(values[bestIndex])} 秒</title></circle>`:''}<line x1="${x(selected)}" x2="${x(selected)}" y1="${T}" y2="${h-B}" stroke="var(--cyan)" stroke-dasharray="3 4"/><circle cx="${x(selected)}" cy="${y(values[selected])}" r="5" fill="var(--cyan)"><title>你的等待方案 L${context.lap+selected}：${signed(values[selected])} 秒</title></circle>${ticks.map(i=>`<text x="${x(i)}" y="${h-B+22}" text-anchor="${i===0?'start':i===values.length-1?'end':'middle'}">L${context.lap+i}</text>`).join('')}<text x="${L}" y="13">时间差（秒）</text><text x="${(L+w-R)/2}" y="${h-3}" text-anchor="middle">本场进站圈次</text></svg><div class="pit-chart-key"><span>● 等待方案 L${context.lap+s.delay}：${signed(values[selected])} s</span><span>○ ${bestIndex===null?'所选配方未满足约束':`最佳一停 L${context.lap+bestIndex}`}</span></div>`;
 }
 host.querySelectorAll('.pit-controls input,.pit-controls select').forEach(el=>el.addEventListener('input',()=>{
  if(el.id==='pit-scenario'){
   s.tyres=scenarioTyres(el.value);
   host.querySelectorAll('[data-tyre]').forEach(input=>input.value=s.tyres[input.dataset.tyre][input.dataset.parameter]);
  }
  if(el.dataset.tyre)q('#pit-scenario').value='custom';
  if(el.id==='pit-flag'){
   const active=el.value!=='green';q('#pit-current-label').hidden=!active;q('#pit-current-loss').disabled=!active;
   if(active)q('#pit-current-loss').value=el.value==='vsc'?13:11;
  }
  chosen=el.id==='pit-delay'?'delayed':'auto';update();
 }));
 let width=0;const observer=new ResizeObserver(entries=>{if(!host.isConnected){observer.disconnect();return;}const next=entries[0].contentRect.width;if(Math.abs(next-width)>1){width=next;drawChart();}});observer.observe(host);
 update();
 return ()=>{observer.disconnect();story.dispose();};
}
