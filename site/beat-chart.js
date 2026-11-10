/* Beat Chart planner for a campaign (Corebook pp. 395–407). A scenario is a chain of Beats:
   a Hook, then Developments and Cliffhangers in turn, a Climax and a Resolution. The planner
   keeps the chain in campaign.beats, checks the order rules and links every Beat to its page.
   Only the names and page numbers of the book's Beats are listed; the scenes are the GM's own. */
(function(){
'use strict';
const MAX=40,MAX_NOTE=300;
const KINDS={
 hook:{ru:'Завязка',en:'Hook',page:397},
 dev:{ru:'Развитие',en:'Development',page:402},
 cliff:{ru:'Клиффхэнгер',en:'Cliffhanger',page:399},
 climax:{ru:'Кульминация',en:'Climax',page:406},
 res:{ru:'Развязка',en:'Resolution',page:406},
};
// [id, RU, EN, page]
const TYPES={
 hook:[['coronet','Провал в памяти','Coronet Blue',397],['crisis','Кризис','Crisis',397],['discovery','Находка','Discovery',398],['accused','Ложное обвинение','False Accusation',398],['murder','Убийство','Murder',398],['kidnapped','Похищение','Kidnapped',398],['looming','Надвигающаяся угроза','Looming Threat',398],['hook-cliff','Начать с клиффхэнгера','Play a Cliffhanger',398],['hook-dev','Начать с развития','Play a Development',398],['hook-revelation','Откровение','Revelation',399]],
 cliff:[['ambush','Засада','Ambush',399],['battle','Битва','Battle',399],['chase','Погоня','Chase',400],['confrontation','Противостояние','Confrontation',400],['contest','Состязание','Contest',400],['dogfight','Бой на технике','Dogfight',400],['duel','Дуэль','Duel',400],['fist','Драка','Fist Fight',400],['monster','Чудовище','Monster',401],['obstacles','Препятствия','Obstacles',401],['pursuit','Преследование','Pursuit',401],['race','Гонка','Race',401],['skirmish','Стычка','Skirmish!',402]],
 dev:[['advantage','Раскрытое преимущество','Advantage Revealed',402],['alliance','Союз','Alliance',402],['back','Возвращение из мёртвых','Back from the Dead',402],['betrayal','Предательство','Betrayal',402],['clue','Улика','Clue',402],['foreshadowing','Предзнаменование','Foreshadowing',403],['framed','Подстава','Framed!',403],['mastery','Обучение','Gain Mastery',403],['quest','Опасный поход','Hazardous Quest',403],['hesitation','Колебание','Hesitation',404],['lie','Раскрытая ложь','Lie Revealed',404],['identity','Ошибочное опознание','Mistaken Identity',404],['monologue','Монолог','Monologue',404],['seems','Не то, чем кажется','Not What it Seems',404],['obsession','Одержимость','Obsession',404],['stake','Личный интерес','Personal Stake',404],['puzzle','Загадка','Puzzle',404],['rescuers','Спасители','Rescuers!',405],['retreat','Отступление','Retreat',405],['weakness','Раскрытая слабость','Revealed Weakness',405],['revelation','Откровение','Revelation',405],['romance','Роман','Romance',405],['sabotage','Саботаж','Sabotage!',405],['second','Второй шанс','Second Chance',405],['meeting','Тайная встреча','Secret Meeting',405],['bedfellows','Странные союзники','Strange Bedfellows',406],['turnabout','Перемена ролей','Turnabout!',406],['vengeance','Месть','Vengeance!',406],['warning','Предупреждение','Warning',406]],
 climax:[['final-battle','Финальная битва','Final Battle',406],['final-revelation','Финальное откровение','Final Revelation',406],['final-act','Финальный акт','Final Act',406]],
 res:[['escapes','Антагонист уходит','Antagonist Escapes',407],['killed','Антагонист убит','Antagonist is Killed',407],['toppled','Антагонист повержен','Antagonist Toppled',407],['captured','Эджраннеры схвачены','Edgerunners Captured',407],['escape','Эджраннеры уходят','Edgerunners Escape',407],['ending-cliff','Финал на клиффхэнгере','Ending Cliffhanger',407],['greater','Большая угроза','Greater Threat',407],['happy','Счастливый конец','Happy Ending',407],['pyrrhic','Пиррова победа','Pyrrhic Victory',407]],
};
const T={
 ru:{title:'ПЛАН СЦЕНАРИЯ',help:'Сценарий — цепочка битов: завязка, затем развитие и клиффхэнгер по очереди, кульминация и развязка. Один бит — примерно полчаса игры.',hours:'Часов игры',build:'Собрать схему',buildConfirm:'Заменить текущий план новой схемой?',add:'Добавить бит',kind:'Бит',type:'Вариант из книги',own:'свой вариант',note:'Что происходит',notePh:'Сцена своими словами',done:'Сыграно',up:'Выше',down:'Ниже',remove:'Убрать',empty:'Плана пока нет. Укажите длительность и соберите схему или добавляйте биты по одному.',ok:'Порядок битов соответствует схеме.',time:(n,h)=>`Битов: ${n} · около ${h} ч игры`,page:'стр.',
  warnHook:'Начните с завязки.',warnEnd:'Закончите кульминацией и развязкой.',warnTwice:'Развитие и клиффхэнгер должны чередоваться: два одинаковых бита подряд.',warnMiddle:'Завязка, кульминация и развязка стоят по краям, а не в середине.'},
 en:{title:'SCENARIO PLAN',help:'A scenario is a chain of Beats: a Hook, then Developments and Cliffhangers in turn, a Climax and a Resolution. One Beat is about half an hour of play.',hours:'Hours of play',build:'Build the chart',buildConfirm:'Replace the current plan with a new chart?',add:'Add a Beat',kind:'Beat',type:'Option from the book',own:'your own',note:'What happens',notePh:'The scene in your own words',done:'Played',up:'Up',down:'Down',remove:'Remove',empty:'No plan yet. Set the length and build the chart, or add Beats one by one.',ok:'The order of Beats follows the chart.',time:(n,h)=>`Beats: ${n} · about ${h} h of play`,page:'p.',
  warnHook:'Start with a Hook.',warnEnd:'End with a Climax and a Resolution.',warnTwice:'Developments and Cliffhangers must alternate: two of the same in a row.',warnMiddle:'The Hook, Climax and Resolution belong at the ends, not in the middle.'},
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const typeOf=(kind,id)=>(TYPES[kind]||[]).find(x=>x[0]===id)||null;
function clean(b){
 if(!b||typeof b!=='object'||Array.isArray(b)||!KINDS[b.kind])return null;
 return {id:typeof b.id==='string'&&b.id&&b.id.length<=160?b.id:uid(),kind:b.kind,type:typeOf(b.kind,b.type)?b.type:'',note:typeof b.note==='string'?b.note.replace(/\u0000/g,'').slice(0,MAX_NOTE):'',done:b.done===true};
}
function read(campaign){const out=[];for(const b of Array.isArray(campaign?.beats)?campaign.beats:[]){const c=clean(b);if(c)out.push(c);if(out.length>=MAX)break}return out}
// A chart for a session of the given length: the Hook, Climax and Resolution take an hour and a half, the rest alternates.
function build(hours,firstMiddle='dev'){
 const h=Math.max(2,Math.min(12,Number(hours)||4)),middle=Math.max(1,Math.round(h*2)-3),out=[{kind:'hook'}];
 for(let i=0;i<middle;i++)out.push({kind:(i%2===0)===(firstMiddle==='dev')?'dev':'cliff'});
 out.push({kind:'climax'},{kind:'res'});
 return out.map(b=>({id:uid(),kind:b.kind,type:'',note:'',done:false}));
}
// Order rules of the chart, as [code, index] pairs.
function check(beats){
 const issues=[],n=beats.length;if(!n)return issues;
 if(beats[0].kind!=='hook')issues.push(['warnHook',0]);
 if(!(n>=2&&beats[n-2].kind==='climax'&&beats[n-1].kind==='res'))issues.push(['warnEnd',n-1]);
 for(let i=1;i<n;i++){const a=beats[i-1].kind,b=beats[i].kind;if(a===b&&(a==='dev'||a==='cliff'))issues.push(['warnTwice',i])}
 for(let i=0;i<n;i++){const k=beats[i].kind;if((k==='hook'&&i>0)||(k==='climax'&&i<n-2)||(k==='res'&&i<n-1))issues.push(['warnMiddle',i])}
 return issues;
}
function render(campaign,lang){
 const l=lang==='en'?'en':'ru',t=T[l],beats=read(campaign),issues=check(beats),flagged=new Set(issues.map(x=>x[1])),codes=[...new Set(issues.map(x=>x[0]))];
 const row=(b,i)=>{const info=typeOf(b.kind,b.type),page=info?info[3]:KINDS[b.kind].page;
  return `<li class="beat beat-${b.kind}${b.done?' done':''}${flagged.has(i)?' flagged':''}" data-beat="${esc(b.id)}"><span class="beat-no">${i+1}</span><label class="field"><span class="beat-label">${esc(t.kind)}</span><select data-beat-field="kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}"${k===b.kind?' selected':''}>${esc(v[l])}</option>`).join('')}</select></label><label class="field"><span class="beat-label">${esc(t.type)}</span><select data-beat-field="type"><option value="">— ${esc(t.own)} —</option>${TYPES[b.kind].map(x=>`<option value="${x[0]}"${x[0]===b.type?' selected':''}>${esc(x[l==='ru'?1:2])} · ${t.page} ${x[3]}</option>`).join('')}</select></label><label class="field beat-note"><span class="beat-label">${esc(t.note)}</span><input data-beat-field="note" maxlength="${MAX_NOTE}" value="${esc(b.note)}" placeholder="${esc(t.notePh)}"></label><div class="beat-actions"><label class="beat-done"><input type="checkbox" data-beat-field="done"${b.done?' checked':''}> ${esc(t.done)}</label><button type="button" class="rule-source" data-action="book-page" data-page="${page}">${t.page} ${page} ↗</button><button type="button" class="btn ghost" data-beat-action="up" aria-label="${esc(t.up)}"${i?'':' disabled'}>↑</button><button type="button" class="btn ghost" data-beat-action="down" aria-label="${esc(t.down)}"${i<beats.length-1?'':' disabled'}>↓</button><button type="button" class="btn ghost" data-beat-action="remove" aria-label="${esc(t.remove)}">✕</button></div></li>`};
 return `<section class="card beat-chart" data-beat-root><div class="card-heading"><span>${esc(t.title)}</span><span data-page-ref>395–407</span></div><p class="muted">${esc(t.help)}</p><div class="beat-build"><label class="field">${esc(t.hours)}<input type="number" inputmode="numeric" min="2" max="12" step="1" value="4" data-beat-hours></label><button type="button" class="btn ghost" data-beat-action="build">${esc(t.build)}</button><button type="button" class="btn ghost" data-beat-action="add"${beats.length>=MAX?' disabled':''}>＋ ${esc(t.add)}</button></div>${beats.length?`<p class="beat-status ${codes.length?'warn':'good'}" role="status">${esc(t.time(beats.length,beats.length/2))}. ${codes.length?codes.map(c=>esc(t[c])).join(' '):esc(t.ok)}</p><ol class="beat-list">${beats.map(row).join('')}</ol>`:`<p class="muted">${esc(t.empty)}</p>`}</section>`;
}
const owns=e=>!!e?.target?.closest?.('[data-beat-root]');
// Returns {handled, dirty, rerender}. The caller saves and re-renders.
function handle(e,campaign,lang){
 const el=e?.target,root=el?.closest?.('[data-beat-root]');if(!root||!campaign)return {handled:false};
 const t=T[lang==='en'?'en':'ru'],beats=read(campaign),row=el.closest?.('[data-beat]'),index=row?beats.findIndex(b=>b.id===row.dataset.beat):-1;
 const commit=(rerender=true)=>{campaign.beats=beats;return {handled:true,dirty:true,rerender}};
 if(e.type==='click'){
  const b=el.closest?.('[data-beat-action]');if(!b)return {handled:false};
  const a=b.dataset.beatAction;
  if(a==='build'){if(beats.length&&typeof confirm==='function'&&!confirm(t.buildConfirm))return {handled:true};beats.length=0;beats.push(...build(root.querySelector?.('[data-beat-hours]')?.value));return commit()}
  if(a==='add'){if(beats.length>=MAX)return {handled:true};const last=beats[beats.length-1]?.kind,kind=!beats.length?'hook':last==='dev'?'cliff':'dev';beats.push({id:uid(),kind,type:'',note:'',done:false});return commit()}
  if(index<0)return {handled:true};
  if(a==='remove'){beats.splice(index,1);return commit()}
  if(a==='up'&&index>0){[beats[index-1],beats[index]]=[beats[index],beats[index-1]];return commit()}
  if(a==='down'&&index<beats.length-1){[beats[index+1],beats[index]]=[beats[index],beats[index+1]];return commit()}
  return {handled:true};
 }
 if(e.type==='input'||e.type==='change'){
  const f=el.dataset?.beatField;if(el.hasAttribute?.('data-beat-hours'))return {handled:true};if(!f||index<0)return {handled:!!f};
  const beat=beats[index];
  if(f==='note'){const v=String(el.value??'').slice(0,MAX_NOTE);if(v===beat.note)return {handled:true};beat.note=v;return commit(false)}
  if(e.type!=='change')return {handled:true};
  if(f==='kind'&&KINDS[el.value]){if(beat.kind!==el.value){beat.kind=el.value;beat.type=''}return commit()}
  if(f==='type'){beat.type=typeOf(beat.kind,el.value)?el.value:'';return commit()}
  if(f==='done'){beat.done=!!el.checked;return commit()}
  return {handled:true};
 }
 return {handled:false};
}
window.BeatChart={KINDS,TYPES,MAX,read,build,check,render,handle,owns};
})();
