/* Contacts and objectives on the character sheet (an "agent" notebook):
   people you know and what you are working towards. Stored on the character in
   extra.contacts and extra.goals, so they are part of exports and backups. */
(function(global){
'use strict';
const doc=global.document;
const MAX=60,TEXT=200,NOTE=500;
const RELATIONS=[['friend','Друг','Friend'],['ally','Союзник','Ally'],['fixer','Фиксер','Fixer'],['employer','Работодатель','Employer'],['informant','Информатор','Informant'],['family','Семья','Family'],['lover','Любовь','Lover'],['rival','Соперник','Rival'],['enemy','Враг','Enemy'],['other','Другое','Other']];
const T={ru:{title:'КОНТАКТЫ И ЦЕЛИ',tag:'AGENT',contacts:'Контакты',noContacts:'Пока никого. Добавьте фиксера, друзей из жизненного пути или тех, кто вам должен.',addContact:'Добавить контакт',name:'Имя или позывной',who:'Кто это',whoPh:'Фиксер в Уотсоне',where:'Где найти',wherePh:'Бар «Afterlife», по вечерам',relation:'Отношение',notes:'Заметки',goals:'Цели и задания',noGoals:'Запишите, к чему стремится персонаж, и текущие заказы.',addGoal:'Добавить цель',goalPh:'Например: вернуть долг Ржавчине до пятницы',done:'Выполнено',remove:'Удалить',removeConfirm:'Удалить запись?',fromLife:'Взять из жизненного пути',lifeNone:'В жизненном пути нет друзей, врагов или любви, которых ещё нет в списке.',lifeAdded:'Добавлено из жизненного пути:',open:'активных',full:'Достигнут предел записей.'},
 en:{title:'CONTACTS & GOALS',tag:'AGENT',contacts:'Contacts',noContacts:'Nobody yet. Add your fixer, friends from your lifepath or people who owe you.',addContact:'Add contact',name:'Name or handle',who:'Who they are',whoPh:'Fixer in Watson',where:'Where to find them',wherePh:'Afterlife bar, evenings',relation:'Relation',notes:'Notes',goals:'Goals & jobs',noGoals:'Write down what your character is after and current jobs.',addGoal:'Add goal',goalPh:'E.g. pay back Rust before Friday',done:'Done',remove:'Remove',removeConfirm:'Remove this entry?',fromLife:'Take from lifepath',lifeNone:'No lifepath friends, enemies or lovers that are not already listed.',lifeAdded:'Added from lifepath:',open:'open',full:'Entry limit reached.'}};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>global.App?.lang?.()==='en'?'en':'ru';
const t=k=>T[lang()][k];
const uid=()=>global.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';

// Read defensively: data may come from an edited backup or an older version.
function contacts(c){const list=Array.isArray(c?.extra?.contacts)?c.extra.contacts:[];return list.filter(x=>x&&typeof x==='object'&&typeof x.id==='string').slice(0,MAX)}
function goals(c){const list=Array.isArray(c?.extra?.goals)?c.extra.goals:[];return list.filter(x=>x&&typeof x==='object'&&typeof x.id==='string').slice(0,MAX)}
function ensure(c,key){c.extra=c.extra&&typeof c.extra==='object'&&!Array.isArray(c.extra)?c.extra:{};if(!Array.isArray(c.extra[key]))c.extra[key]=[];return c.extra[key]}

function contactRow(x){
 const ru=lang()==='ru';
 return `<div class="agent-contact" data-agent-id="${esc(x.id)}" data-relation="${esc(x.relation||'other')}"><div class="agent-contact-grid"><label class="field">${esc(t('name'))}<input data-agent-field="name" maxlength="${TEXT}" value="${esc(str(x.name,TEXT))}"></label><label class="field">${esc(t('relation'))}<select data-agent-field="relation">${RELATIONS.map(([id,r,e])=>`<option value="${id}" ${x.relation===id?'selected':''}>${esc(ru?r:e)}</option>`).join('')}</select></label><label class="field">${esc(t('who'))}<input data-agent-field="who" maxlength="${TEXT}" placeholder="${esc(t('whoPh'))}" value="${esc(str(x.who,TEXT))}"></label><label class="field">${esc(t('where'))}<input data-agent-field="where" maxlength="${TEXT}" placeholder="${esc(t('wherePh'))}" value="${esc(str(x.where,TEXT))}"></label></div><label class="field">${esc(t('notes'))}<textarea data-agent-field="notes" maxlength="${NOTE}" rows="2">${esc(str(x.notes,NOTE))}</textarea></label><button type="button" class="agent-remove" data-agent-action="remove-contact">✕ ${esc(t('remove'))}</button></div>`;
}
function goalRow(x){
 return `<div class="agent-goal ${x.done?'done':''}" data-agent-id="${esc(x.id)}"><input type="checkbox" data-agent-field="done" aria-label="${esc(t('done'))}" ${x.done?'checked':''}><input data-agent-field="text" maxlength="${TEXT}" placeholder="${esc(t('goalPh'))}" value="${esc(str(x.text,TEXT))}"><button type="button" class="agent-remove" data-agent-action="remove-goal" aria-label="${esc(t('remove'))}">✕</button></div>`;
}
function inner(c){
 const cs=contacts(c),gs=goals(c),open=gs.filter(g=>!g.done).length;
 return `<div class="card-heading"><span>${esc(t('title'))}</span><span>${esc(t('tag'))}</span></div><div class="agent-columns"><div><h3 class="agent-h">${esc(t('goals'))} <small>${open} ${esc(t('open'))}</small></h3>${gs.length?`<div class="agent-goals">${gs.map(goalRow).join('')}</div>`:`<p class="agent-empty">${esc(t('noGoals'))}</p>`}<button type="button" class="btn ghost" data-agent-action="add-goal">＋ ${esc(t('addGoal'))}</button></div><div><h3 class="agent-h">${esc(t('contacts'))} <small>${cs.length}</small></h3>${cs.length?`<div class="agent-contacts">${cs.map(contactRow).join('')}</div>`:`<p class="agent-empty">${esc(t('noContacts'))}</p>`}<div class="agent-buttons"><button type="button" class="btn ghost" data-agent-action="add-contact">＋ ${esc(t('addContact'))}</button><button type="button" class="btn ghost" data-agent-action="from-life">⌁ ${esc(t('fromLife'))}</button></div></div></div>`;
}
function render(c){return `<section class="card agent-card" id="sheet-agent" tabindex="-1">${inner(c)}</section>`}
function repaint(c,focusSel){const el=doc.querySelector('#sheet-agent');if(el){el.innerHTML=inner(c);if(focusSel)el.querySelector(focusSel)?.focus()}}

// Lifepath people, read from the generated lifepath record if present.
function lifePeople(c){
 const life=c?.extra?.life,out=[];if(!life||typeof life!=='object')return out;
 const pick=(list,relation)=>{if(!Array.isArray(list))return;for(const p of list){const name=typeof p==='string'?p:(p?.name||p?.who||p?.relationship||p?.description);if(typeof name==='string'&&name.trim())out.push({name:name.trim().slice(0,TEXT),relation,notes:typeof p==='object'?str([p.detail,p.what,p.cause,p.reason,p.feeling,p.tragedy].filter(x=>typeof x==='string').join(' · '),NOTE):''})}};
 pick(life.friends,'friend');pick(life.enemies,'enemy');pick(life.lovers||life.loveAffairs||life.romance,'lover');
 return out;
}

doc.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-agent-action]');if(!b)return;
 const c=global.App?.active?.();if(!c)return;
 const a=b.dataset.agentAction,id=b.closest('[data-agent-id]')?.dataset.agentId;
 if(a==='add-contact'){const list=ensure(c,'contacts');if(list.length>=MAX){global.App.notify(t('full'));return}const x={id:uid(),name:'',who:'',where:'',relation:'fixer',notes:''};list.push(x);global.App.save();repaint(c,`[data-agent-id="${x.id}"] [data-agent-field="name"]`)}
 else if(a==='add-goal'){const list=ensure(c,'goals');if(list.length>=MAX){global.App.notify(t('full'));return}const x={id:uid(),text:'',done:false};list.push(x);global.App.save();repaint(c,`[data-agent-id="${x.id}"] [data-agent-field="text"]`)}
 else if(a==='remove-contact'||a==='remove-goal'){if(!global.confirm(t('removeConfirm')))return;const key=a==='remove-contact'?'contacts':'goals';c.extra[key]=ensure(c,key).filter(x=>x?.id!==id);global.App.save();repaint(c)}
 else if(a==='from-life'){
  const list=ensure(c,'contacts'),known=new Set(list.map(x=>String(x.name||'').toLowerCase())),fresh=lifePeople(c).filter(p=>!known.has(p.name.toLowerCase())).slice(0,MAX-list.length);
  if(!fresh.length){global.App.notify(t('lifeNone'));return}
  for(const p of fresh)list.push({id:uid(),name:p.name,who:'',where:'',relation:p.relation,notes:p.notes});
  global.App.save();repaint(c);global.App.notify(`${t('lifeAdded')} ${fresh.map(p=>p.name).join(', ')}`);
 }
});
// Text is saved on change (blur) so typing is never interrupted by a repaint.
doc.addEventListener('change',e=>{
 const f=e.target.closest?.('[data-agent-field]');if(!f)return;
 const c=global.App?.active?.();if(!c)return;
 const row=f.closest('[data-agent-id]'),id=row?.dataset.agentId,field=f.dataset.agentField;
 const list=row?.classList.contains('agent-goal')?ensure(c,'goals'):ensure(c,'contacts'),x=list.find(y=>y?.id===id);if(!x)return;
 if(field==='done'){x.done=f.checked;row.classList.toggle('done',f.checked)}
 else if(field==='relation'){x.relation=RELATIONS.some(r=>r[0]===f.value)?f.value:'other';row.dataset.relation=x.relation}
 else if(['name','who','where','text'].includes(field))x[field]=str(f.value,TEXT);
 else if(field==='notes')x.notes=str(f.value,NOTE);
 else return;
 global.App.save();
});
global.AgentNotes={render,contacts,goals};
})(window);
