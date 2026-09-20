import {analyseDriver} from './analysis-engine.js?v=13.0';
import {scenarioTyres,strategyContext,comparePitStrategies,evaluatePlan,sensitivity} from './race-strategy-engine.js?v=8.4';
import {mountPitStory} from './pit-story.js?v=15.0';
const names={SOFT:'软胎',MEDIUM:'中性胎',HARD:'硬胎'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountObservatory(host,{race,races,selection,onSelection,changeRace,research}){
 let disposed=false,story=null,lesson='tyres',loading=false,data=null;
 const q=s=>host.querySelector(s);
 host.innerHTML=`<form id="observe-form" class="panel custom-query"><div class="research-query-grid">
 <label>比赛<select id="observe-race">${races.map(r=>`<option value="${r.id}" ${r.id===race.id?'selected':''}>${r.short} · ${r.date}</option>`).join('')}</select></label>
 <label>分析车手<select id="observe-driver" disabled><option>载入参赛名单…</option></select></label>
 <label>从第几圈开始<input id="observe-lap" type="number" min="1" max="${race.laps}" step="1" value="${selection?.lap??Math.min(32,Math.max(2,Math.round(race.laps*.45)))}" required></label>
 </div><div class="query-bottom"><p>跟着策略师，看懂这辆车为什么需要换胎、什么时候进站。</p><button type="submit" id="observe-submit" class="button primary" disabled>查看换胎讲解 ↗</button></div>
 <p class="query-scope">配方与胎龄来自这位车手的历史记录；后续时间账本使用明确标注的教学假设。</p><p id="observe-status" role="status">正在读取本场轮胎与圈次记录…</p></form>
 <div class="observe-brief"><div><span class="eyebrow lime">THE STRATEGIST'S NOTEBOOK</span><h2>先看懂，再做决定。</h2><p>一次只讲一个问题。沿着时间账本，听懂策略师在权衡什么。</p></div></div>
 <div class="observe-lessons" role="group" aria-label="策略知识课堂">
 ${[['tyres','01','换胎的时间账','为什么先掉时间，最后反而更快？'],['window','02','进站窗口与交通','同一套轮胎，为什么早一圈就不同？'],['decision','03','如何判断换胎策略','结果不好，就一定是策略错了吗？']].map(([id,n,title,sub])=>`<button type="button" data-lesson="${id}" aria-controls="lesson-${id}" aria-pressed="${id===lesson}"><b>${n}</b><span><strong>${title}</strong><small>${sub}</small></span></button>`).join('')}
 </div>
 <section id="lesson-tyres" aria-label="换胎的时间账"><div class="observe-loading panel" role="status">正在准备本场的轮胎教学案例…</div></section>
 <section id="lesson-window" class="panel observe-lesson" aria-label="进站窗口与交通" hidden><span class="eyebrow lime">KNOW-HOW / 把赛道位置放回策略里</span><h2>换胎快不快，还要看“在哪儿换”。</h2><p class="lesson-lead">策略师会把三个位置连起来看：现在到入口的距离、维修区里的耗时，以及出来后前面有没有车。</p>
 <div class="window-flow"><div><b>01 / 入口前</b><strong>机会能不能抓住</strong><p>已经经过入口，就不能回头进站。临时中断发生的时刻，也会改变可执行的选择。</p></div><span aria-hidden="true">→</span><div><b>02 / 维修区</b><strong>这一停要付多少</strong><p>看完整的进出站损失。场上降速时，进站的相对代价可能降低；窗口持续多久仍然未知。</p></div><span aria-hidden="true">→</span><div><b>03 / 回到赛道</b><strong>新胎能不能发挥</strong><p>新胎需要升温，前车也可能挡住节奏。纸面上的速度优势，未必立刻变成可用时间。</p></div></div>
 <div class="coach-takeaway"><span>策略师划重点</span><strong>算省下几秒之前，先问：能执行吗？出来后能跑起来吗？</strong></div>

 <div class="observe-next"><span>理解窗口以后，试试改变进站损失和回场交通。</span><button class="button primary" data-view="strategy-research">去研究院设定条件 ↗</button></div></section>
 <section id="lesson-decision" class="panel observe-lesson" aria-label="如何判断换胎策略" hidden><span class="eyebrow lime">KNOW-HOW / 用决策时刻的视角复盘</span><h2>先评价判断，再评价结果。</h2><p class="lesson-lead">一次换胎决策有可能判断合理、结果却不理想。复盘时，先把之后才知道的事情拿开。</p>
 <div class="decision-checks"><article><b>01</b><h3>当时知道什么？</h3><p>轮胎、距离、此前圈速与已发生的旗况。不要提前使用后面的安全车、退赛或圈速。</p></article><article><b>02</b><h3>有哪些可执行选择？</h3><p>是否赶得上入口？有哪种可用轮胎？剩余圈数够不够追回进站成本？</p></article><article><b>03</b><h3>结论有多依赖假设？</h3><p>把耗胎、交通或进站损失改一点，再看顺序会不会翻转。只在一组参数里更快，还不够稳。</p></article></div>
 <div class="coach-takeaway"><span>记住这一句</span><strong>好的复盘，要说清依据、取舍，以及哪些信息还不知道。</strong></div>
 <div class="observe-next"><span>现在把策略师的位置交给你。</span><button class="button primary" data-view="strategy-research">我来做一次判断 ↗</button></div></section>`;
 q('#observe-race').addEventListener('change',e=>changeRace(e.target.value));
 q('#observe-form').addEventListener('submit',e=>{e.preventDefault();if(q('#observe-form').reportValidity())loadLesson();});
 for(const id of ['observe-driver','observe-lap'])q('#'+id).addEventListener('input',()=>{
  story?.dispose();story=null;onSelection(null);
  q('#observe-status').textContent='条件已修改，请重新查看换胎讲解。';
  q('#lesson-tyres').innerHTML='<p class="panel observe-loading">请点击上方「查看换胎讲解」，更新这一圈的轮胎时间账本。</p>';
 });
 host.querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>{
  lesson=button.dataset.lesson;
  host.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lesson===lesson)));
  for(const id of ['tyres','window','decision'])q('#lesson-'+id).hidden=id!==lesson;
 }));
 async function loadLesson(){
  if(loading)return;loading=true;
  try{
   if(!data){
    const response=await fetch(`./data/${race.id}.json`);if(!response.ok)throw Error('本场数据暂时无法读取。');
    const loaded=await response.json();if(disposed)return;
    if(loaded.schema!==1||!Array.isArray(loaded.laps))throw Error('本场数据格式暂不支持。');
    data=loaded;
    q('#observe-driver').innerHTML=data.drivers.map(d=>`<option value="${esc(d.name_acronym)}">${esc(d.name_acronym)} · ${esc(d.full_name)}</option>`).join('');
    const initialDriver=selection?.driver??'RUS';
    if(data.drivers.some(d=>d.name_acronym===initialDriver))q('#observe-driver').value=initialDriver;
    q('#observe-driver').disabled=false;q('#observe-submit').disabled=false;
   }
   if(!q('#observe-form').reportValidity())return;
   story?.dispose();story=null;onSelection(null);
   const input={race:race.id,driver:q('#observe-driver').value,lap:Number(q('#observe-lap').value)};
   const evidence=analyseDriver(data,input),context=strategyContext(data,evidence,race);
   onSelection(input);
   q('#observe-status').textContent=`已读取 ${race.short}站 · ${input.driver} 第 ${input.lap} 圈的记录。下面以这位车手为起点讲解换胎。`;
   if(context.error)throw Error(context.error);
   // Use the same engineering assumptions as the research room, without exposing its controls here.
   const settings={target:'AUTO',delay:Math.min(5,context.remaining-2),pitLoss:21.5,currentPitLoss:13,flag:'green',warmup:1,trafficLoss:0,twoCompounds:!context.pastWet,tyres:scenarioTyres(),inventory:{SOFT:2,MEDIUM:2,HARD:2}};
   const computed=comparePitStrategies(context,settings),plan=computed.one||computed.best||computed.baseline;
   const rows=[['one','一停教学方案',plan]],now=plan.stops.length===1?evaluatePlan(context,settings,[{after:1,compound:plan.stops[0].compound}]):computed.now;
   const oldAge=context.age+context.remaining;
   const referenceCaution=!computed.baseline.compatible||oldAge>settings.tyres[context.compound].knee+15?`对照中的“不再换胎”会用到 ${oldAge} 圈胎龄${!computed.baseline.compatible?'，也未满足两配方假设':''}，只作理论账本参照，不能理解为实际比赛收益。`:'';
   q('#lesson-tyres').innerHTML=`<div class="observe-context"><span class="chip lime">${esc(race.short)}站 · ${context.driver} L${context.lap}</span><span>${names[context.compound]} / 已用 ${context.age} 圈</span><span>剩余 ${context.remaining} 圈</span><span class="chip orange">历史起点 + 教学假设</span></div><section class="pit-story guided-story" aria-label="策略师换胎讲解"></section><details class="analysis-details panel"><summary>这堂课采用什么条件？</summary><p>胎龄与配方来自本场公开历史记录。教学固定使用中等耗胎工程情景、绿旗进站损失 21.5 秒、每次升温 1 秒、额外交通 0 秒与各两套新胎，展示候选中时间代价最低的一停方案；它不一定优于零停或两停。这些参数未对本场拟合，不代表实际最佳策略或车队判断。</p><p><a href="https://openf1.org/docs/" target="_blank" rel="noreferrer">历史记录来源：OpenF1 ↗</a> · <a href="./race-strategy-engine.js" target="_blank" rel="noreferrer">与研究院共用的计算模型 ↗</a></p></details><div class="observe-next panel"><div><span class="eyebrow">YOUR TURN</span><h3>如果由你来做决定呢？</h3><p>把同一位车手、同一圈带到研究院，改变条件再比较。</p></div><button class="button primary" id="observe-try">带着这个起点去研究院 ↗</button></div>`;
   story=mountPitStory(q('.pit-story'),{context,onChoose(){}});
   story.update({plan,settings,rows,chosen:'one',now,baseline:computed.baseline,sensitivity:sensitivity(context,settings,plan),alternative:null,referenceCaution});
   q('.story-boundary').textContent='这是教学推演：轮胎收益逐圈累积，参数为假设。时间差不等于实际名次，也不代表车队当时的判断。';
   q('#observe-try').addEventListener('click',()=>research(input));
  }catch(error){if(disposed)return;q('#observe-status').textContent=error.message;q('#lesson-tyres').innerHTML=`<div class="panel observe-loading" role="status"><p>${esc(error.message)}</p><button type="button" class="button" id="observe-retry">重新读取</button></div>`;q('#observe-retry').addEventListener('click',loadLesson);}
  finally{loading=false;}
 }
 loadLesson();
 return ()=>{disposed=true;story?.dispose();};
}
