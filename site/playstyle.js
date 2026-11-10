/* Playstyle quiz (Corebook p. 409): the player marks the five things that matter most in play;
   the style with the most marks is the primary one, the next the secondary. The GM uses them
   to pick the column of the session award (pp. 410–411). The four styles and the count of five
   are the book's; the statements are in our own words. Stored as extra.playstyle = {version, picks}. */
(function(global){
'use strict';
const doc=global.document,MAX=5;
const STYLES=[
 ['warrior','Воин','Warrior',[['Победить врага в бою','Beat an enemy in a fight'],['Добыть мощное оружие или инструмент','Get a powerful weapon or tool'],['Показать мастерство в бою','Show your skill in a fight'],['Азарт охоты','The thrill of the hunt'],['Собрать самого сильного персонажа','Build the strongest character'],['Обзавестись крепостью','Set up a stronghold'],['Иметь заклятого врага','Have a nemesis to beat']]],
 ['socializer','Душа компании','Socializer',[['Вспоминать любимые моменты игр','Look back on favorite game moments'],['Рассказывать другим о своих играх','Tell other people about your games'],['Помочь успеху группы','Help the group succeed'],['Вместе справиться с испытанием','Team up to beat a challenge'],['Найти друзей за пределами игры','Make friends outside the game'],['Быть частью компании','Be part of the group']]],
 ['explorer','Исследователь','Explorer',[['Найти новое место на карте','Find a new place on the map'],['Познакомиться с кем-то новым','Meet someone new in the world'],['Решить трудную загадку','Solve a hard puzzle'],['Узнать больше о мире и его истории','Learn about the world and its lore'],['Основать место или союз','Found a place or an alliance'],['Оставить след в истории мира','Add to the history of the world']]],
 ['roleplayer','Актёр','Roleplayer',[['Иметь портрет персонажа','Have a picture of your character'],['Написать предысторию персонажа','Write your character’s background'],['Придумать персонажу родню','Invent a wider family for your character'],['Знать его питомцев, любимые вещи, друзей и врагов','Know their pets, favorite things, friends and enemies'],['Отыгрывать акцент и манеры','Act out the accent and mannerisms']]],
];
const KEYS=new Set(STYLES.flatMap(([id,,,list])=>list.map((_,i)=>id+':'+i)));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function picks(c){const p=c?.extra?.playstyle,out=[];if(!p||typeof p!=='object'||p.version!==1||!Array.isArray(p.picks))return out;for(const k of p.picks){if(typeof k==='string'&&KEYS.has(k)&&!out.includes(k))out.push(k);if(out.length>=MAX)break}return out}
// {primary, secondary, counts, tie}: styles ranked by marks; null until at least one mark. `tie` when the first two are level.
function result(c){
 const list=picks(c),counts=Object.fromEntries(STYLES.map(s=>[s[0],0]));for(const k of list)counts[k.split(':')[0]]++;
 const ranked=STYLES.map(s=>s[0]).filter(id=>counts[id]>0).sort((a,b)=>counts[b]-counts[a]);
 return {picks:list,counts,primary:ranked[0]||null,secondary:ranked[1]||null,tie:ranked.length>1&&counts[ranked[0]]===counts[ranked[1]],done:list.length===MAX};
}
const nameOf=(id,lang)=>{const s=STYLES.find(x=>x[0]===id);return s?s[lang==='en'?2:1]:''};
function summary(c,lang){
 const ru=lang!=='en',r=result(c);
 if(!r.picks.length)return ru?'Отметьте пять вещей, которые для вас важнее всего в игре.':'Mark the five things that matter most to you in play.';
 const head=ru?`Отмечено ${r.picks.length} из ${MAX}.`:`Marked ${r.picks.length} of ${MAX}.`;
 if(!r.done)return head;
 const first=`${nameOf(r.primary,lang)} (${r.counts[r.primary]})`,second=r.secondary?`${nameOf(r.secondary,lang)} (${r.counts[r.secondary]})`:(ru?'нет':'none');
 return `${head} ${ru?'Основной стиль':'Primary style'}: ${first}. ${ru?'Вторичный':'Secondary'}: ${second}.${r.tie?(ru?' Первые два набрали поровну: какой из них основной, решите с ведущим.':' The first two are level: decide with your GM which is primary.'):''}`;
}
function render(c,lang){
 const l=lang==='en'?'en':'ru',ru=l==='ru',chosen=new Set(picks(c)),full=chosen.size>=MAX;
 return `<details class="playstyle" data-playstyle-root><summary>${ru?'ТЕСТ СТИЛЯ ИГРЫ':'PLAYSTYLE QUIZ'}</summary><p class="cx-help">${ru?'Выберите пять самых важных для вас вещей. Стиль с наибольшим числом отметок — основной, следующий — вторичный; по ним ведущий выбирает колонку награды за сессию.':'Choose the five things that matter most to you. The style with the most marks is your primary one, the next your secondary; the GM uses them to pick the column of the session award.'} <button type="button" class="rule-source" data-action="book-page" data-page="409">${ru?'Книга, стр.':'Book, p.'} 409 ↗</button></p><div class="playstyle-grid">${STYLES.map(([id,r,e,list])=>`<fieldset class="playstyle-box"><legend>${esc(ru?r:e)}</legend>${list.map((pair,i)=>{const key=id+':'+i,on=chosen.has(key);return `<label><input type="checkbox" data-playstyle-pick="${key}"${on?' checked':''}${!on&&full?' disabled':''}> ${esc(pair[ru?0:1])}</label>`}).join('')}</fieldset>`).join('')}</div><p class="playstyle-result" data-playstyle-result role="status">${esc(summary(c,l))}</p></details>`;
}
function onChange(e){
 const box=e.target?.closest?.('[data-playstyle-pick]');if(!box)return;
 const root=box.closest('[data-playstyle-root]'),c=global.App?.active?.();if(!root||!c)return;
 const key=box.dataset.playstylePick,list=picks(c);if(!KEYS.has(key))return;
 if(box.checked){if(list.length>=MAX){box.checked=false;return}if(!list.includes(key))list.push(key)}else{const i=list.indexOf(key);if(i>=0)list.splice(i,1)}
 if(!c.extra||typeof c.extra!=='object')c.extra={};
 c.extra.playstyle={version:1,picks:list};
 try{global.App.save()}catch{}
 const lang=doc.documentElement.lang==='en'?'en':'ru',full=list.length>=MAX;
 for(const b of root.querySelectorAll('[data-playstyle-pick]'))b.disabled=!b.checked&&full;
 const out=root.querySelector('[data-playstyle-result]');if(out)out.textContent=summary(c,lang);
 // The session award next to it starts from the primary style.
 const award=doc.querySelector('.sheet-layout [data-cx-award="style"]'),r=result(c);if(award&&r.done&&r.primary)award.value=r.primary;
}
doc?.addEventListener?.('change',onChange);
global.Playstyle={STYLES,MAX,picks,result,summary,render,nameOf};
})(window);
