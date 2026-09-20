import {buildPitLedger,cumulativeTimingPoints,STORY_BASE_LAP_SECONDS} from './pit-ledger.js?v=15.0';
import {tyreLapCost,pitLossAt} from './race-strategy-engine.js?v=8.3';
const names={SOFT:'软胎',MEDIUM:'中性胎',HARD:'硬胎'};
const fmt=n=>Math.abs(n)<.005?'0.00':Math.abs(n).toFixed(2);
const sign=n=>(n>.005?'+':n<-.005?'−':'')+fmt(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountPitStory(host,{context,onChoose}) {
 let current=null,ledger=null,progress=0,phase=0,timer=null,disposed=false;
 const q=s=>host.querySelector(s);
 host.innerHTML=`<div class="story-top"><div><span class="eyebrow lime">PIT WALL / 策略师带你看</span><h3>先花时间，换后面的速度。</h3><p>把进站当成一笔投资：付出去的秒数，能在终点前赚回来吗？</p></div><span class="story-badge">互动解说<br>约 15 秒</span></div>
 <div class="story-choice"><label for="story-plan">这次讲哪种选择？</label><select id="story-plan"></select></div>
 <div class="story-alternative" aria-live="polite"></div>
 <p class="story-reference-note"></p>
 <div class="story-verdict" aria-live="polite"></div>
 <div class="story-sensitivity"></div>
 <div class="story-steps" role="group" aria-label="换胎策略解说章节">${['旧胎的代价','进站先付款','新胎逐圈追','终点算总账'].map((s,i)=>`<button type="button" data-story-step="${i}" aria-pressed="${i===0}"><b>0${i+1}</b><span>${s}</span></button>`).join('')}</div>
 <div class="story-stage"><div class="story-score"><div><span class="story-at">起点</span><strong class="story-balance">0.00 <small>秒</small></strong></div><span class="story-score-label">相对不再进站<br>尚未花费时间</span></div><div class="story-chart-key"><span class="no-stop">不再换胎</span><span class="with-stop">换胎方案</span><b>同一圈，越低越快</b></div>
 <div class="story-plot-heading"><h4>累计用时 · 放大策略差异</h4><span>已扣除双方共同基础用时</span></div><div class="story-chart story-cost-chart"></div>
 <details class="story-total-detail"><summary>查看完整累计总用时</summary><p>为两条线同时加回 90 秒/圈的教学基础圈时；它只改变图形尺度，终点差值不变，不是实际比赛总成绩。</p><div class="story-chart story-total-chart"></div></details>
 <div class="story-finish" aria-label="终点累计用时对比"></div>
 <div class="story-player"><button type="button" class="story-play">▶ 播放解说</button><label for="story-progress" class="sr-only">时间账本回放圈次</label><input id="story-progress" type="range" min="0" max="${context.remaining}" step="1" value="0"><output class="story-lap">起点</output></div>
 <p class="story-chart-note">橙色虚线 = 不再换胎；绿色实线 = 换胎方案。两图都从同一起点累计，终点较低的方案用时更少。主图放大轮胎、进站、升温和交通的累计成本；完整图加回相同的基础用时。两图终点差值一致。主图斜率是每圈额外成本，完整图斜率才是每圈总用时。</p></div>
 <div class="story-radio"><span class="story-radio-icon" aria-hidden="true">↳</span><div><span class="eyebrow">策略师解说 · <span class="story-phase"></span></span><h4 class="story-radio-title"></h4><p class="story-radio-text"></p></div></div>
 <div class="story-receipt" aria-label="终点时间账单"></div>
 <div class="story-takeaway"></div>
 <p class="story-boundary">历史起点 + 可调假设。非线性轮胎模型尚未按本场标定，不是车队实际决策复原。进站圈末扣进站成本，下一圈扣升温与假设交通损失。长胎段的外推尤其依赖你设的衰减参数。</p>`;

 function stop(){if(timer!==null)clearInterval(timer);timer=null;q('.story-play').textContent='▶ 播放解说';}
 function draw(){
  if(!ledger||!host.isConnected)return;
  const n=context.remaining,orange='#f0ae7d',green='#c4ef69';
  for(const [selector,base,h] of [['.story-total-chart',STORY_BASE_LAP_SECONDS,220],['.story-cost-chart',0,300]]){
   const box=q(selector);if(!box.clientWidth)continue;
   const w=Math.max(220,box.clientWidth),L=46,R=18,T=40,B=31;
   const points=cumulativeTimingPoints(ledger,base);
   const max=Math.max(1,points.noStop.at(-1).seconds,points.strategy.at(-1).seconds)*1.12;
   const x=i=>L+(w-L-R)*i/n,y=v=>h-B-(h-T-B)*v/max;
   const path=rows=>rows.map((r,i)=>(i?'L':'M')+x(r.progress).toFixed(2)+','+y(r.seconds).toFixed(2)).join(' ');
   const marks=current.plan.stops.map((s,i)=>`<line x1="${x(s.after)}" x2="${x(s.after)}" y1="${T}" y2="${h-B}" stroke="#66806a" stroke-dasharray="2 5"/><text x="${x(s.after)}" y="${base?T+12:18}" text-anchor="${x(s.after)>w-65?'end':x(s.after)<85?'start':'middle'}" fill="#c4d7af">${current.plan.stops.length>1?(i+1)+'停':'进站'} L${context.lap+s.after-1}</text>`).join('');
   const row=ledger.rows[progress],baseValue=base*progress+row.noStopCost,planValue=base*progress+row.planCost;
   const recovery=!base&&ledger.recovery?`<circle cx="${x(ledger.recovery.progress)}" cy="${y(ledger.recovery.planCost)}" r="5" fill="#0e1814" stroke="${green}" stroke-width="2"><title>L${ledger.recovery.lap} 起持续更省时</title></circle>`:'';
   const final=ledger.final,summary=`${final.balance>=0?'换胎终点少用':'换胎终点多用'} ${fmt(final.balance)} 秒`;
   box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${base?'累计总用时示意':'累计轮胎与进站成本放大图'}：${summary}，越低越快"><text x="${L}" y="${base?16:32}" fill="#a8bba4">${base?'总用时 / 分钟':'累计成本 / 秒'}</text>${[0,1/3,2/3,1].map(t=>{const v=max*t;return `<line x1="${L}" x2="${w-R}" y1="${y(v)}" y2="${y(v)}" stroke="#28372d"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" fill="#a8bba4">${base?(v/60).toFixed(1):v.toFixed(0)}</text>`;}).join('')}${marks}<path class="story-no-stop-line" d="${path(points.noStop)}" stroke="${orange}" stroke-width="2.5" stroke-dasharray="6 5" fill="none"/><path class="story-plan-line" d="${path(points.strategy)}" stroke="${green}" stroke-width="3" stroke-linejoin="round" fill="none"/>${recovery}<line x1="${x(progress)}" x2="${x(progress)}" y1="${T}" y2="${h-B}" stroke="#a7c8c2" stroke-opacity=".5"/><circle cx="${x(progress)}" cy="${y(baseValue)}" r="4" stroke="#0e1814" stroke-width="2" fill="${orange}"/><circle cx="${x(progress)}" cy="${y(planValue)}" r="4" stroke="#0e1814" stroke-width="2" fill="${green}"/><circle class="story-no-stop-end" cx="${x(n)}" cy="${y(points.noStop.at(-1).seconds)}" r="3" fill="${orange}"/><circle class="story-plan-end" cx="${x(n)}" cy="${y(points.strategy.at(-1).seconds)}" r="3" fill="${green}"/><text x="${L}" y="${h-7}" fill="#9dacaa">L${context.lap} 起点</text><text x="${w-R}" y="${h-7}" text-anchor="end" fill="#9dacaa">L${context.lap+n-1} 终点</text></svg>`;
  }
 }
 function narration(){
  const {plan,settings}=current,row=ledger.rows[progress],stops=plan.stops;
  if(!plan.compatible)return ['先确认，这个方案能不能执行。',`当前方案${plan.reasons.join('、')}。即使账面更快，也不会进入推荐；先修改配方或核实可用胎组。`];
  if(!stops.length)return ['留在赛道，是比较的起点。','当前选择就是不再进站，所以两条累计用时曲线完全重合、一起上升。换一种方案，就能看到进站时的跳升，以及之后能否追平。'];
  if(phase===3&&current.referenceCaution){
   const alt=current.alternative,diff=alt?alt.plan.total-plan.total:0;
   return ['看可行方案之间的差距。',alt?`同一组假设下，这套方案比${alt.label}${diff>=0?'快':'慢'} ${fmt(diff)} 秒。时间账本中的更大差值，是相对“把旧胎硬撑到终点”的理论外推，不能理解为比赛中实际能赚到这些秒数。`:'当前缺少另一种可行方案。相对旧胎硬撑到终点的秒数仅为理论外推，不能当作实际比赛收益。'];
  }
  if(phase===0){
   const wear=tyreLapCost(context.compound,context.age+context.remaining-1,settings)-tyreLapCost(context.compound,context.age,settings);
   return ['不进站，也有旧胎的代价。',`现在是 ${names[context.compound]}，已跑 ${context.age} 圈。按当前假设的衰减，如果一直用到终点，最后一圈的轮胎时间代价${wear>0?'会比当前圈多 '+fmt(wear)+' 秒':'与当前圈相同'}。固定基础圈时、只考虑轮胎衰减时，旧胎越来越慢，累计用时就越来越陡。主图扣除了两方案相同的基础用时，让这个变化更容易看清。`];
  }
  if(phase===1){
   const n=stops.findIndex(s=>s.after===progress),next=stops[Math.max(0,n)];
   const loss=pitLossAt(settings,next.after);
   return [`BOX, BOX！先付 ${fmt(loss)} 秒。`,`L${context.lap+next.after-1} 圈末换${names[next.compound]}。${next.after===1&&settings.flag!=='green'?'本圈采用你设的中和进站窗口。':''}进出维修区与停车共损失 ${fmt(loss)} 秒；下一圈再计 ${fmt(settings.warmup)} 秒升温与 ${fmt(settings.trafficLoss)} 秒假设交通成本。图上同一圈的竖直跳升，就是这笔一次性成本；之后曲线继续上升，但新胎较快时，斜率会变小。`];
  }
  if(phase===2)return [row.lapGain>=0?'把时间，一圈一圈拿回来。':'新胎也不是每圈都更快。',`L${row.lap}：仅看轮胎，这圈比继续用原胎${row.lapGain>=0?'快':'慢'} ${fmt(row.lapGain)} 秒${row.cold+row.traffic>0?`，还需支付 ${fmt(row.cold+row.traffic)} 秒升温与交通成本`:''}。累计轮胎${row.tyreSavings>=0?'收益':'损失'} ${fmt(row.tyreSavings)} 秒，扣掉已付成本后，${row.balance<0?'还差 '+fmt(row.balance)+' 秒才回本':'已净省 '+fmt(row.balance)+' 秒'}。`];
  if(ledger.final.balance>.005)return ['这次赚到了，但优势有多稳？',`轮胎共赚 ${fmt(ledger.final.tyreSavings)} 秒，支付进站 ${fmt(plan.pitCost)} 秒、升温 ${fmt(plan.coldCost)} 秒、交通 ${fmt(plan.trafficCost)} 秒，最终净省 ${fmt(ledger.final.balance)} 秒。${ledger.recovery?'从 L'+ledger.recovery.lap+' 起持续回本。':''}绿色换胎曲线最终低于橙色不换胎曲线，这个高度差就是省下的总时间。`];
  if(ledger.final.balance<-.005)return ['算到终点，这笔投资没回本。',`轮胎带来${ledger.final.tyreSavings>=0?'收益':'损失'} ${fmt(ledger.final.tyreSavings)} 秒，进站、升温与交通还要付 ${fmt(plan.pitCost+plan.coldCost+plan.trafficCost)} 秒，合计反而多用 ${fmt(ledger.final.balance)} 秒。所以绿色换胎曲线在终点仍然更高。即使时机已优化，也不保证轮胎收益一定覆盖进站成本。`];
  return ['到终点，刚好打平。','轮胎收益恰好抵消进站、升温与交通成本，没有留下净时间优势。还需要额外证据，才有理由把它当成更好的选择。'];
 }
 function paint(nextPhase){
  const row=ledger.rows[progress],stops=current.plan.stops;
  phase=nextPhase??(progress===context.remaining?3:stops.some(s=>s.after===progress)?1:stops.length&&progress>stops[0].after?2:0);
  q('#story-progress').value=progress;
  q('.story-at').textContent=progress===0?`L${context.lap} · 决策起点`:`L${row.lap} · ${progress===context.remaining?'终点结算':'圈末'}`;
  q('.story-balance').innerHTML=`${sign(row.balance)} <small>秒</small>`;
  q('.story-balance').classList.toggle('in-debt',row.balance<-.005);
  q('.story-score-label').innerHTML=`相对不再进站<br>${row.balance<-.005?'尚未回本':row.balance>.005?'已经省下时间':progress===0?'尚未花费时间':'收支持平'}`;
  q('.story-lap').textContent=progress===0?'起点':`L${row.lap}`;
  q('.story-phase').textContent=['看旧胎','看成本','看追赶','看结局'][phase];
  const [title,body]=narration();q('.story-radio-title').textContent=title;q('.story-radio-text').textContent=body;
  host.querySelectorAll('[data-story-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.storyStep)===phase)));
  draw();
 }
 function update({plan,settings,rows,chosen,now,baseline,sensitivity,alternative,referenceCaution}){
  stop();current={plan,settings,now,alternative,referenceCaution};ledger=buildPitLedger(context,settings,plan);progress=0;
  q('#story-plan').innerHTML=rows.filter(r=>r[2]).map(([key,label,p])=>`<option value="${key}" ${key===chosen?'selected':''}>${esc(label)}${p.stops.length?' · '+p.stops.map(s=>'L'+(context.lap+s.after-1)+' '+names[s.compound]).join(' / '):''}${!p.compatible?' · 仅时间参照':''}</option>`).join('');
  const f=ledger.final,stops=plan.stops,profitable=f.balance>.005;
  const total=value=>{const t=(context.remaining*STORY_BASE_LAP_SECONDS+value).toFixed(2).split('.');return `${Math.floor(Number(t[0])/60)}:${String(Number(t[0])%60).padStart(2,'0')}.${t[1]}`;};
  q('.story-finish').innerHTML=`<div><span>不再换胎 · 累计用时示意</span><strong class="no-stop">${total(f.noStopCost)}</strong><small>其中策略成本 ${f.noStopCost.toFixed(2)} 秒</small></div><div><span>${stops.length?'换胎方案':'同一不换胎方案'} · 累计用时示意</span><strong class="with-stop">${total(f.planCost)}</strong><small>其中策略成本 ${f.planCost.toFixed(2)} 秒</small></div><p><b>${Math.abs(f.balance)<.005?'终点用时相同':`换胎${profitable?'少用':'多用'} ${fmt(f.balance)} 秒`}</b><span>${ledger.recovery?'从 L'+ledger.recovery.lap+' 起持续更省时':stops.length?'本方案到终点未形成持续优势':'当前两条曲线重合'} · 总用时为教学示意</span></p>`;
  q('.story-reference-note').textContent=referenceCaution;
  q('.story-reference-note').hidden=!referenceCaution;
  const difference=alternative?alternative.plan.total-plan.total:0;
  q('.story-alternative').innerHTML=!plan.compatible?`<strong>仅作时间参照</strong><span>${esc(plan.reasons.join('、'))}；不参与推荐。</span>`:alternative?`<span>先和其他可行方案比较</span><strong>这套方案${Math.abs(difference)<.005?'与对照基本打平':difference>0?'快 '+fmt(difference)+' 秒':'慢 '+fmt(difference)+' 秒'}</strong><span>对照：${esc(alternative.label)} · 其他候选中最快的一种</span>`:'<span>当前约束下，没有另一种可行方案可供比较。</span>';
  const netText=n=>(n>=0?'省 ':'多用 ')+fmt(n)+' 秒';
  q('.story-sensitivity').innerHTML=stops.length?`<strong>如果耗胎估错了？</strong><span>同一方案，衰减项上下浮动 25%：${netText(sensitivity.min)} ～ ${netText(sensitivity.max)}。</span><small>${sensitivity.min<0&&sensitivity.max>0?'结论可能翻转，优势依赖耗胎假设。':'这是参数敏感性范围，不是预测置信区间。'}</small>`:'<span>这是不再进站的理论时间参照；未满足所设约束时不会被推荐。</span>';
  q('.story-verdict').innerHTML=`<div><span>相对硬撑不再进站 · ${referenceCaution?'仅理论参照':'同一终点'}</span><strong class="${f.balance<-.005?'in-debt':''}">${!stops.length?'不再进站 · 时间参照':profitable?(referenceCaution?'理论少用 ':'净省 ')+fmt(f.balance)+' 秒':f.balance<-.005?'多用 '+fmt(f.balance)+' 秒':'收支打平'}</strong></div><div><span>${!stops.length?'比较基准':ledger.recovery?'持续回本点':'回本进度'}</span><strong>${!stops.length?'从这里比较':ledger.recovery?'L'+ledger.recovery.lap:'终点前未回本'}</strong></div>`;
  q('.story-receipt').innerHTML=`<div><span>轮胎${f.tyreSavings>=0?'赚回':'损失'}</span><strong>${sign(f.tyreSavings)} <small>s</small></strong></div><i>−</i><div><span>${stops.length} 次进站</span><strong>${fmt(f.pitCost)} <small>s</small></strong></div><i>−</i><div><span>升温 + 交通</span><strong>${fmt(f.warmupCost+f.trafficCost)} <small>s</small></strong></div><i>=</i><div class="story-net ${f.balance<0?'in-debt':''}"><span>终点净收益</span><strong>${sign(f.balance)} <small>s</small></strong></div>`;
  let timing='';
  if(stops.length===1&&stops[0].after>1){const diff=now.total-plan.total;timing=`<p><b>为什么不立刻换？</b>同样换${names[stops[0].compound]}，等到 L${context.lap+stops[0].after-1} 比本圈结束就换${diff>=0?'少用':'多用'} ${fmt(diff)} 秒。早换少受旧胎拖累，却也让下一套胎更早变旧；还要比较两次机会的进站成本。</p>`;}
  q('.story-takeaway').innerHTML=`${timing}<p><b>${profitable?'什么会让它不再划算？':'策略师还要看什么？'}</b>${profitable?`净优势是 ${fmt(f.balance)} 秒。若相对参照再多出超过这个数的未计损失，优势就会消失；也要检查上方耗胎敏感性。`:'交通按假设损失计入；实际出站位置、对手应对和未来旗况没有仿真，不能据此还原策略组的真实判断。'}</p>${!plan.compatible||!baseline.compatible?`<p class="story-constraint">${!plan.compatible?'所选方案：'+esc(plan.reasons.join('、')):'不再进站的比较基准未满足两配方假设'}；以上仅作时间对照，不参与推荐。</p>`:''}`;
  paint(0);
 }
 q('.story-total-detail').addEventListener('toggle',draw);
 q('#story-plan').addEventListener('change',e=>onChoose(e.target.value));
 q('#story-progress').addEventListener('input',e=>{if(!ledger)return;stop();progress=Number(e.target.value);paint();});
 host.querySelectorAll('[data-story-step]').forEach(b=>b.addEventListener('click',()=>{
  if(!ledger)return;stop();const n=Number(b.dataset.storyStep),stops=current.plan.stops;
  const last=stops.at(-1)?.after||0;
  progress=[0,stops[0]?.after||0,Math.min(context.remaining,last+Math.max(1,Math.floor((context.remaining-last)/2))),context.remaining][n];paint(n);
 }));
 q('.story-play').addEventListener('click',()=>{
  if(!ledger)return;if(timer!==null){stop();return;}
  if(progress===context.remaining)progress=0;
  q('.story-play').textContent='Ⅱ 暂停解说';paint();
  timer=setInterval(()=>{
   if(disposed||!host.isConnected||!host.getClientRects().length||document.hidden){stop();return;}
   progress=Math.min(context.remaining,progress+1);paint();if(progress===context.remaining)stop();
  },15000/context.remaining);
 });
 const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
 let width=0;const observer=new ResizeObserver(entries=>{const w=entries[0].contentRect.width;if(Math.abs(w-width)>1){width=w;draw();}});observer.observe(host);
 return {update,clear(){stop();ledger=null;host.hidden=true;},dispose(){disposed=true;stop();observer.disconnect();document.removeEventListener('visibilitychange',visibility);}};
}
