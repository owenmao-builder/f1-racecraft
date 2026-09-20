import {analyse} from './analysis-engine.js?v=13.0';
import {scenarioTyres,strategyContext,comparePitStrategies,evaluatePlan,sensitivity} from './race-strategy-engine.js?v=8.4';
import {mountPitStory} from './pit-story.js?v=12.0';
const names={SOFT:'软胎',MEDIUM:'中性胎',HARD:'硬胎'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountObservatory(host,{race,selection,moment,research}){
 let disposed=false,story=null,lesson='tyres',loading=false;
 const q=s=>host.querySelector(s);
 host.innerHTML=`<div class="observe-brief"><div><span class="eyebrow lime">THE STRATEGIST'S NOTEBOOK</span><h2>先看懂，再做决定。</h2><p>一次只讲一个问题。沿着时间账本，听懂策略师在权衡什么。</p></div></div>
 <div class="observe-lessons" role="group" aria-label="策略知识课堂">
 ${[['tyres','01','换胎的时间账','为什么先掉时间，最后反而更快？'],['window','02','进站窗口与交通','同一套轮胎，为什么早一圈就不同？'],['decision','03','如何判断好策略','结果不好，就一定是策略错了吗？']].map(([id,n,title,sub])=>`<button type="button" data-lesson="${id}" aria-controls="lesson-${id}" aria-pressed="${id===lesson}"><b>${n}</b><span><strong>${title}</strong><small>${sub}</small></span></button>`).join('')}
 </div>
 <section id="lesson-tyres" aria-label="换胎的时间账"><div class="observe-loading panel" role="status">正在准备本场的轮胎教学案例…</div></section>
 <section id="lesson-window" class="panel observe-lesson" aria-label="进站窗口与交通" hidden><span class="eyebrow lime">KNOW-HOW / 把赛道位置放回策略里</span><h2>换胎快不快，还要看“在哪儿换”。</h2><p class="lesson-lead">策略师会把三个位置连起来看：现在到入口的距离、维修区里的耗时，以及出来后前面有没有车。</p>
 <div class="window-flow"><div><b>01 / 入口前</b><strong>机会能不能抓住</strong><p>已经经过入口，就不能回头进站。临时中断发生的时刻，也会改变可执行的选择。</p></div><span aria-hidden="true">→</span><div><b>02 / 维修区</b><strong>这一停要付多少</strong><p>看完整的进出站损失。场上降速时，进站的相对代价可能降低；窗口持续多久仍然未知。</p></div><span aria-hidden="true">→</span><div><b>03 / 回到赛道</b><strong>新胎能不能发挥</strong><p>新胎需要升温，前车也可能挡住节奏。纸面上的速度优势，未必立刻变成可用时间。</p></div></div>
 <div class="coach-takeaway"><span>策略师划重点</span><strong>算省下几秒之前，先问：能执行吗？出来后能跑起来吗？</strong></div>
 <details class="analysis-details"><summary>结合 ${esc(race.short)}站，看看当时有哪些限制</summary><h3>${esc(moment.title)}</h3><p><b>公开赛事实据：</b>${esc(moment.fact)}</p><p><b>可以讨论的取舍：</b>${esc(moment.why)}</p><p><a href="${esc(race.report)}" target="_blank" rel="noreferrer">本场官方报道 ↗</a> · 解读不等于车队内部决策记录；这段赛例也不一定是进站事件。</p></details>
 <div class="observe-next"><span>理解窗口以后，试试改变进站损失和回场交通。</span><button class="button primary" data-view="strategy-research">去研究院设定条件 ↗</button></div></section>
 <section id="lesson-decision" class="panel observe-lesson" aria-label="如何判断好策略" hidden><span class="eyebrow lime">KNOW-HOW / 用决策时刻的视角复盘</span><h2>先评价判断，再评价结果。</h2><p class="lesson-lead">一次策略有可能判断合理、结果却不理想。复盘时，先把之后才知道的事情拿开。</p>
 <div class="decision-checks"><article><b>01</b><h3>当时知道什么？</h3><p>轮胎、距离、此前圈速与已发生的旗况。不要提前使用后面的安全车、退赛或圈速。</p></article><article><b>02</b><h3>有哪些可执行选择？</h3><p>是否赶得上入口？有哪种可用轮胎？剩余圈数够不够追回进站成本？</p></article><article><b>03</b><h3>结论有多依赖假设？</h3><p>把耗胎、交通或进站损失改一点，再看顺序会不会翻转。只在一组参数里更快，还不够稳。</p></article></div>
 <div class="coach-takeaway"><span>记住这一句</span><strong>好的复盘，要说清依据、取舍，以及哪些信息还不知道。</strong></div>
 <div class="observe-next"><span>现在把策略师的位置交给你。</span><button class="button primary" data-view="strategy-research">我来做一次判断 ↗</button></div></section>`;
 host.querySelectorAll('[data-lesson]').forEach(button=>button.addEventListener('click',()=>{
  lesson=button.dataset.lesson;
  host.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lesson===lesson)));
  for(const id of ['tyres','window','decision'])q('#lesson-'+id).hidden=id!==lesson;
 }));
 async function loadLesson(){
  if(loading)return;loading=true;
  try{
   const response=await fetch(`./data/${race.id}.json`);if(!response.ok)throw Error('本场数据暂时无法读取。');
   const data=await response.json();if(disposed)return;
   const lap=selection?.lap??Math.min(32,Math.max(2,Math.round(race.laps*.45)));
   const candidates=data.drivers.filter(d=>!selection||d.name_acronym===selection.driver).sort((a,b)=>(b.name_acronym==='RUS')-(a.name_acronym==='RUS'));
   let context,input;
   for(const driver of candidates){
    const opponent=data.drivers.find(d=>selection?d.name_acronym===selection.opponent:d.name_acronym!==driver.name_acronym);if(!opponent)continue;
    const candidate={race:race.id,driver:driver.name_acronym,opponent:opponent.name_acronym,lap,corner:selection?.corner??3};
    try{const c=strategyContext(data,analyse(data,candidate),race);if(!c.error){context=c;input=candidate;break;}}catch{}
   }
   if(!context)throw Error('这一赛点没有适用的干胎教学样本。上方公开证据仍可查看，也可以换车手或圈次重新分析。');
   // Use the same engineering assumptions as the research room, without exposing its controls here.
   const settings={target:'AUTO',delay:Math.min(5,context.remaining-2),pitLoss:21.5,currentPitLoss:13,flag:'green',warmup:1,trafficLoss:0,twoCompounds:!context.pastWet,tyres:scenarioTyres(),inventory:{SOFT:2,MEDIUM:2,HARD:2}};
   const computed=comparePitStrategies(context,settings),plan=computed.one||computed.best||computed.baseline;
   const rows=[['one','一停教学方案',plan]],now=plan.stops.length===1?evaluatePlan(context,settings,[{after:1,compound:plan.stops[0].compound}]):computed.now;
   const oldAge=context.age+context.remaining;
   const referenceCaution=!computed.baseline.compatible||oldAge>settings.tyres[context.compound].knee+15?`对照中的“不再换胎”会用到 ${oldAge} 圈胎龄${!computed.baseline.compatible?'，也未满足两配方假设':''}，只作理论账本参照，不能理解为实际比赛收益。`:'';
   q('#lesson-tyres').innerHTML=`<div class="observe-context"><span class="chip lime">${esc(race.short)}站 · ${context.driver} L${context.lap}</span><span>${names[context.compound]} / 已用 ${context.age} 圈</span><span>剩余 ${context.remaining} 圈</span><span class="chip orange">历史起点 + 教学假设</span></div><section class="pit-story guided-story" aria-label="策略师换胎讲解"></section><details class="analysis-details panel"><summary>这堂课采用什么条件？</summary><p>胎龄与配方来自本场公开历史记录。教学固定使用中等耗胎工程情景、绿旗进站损失 21.5 秒、每次升温 1 秒、额外交通 0 秒与各两套新胎，展示候选中时间代价最低的一停方案；它不一定优于零停或两停。这些参数未对本场拟合，不代表实际最佳策略或车队判断。目标弯号仅为待研究标签，尚未定位到弯心。</p><p><a href="https://openf1.org/docs/" target="_blank" rel="noreferrer">历史记录来源：OpenF1 ↗</a> · <a href="./race-strategy-engine.js" target="_blank" rel="noreferrer">与研究院共用的计算模型 ↗</a></p></details><div class="observe-next panel"><div><span class="eyebrow">YOUR TURN</span><h3>如果由你来做决定呢？</h3><p>把同一位车手、同一圈带到研究院，改变条件再比较。</p></div><button class="button primary" id="observe-try">带着这个起点去研究院 ↗</button></div>`;
   story=mountPitStory(q('.pit-story'),{context,onChoose(){}});
   story.update({plan,settings,rows,chosen:'one',now,baseline:computed.baseline,sensitivity:sensitivity(context,settings,plan),alternative:null,referenceCaution});
   q('.story-boundary').textContent='这是教学推演：轮胎收益逐圈累积，参数为假设。时间差不等于实际名次，也不代表车队当时的判断。';
   q('#observe-try').addEventListener('click',()=>research(input));
  }catch(error){if(disposed)return;q('#lesson-tyres').innerHTML=`<div class="panel observe-loading" role="status"><p>${esc(error.message)}</p><button type="button" class="button" id="observe-retry">重新读取</button></div>`;q('#observe-retry').addEventListener('click',loadLesson);}
  finally{loading=false;}
 }
 loadLesson();
 return ()=>{disposed=true;story?.dispose();};
}
