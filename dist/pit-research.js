import {analyseDriver} from './analysis-engine.js?v=13.0';
import {mountPitAnalysis} from './pit-analysis.js?v=13.0';

const cache=new Map();
let revision=0,dispose=()=>{},preferences={driver:'RUS',lap:32},selected=null;
export function pitResearchSelection(){return selected;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function mountPitResearch(host,{race,races,selection,changeRace}){
 const version=++revision;dispose();
 if(selection)preferences={driver:selection.driver,lap:selection.lap};
 selected={race:race.id,driver:preferences.driver,lap:Math.min(preferences.lap,race.laps)};
 const q=s=>host.querySelector(s);
 host.innerHTML=`<form id="research-form" class="panel custom-query"><div class="research-query-grid">
 <label>比赛<select id="research-race">${races.map(r=>`<option value="${r.id}" ${r.id===race.id?'selected':''}>${r.short} · ${r.date}</option>`).join('')}</select></label>
 <label>分析车手<select id="research-driver" disabled><option>载入参赛名单…</option></select></label>
 <label>从第几圈开始<input id="research-lap" type="number" min="1" max="${race.laps}" step="1" value="${Math.min(preferences.lap,race.laps)}" required></label>
 </div><div class="query-bottom"><p>选一位车手，比较不同换胎方案到终点的时间成本。</p><button id="research-submit" type="submit" class="button primary" disabled>分析换胎策略 ↗</button></div>
 <p class="query-scope">配方与胎龄取自该车手的起圈记录。耗胎、进站损失与交通为可调整的假设。</p><p id="research-status" role="status">正在读取本场轮胎与圈次记录…</p></form>
 <div id="research-result" hidden></div>`;
 q('#research-race').addEventListener('change',e=>changeRace(e.target.value));
 function invalidate(){dispose();q('#research-result').hidden=true;q('#research-status').textContent='条件已修改，请重新分析换胎策略。';}
 for(const id of ['research-driver','research-lap'])q('#'+id).addEventListener('input',invalidate);
 function run(){
  if(!q('#research-form').reportValidity())return;
  dispose();q('#research-result').hidden=true;
  preferences={driver:q('#research-driver').value,lap:Number(q('#research-lap').value)};selected={race:race.id,...preferences};
  try{
   const data=cache.get(race.id),evidence=analyseDriver(data,preferences);
   q('#research-result').innerHTML=`<section id="pit-analysis" class="pit-analysis panel" aria-label="单车换胎策略推演"></section>
   <details class="analysis-details panel"><summary>这位车手的历史记录与数据出处</summary><p>${esc(evidence.first.driver.full_name)} · ${esc(evidence.first.driver.team_name)}。证据时间为第 ${preferences.lap} 圈起点，${new Date(Date.parse(data.session.date_start)+evidence.time*1000).toISOString().slice(11,23)} UTC。胎龄为轮胎段开始时已跑圈数 + 当前圈号 − 轮胎段起始圈。</p><p>OpenF1 历史快照 · 获取于 ${esc(data.retrievedAt.slice(0,10))}。模拟参数未对本场拟合，时间差不代表实际名次。</p><div class="evidence-links">${data.sources.filter(s=>['drivers','laps','stints'].includes(s.endpoint)).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.endpoint)} 原始记录 ↗</a>`).join('')}</div></details>`;
   dispose=mountPitAnalysis(q('#pit-analysis'),{data,evidence,race,showStory:false})||(()=>{});
   q('#research-result').hidden=false;
   q('#research-status').textContent=`已读取 ${race.short}站 · ${preferences.driver} 第 ${preferences.lap} 圈的记录。下方比较该车手的换胎方案。`;
  }catch(error){q('#research-status').textContent=error.message;}
 }
 q('#research-form').addEventListener('submit',e=>{e.preventDefault();run();});
 try{
  let data=cache.get(race.id);
  if(!data){const response=await fetch(`./data/${race.id}.json`);if(!response.ok)throw Error('本场数据暂时无法读取，请重试。');data=await response.json();if(data.schema!==1||!Array.isArray(data.laps))throw Error('本场数据格式暂不支持。');cache.set(race.id,data);}
  if(version!==revision)return;
  q('#research-driver').innerHTML=data.drivers.map(d=>`<option value="${esc(d.name_acronym)}">${esc(d.name_acronym)} · ${esc(d.full_name)}</option>`).join('');
  if(data.drivers.some(d=>d.name_acronym===preferences.driver))q('#research-driver').value=preferences.driver;
  q('#research-driver').disabled=false;q('#research-submit').disabled=false;run();
 }catch(error){if(version!==revision)return;q('#research-status').textContent=error.message;q('#research-submit').textContent='重新载入';q('#research-submit').type='button';q('#research-submit').disabled=false;q('#research-submit').onclick=()=>mountPitResearch(host,{race,races,selection,changeRace});}
}
