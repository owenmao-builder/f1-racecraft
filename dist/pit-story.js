import {buildPitLedger} from './pit-ledger.js?v=8.3';
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
 <div class="story-stage"><div class="story-score"><div><span class="story-at">起点</span><strong class="story-balance">0.00 <small>秒</small></strong></div><span class="story-score-label">相对不再进站<br>尚未花费时间</span></div><div class="story-chart"></div>
 <div class="story-player"><button type="button" class="story-play">▶ 播放解说</button><label for="story-progress" class="sr-only">时间账本回放圈次</label><input id="story-progress" type="range" min="0" max="${context.remaining}" step="1" value="0"><output class="story-lap">起点</output></div>
 <p class="story-chart-note">上方 = 已省时间 · 下方 = 尚未回本 · 虚线 = 完整方案。比较同一车手的两种选择，不是两辆车的实时差距。</p></div>
 <div class="story-radio"><span class="story-radio-icon" aria-hidden="true">↳</span><div><span class="eyebrow">策略师解说 · <span class="story-phase"></span></span><h4 class="story-radio-title"></h4><p class="story-radio-text"></p></div></div>
 <div class="story-receipt" aria-label="终点时间账单"></div>
 <div class="story-takeaway"></div>
 <p class="story-boundary">历史起点 + 可调假设。非线性轮胎模型尚未按本场标定，不是车队实际决策复原。进站圈末扣进站成本，下一圈扣升温与假设交通损失。长胎段的外推尤其依赖你设的衰减参数。</p>`;

 function stop(){if(timer!==null)clearInterval(timer);timer=null;q('.story-play').textContent='▶ 播放解说';}
 function draw(){
  if(!ledger||!host.isConnected)return;
  const box=q('.story-chart'),w=Math.max(220,box.clientWidth),h=238,L=42,R=12,T=28,B=28;
  const values=ledger.rows.map(r=>r.balance),min=Math.min(-2,...values)*1.12,max=Math.max(2,...values)*1.18;
  const x=i=>L+(w-L-R)*i/context.remaining,y=v=>T+(h-T-B)*(max-v)/(max-min);
  const path=rows=>rows.map((r,i)=>(i?'L':'M')+x(r.progress).toFixed(2)+','+y(r.balance).toFixed(2)).join(' ');
  const row=ledger.rows[progress],ticks=[min,0,max],positive=row.balance>=0;
  const marks=current.plan.stops.map((s,i)=>`<line x1="${x(s.after)}" x2="${x(s.after)}" y1="${T}" y2="${h-B}" stroke="#a57956" stroke-dasharray="2 5"/><text x="${x(s.after)}" y="15" text-anchor="${x(s.after)>w-60?'end':x(s.after)<80?'start':'middle'}" fill="#e9ab7d">${current.plan.stops.length>1?(i+1)+'停':'进站'} L${context.lap+s.after-1}</text>`).join('');
  box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="逐圈时间账本：${ledger.final.balance>=0?'终点省时':'终点多用'} ${fmt(ledger.final.balance)} 秒，${ledger.recovery?'L'+ledger.recovery.lap+' 起持续回本':'没有持续回本点'}"><rect x="${L}" y="${T}" width="${w-L-R}" height="${y(0)-T}" fill="#a9d954" fill-opacity=".035"/>${ticks.map(v=>`<line x1="${L}" x2="${w-R}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0?'#7b8c78':'#25332d'}" stroke-dasharray="${v===0?'5 4':'1 0'}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" fill="#b1c0b9">${v>0?'+':''}${v.toFixed(0)}</text>`).join('')}${marks}<text x="${w-R}" y="${y(0)-7}" text-anchor="end" fill="#b6c7a2">回本线</text><path d="${path(ledger.rows)}" stroke="#768475" stroke-width="2" stroke-dasharray="4 5" fill="none"/><path d="${path(ledger.rows.slice(0,progress+1))}" stroke="${positive?'#c4ef69':'#f3ac76'}" stroke-width="3" stroke-linejoin="round" fill="none"/><line x1="${x(progress)}" x2="${x(progress)}" y1="${T}" y2="${h-B}" stroke="#a7c8c2" stroke-opacity=".3"/><circle cx="${x(progress)}" cy="${y(row.balance)}" r="5" stroke="#0e1814" stroke-width="2" fill="${positive?'#c4ef69':'#f3ac76'}"/>${ledger.recovery?`<circle cx="${x(ledger.recovery.progress)}" cy="${y(ledger.recovery.balance)}" r="4" fill="none" stroke="#c4ef69" stroke-width="2"><title>L${ledger.recovery.lap} 起持续回本</title></circle>`:''}<text x="${L}" y="${h-5}" fill="#9dacaa">L${context.lap} 起点</text><text x="${w-R}" y="${h-5}" text-anchor="end" fill="#9dacaa">L${context.lap+context.remaining-1} 终点</text></svg>`;
 }
 function narration(){
  const {plan,settings}=current,row=ledger.rows[progress],stops=plan.stops;
  if(!plan.compatible)return ['先确认，这个方案能不能执行。',`当前方案${plan.reasons.join('、')}。即使账面更快，也不会进入推荐；先修改配方或核实可用胎组。`];
  if(!stops.length)return ['留在赛道，是比较的起点。','这条线始终为零，因为我们正在把“不再进站”和它自己比较。换一种方案，就能看到进站先亏多少、新胎后来追回多少。'];
  if(phase===3&&current.referenceCaution){
   const alt=current.alternative,diff=alt?alt.plan.total-plan.total:0;
   return ['看可行方案之间的差距。',alt?`同一组假设下，这套方案比${alt.label}${diff>=0?'快':'慢'} ${fmt(diff)} 秒。时间账本中的更大差值，是相对“把旧胎硬撑到终点”的理论外推，不能理解为比赛中实际能赚到这些秒数。`:'当前缺少另一种可行方案。相对旧胎硬撑到终点的秒数仅为理论外推，不能当作实际比赛收益。'];
  }
  if(phase===0){
   const wear=tyreLapCost(context.compound,context.age+context.remaining-1,settings)-tyreLapCost(context.compound,context.age,settings);
   return ['不进站，也有旧胎的代价。',`现在是 ${names[context.compound]}，已跑 ${context.age} 圈。按当前假设的衰减，如果一直用到终点，最后一圈的轮胎时间代价${wear>0?'会比当前圈多 '+fmt(wear)+' 秒':'与当前圈相同'}。换胎值不值，要把后面每一圈的差值加起来看。`];
  }
  if(phase===1){
   const n=stops.findIndex(s=>s.after===progress),next=stops[Math.max(0,n)];
   const loss=pitLossAt(settings,next.after);
   return [`BOX, BOX！先付 ${fmt(loss)} 秒。`,`L${context.lap+next.after-1} 圈末换${names[next.compound]}。${next.after===1&&settings.flag!=='green'?'本圈采用你设的中和进站窗口。':''}进出维修区与停车共损失 ${fmt(loss)} 秒；下一圈再计 ${fmt(settings.warmup)} 秒升温与 ${fmt(settings.trafficLoss)} 秒假设交通成本。新胎得先把这笔账追回来。`];
  }
  if(phase===2)return [row.lapGain>=0?'把时间，一圈一圈拿回来。':'新胎也不是每圈都更快。',`L${row.lap}：仅看轮胎，这圈比继续用原胎${row.lapGain>=0?'快':'慢'} ${fmt(row.lapGain)} 秒${row.cold+row.traffic>0?`，还需支付 ${fmt(row.cold+row.traffic)} 秒升温与交通成本`:''}。累计轮胎${row.tyreSavings>=0?'收益':'损失'} ${fmt(row.tyreSavings)} 秒，扣掉已付成本后，${row.balance<0?'还差 '+fmt(row.balance)+' 秒才回本':'已净省 '+fmt(row.balance)+' 秒'}。`];
  if(ledger.final.balance>.005)return ['这次赚到了，但优势有多稳？',`轮胎共赚 ${fmt(ledger.final.tyreSavings)} 秒，支付进站 ${fmt(plan.pitCost)} 秒、升温 ${fmt(plan.coldCost)} 秒、交通 ${fmt(plan.trafficCost)} 秒，最终净省 ${fmt(ledger.final.balance)} 秒。${ledger.recovery?'从 L'+ledger.recovery.lap+' 起持续回本。':''}收益来自剩余每一圈的累积，不是只看出站那一圈。`];
  if(ledger.final.balance<-.005)return ['算到终点，这笔投资没回本。',`轮胎带来${ledger.final.tyreSavings>=0?'收益':'损失'} ${fmt(ledger.final.tyreSavings)} 秒，进站、升温与交通还要付 ${fmt(plan.pitCost+plan.coldCost+plan.trafficCost)} 秒，合计反而多用 ${fmt(ledger.final.balance)} 秒。这个模型下，不能只因为“换了新胎”就说策略更好。`];
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
