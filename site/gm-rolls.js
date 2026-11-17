/* The Game Master's rolls: one door with an open / hidden choice.
   An open roll goes through Rolls.report (rolls.js): the history of rolls and, in a room, the feed everyone sees.
   A hidden roll is never sent anywhere: it stays in a short history of this browser (nc-gm-hidden-rolls, the last 50),
   which is not part of the saved app state, of backups or of the room. From that history the GM can still publish a
   result later with one press. The choice itself (nc-gm-roll-mode) is remembered per browser; the default is open,
   so the tools behave as before until the GM switches. Original UI text. */
(function(global){
'use strict';
const MODE_KEY='nc-gm-roll-mode',LOG_KEY='nc-gm-hidden-rolls',MAX=50;
let mode='open',log=[],loaded=false;
const int=v=>{const n=Number(v);return v!==null&&v!==''&&v!==undefined&&Number.isFinite(n)?Math.trunc(n):null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=l=>l==='en'||l==='ru'?l:(()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}})();
const T={
 ru:{mode:'Броски ведущего',open:'Открытые',hidden:'Скрытые',hint:'Открытый бросок попадает в историю и в ленту комнаты. Скрытый остаётся только у вас.',
  history:'Скрытые броски',empty:'Скрытых бросков пока нет.',clear:'Очистить',reveal:'Показать игрокам',revealed:'Бросок показан.',cleared:'Скрытые броски очищены.',undo:'Вернуть',
  revealFail:'Не удалось показать бросок.',saved:n=>`Скрытый бросок сохранён только у вас (всего: ${n})`,kept:'Эти броски хранятся только в этом браузере.',sentOpen:'Бросок открыт',sentHidden:'Бросок скрыт'},
 en:{mode:'GM rolls',open:'Open',hidden:'Hidden',hint:'An open roll goes to the history and to the room feed. A hidden one stays with you only.',
  history:'Hidden rolls',empty:'No hidden rolls yet.',clear:'Clear',reveal:'Show to players',revealed:'Roll shown.',cleared:'Hidden rolls cleared.',undo:'Undo',
  revealFail:'Could not show the roll.',saved:n=>`Hidden roll kept for you only (total: ${n})`,kept:'These rolls are kept in this browser only.',sentOpen:'Roll is open',sentHidden:'Roll is hidden'}
};
function store(){try{return global.localStorage||null}catch{return null}}
const cleanMode=v=>v==='hidden'?'hidden':'open';
function cleanFaces(f){
 if(!Array.isArray(f))return undefined;
 const out=[];for(const x of f){const v=int(x?.v),s=int(x?.s);if(v!==null&&s!==null&&s>=2&&s<=100&&v>=1&&v<=s)out.push({v,s});if(out.length>=12)break}
 return out.length?out:undefined;
}
function cleanEntry(e){
 if(!e||typeof e!=='object'||Array.isArray(e))return null;
 const label=typeof e.label==='string'?e.label.replace(/\s+/g,' ').trim().slice(0,140):'',total=int(e.total);
 if(!label||total===null)return null;
 const o={label,detail:String(e.detail??'').slice(0,320),total,at:int(e.at)||0},faces=cleanFaces(e.faces);if(faces)o.faces=faces;
 return o;
}
function cleanList(v){const out=[];for(const e of Array.isArray(v)?v:[]){const c=cleanEntry(e);if(c)out.push(c);if(out.length>=MAX)break}return out}
function pushEntry(list,e,max=MAX){const c=cleanEntry(e);return c?[c,...(Array.isArray(list)?list:[])].slice(0,Math.max(1,max)):(Array.isArray(list)?list:[])}
function load(){
 if(loaded)return;loaded=true;
 const s=store();if(!s)return;
 try{mode=cleanMode(s.getItem(MODE_KEY))}catch{}
 try{log=cleanList(JSON.parse(s.getItem(LOG_KEY)||'[]'))}catch{log=[]}
}
function save(){const s=store();if(!s)return;try{s.setItem(LOG_KEY,JSON.stringify(log))}catch{}}
function getMode(){load();return mode}
function setMode(v){load();mode=cleanMode(v);const s=store();if(s){try{s.setItem(MODE_KEY,mode)}catch{}}return mode}
function entries(){load();return log.map(x=>({...x}))}
function sendOpen(label,detail,total,faces){
 // Rolls.report already ends in App.report: a second call after a refusal could record the roll twice.
 if(typeof global.Rolls?.report==='function'){try{return global.Rolls.report(label,detail,total,faces)===true}catch{return false}}
 try{return global.App?.report?.(label,detail,total,faces)===true}catch{return false}
}
/* One roll. `faces` are [{v,s}] as in Rolls.report. opts.mode overrides the remembered choice for this roll only.
   Returns {mode, ok}: ok is false when the roll could not be recorded (nothing is lost silently). */
function emit(label,detail,total,faces,opts){
 load();
 const m=opts&&opts.mode?cleanMode(opts.mode):mode;
 if(m==='open'){const ok=sendOpen(label,detail,total,faces);redraw();return {mode:'open',ok}}
 const next=pushEntry(log,{label,detail,total,faces,at:Date.now()}),ok=next!==log;
 if(ok){log=next;save()}
 redraw();
 if(ok)say(T[lang()].saved(log.length));
 return {mode:'hidden',ok};
}
const dieTxt=(first,extra)=>`1d10 ${first}${extra?(first===10?' + ':' − ')+extra:''}`;
/* A d10 check or a sum of dice made by another tool (the combat tracker): same lines as Rolls.check / Rolls.sum, but
   through the open / hidden choice. In open mode the call goes to Rolls untouched. */
function check(label,r,lang){
 load();
 if(mode==='open')return global.Rolls?.check?global.Rolls.check(label,r,lang):false;
 const first=int(r?.die??r?.first??r?.one),extra=int(r?.extra)||0,total=int(r?.total);
 if(first===null||first<1||first>10||extra<0||extra>10||total===null)return false;
 const base=total-(first+(first===10?extra:first===1?-extra:0));
 return emit(label,`${dieTxt(first,extra)} ${base<0?'−':'+'} ${Math.abs(base)} = ${total}`,total,[{v:first,s:10},...(extra?[{v:extra,s:10}]:[])]).ok;
}
function sum(label,dice,sides,o){
 load();
 if(mode==='open')return global.Rolls?.sum?global.Rolls.sum(label,dice,sides,o):false;
 if(!Array.isArray(dice)||!dice.length||dice.length>40||dice.some(v=>int(v)===null||v<1||v>sides))return false;
 const add=int(o?.bonus)||0,all=int(o?.total)??dice.reduce((a,b)=>a+b,0)+add;
 return emit(label,`${dice.length}d${sides}: ${dice.join(' + ')}${add?(add<0?' − ':' + ')+Math.abs(add):''}${dice.length>1||add?' = '+all:''}`,all,dice.slice(0,12).map(v=>({v,s:sides}))).ok;
}
function reveal(index){
 load();const e=log[index];if(!e)return false;
 if(!sendOpen(e.label,e.detail,e.total,e.faces))return false;
 log=log.filter((_,i)=>i!==index);save();redraw();return true;
}
function clear(){load();const was=log;log=[];save();redraw();return was}
function restore(list){load();log=cleanList(list);save();redraw()}
// ---------- UI ----------
function toggleHTML(l){
 const L=lang(l),t=T[L],m=getMode();
 return `<fieldset class="gmr-mode" data-gmr-mode-root><legend>${esc(t.mode)}</legend><label class="gmr-opt"><input type="radio" name="gmr-mode" data-gmr-mode value="open"${m==='open'?' checked':''}><span>${esc(t.open)}</span></label><label class="gmr-opt"><input type="radio" name="gmr-mode" data-gmr-mode value="hidden"${m==='hidden'?' checked':''}><span>${esc(t.hidden)}</span></label><p class="gmr-hint">${esc(t.hint)}</p></fieldset>`;
}
function historyHTML(l){
 const L=lang(l),t=T[L];load();
 const rows=log.map((e,i)=>`<li class="gmr-row"><div><strong>${esc(e.label)}</strong><small>${esc(e.detail)}</small></div><b>${esc(e.total)}</b><button type="button" class="btn ghost" data-gmr-reveal="${i}" aria-label="${esc(t.reveal+': '+e.label)}">${esc(t.reveal)}</button></li>`).join('');
 return `<details class="gmr-history" data-gmr-history${log.length?'':' data-gmr-empty'}><summary>${esc(t.history)} · ${log.length}</summary>${log.length?`<ul class="gmr-list">${rows}</ul><div class="gmr-actions"><button type="button" class="btn ghost" data-gmr-clear>${esc(t.clear)}</button></div>`:`<p class="gmr-hint">${esc(t.empty)}</p>`}<p class="gmr-hint">${esc(t.kept)}</p></details>`;
}
function redraw(){
 if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return;
 try{
  const open=[...document.querySelectorAll('[data-gmr-history]')].map(n=>n.open===true);
  document.querySelectorAll('[data-gmr-history]').forEach((n,i)=>{if(n.isConnected===false)return;n.outerHTML=historyHTML();const fresh=document.querySelectorAll('[data-gmr-history]')[i];if(fresh&&open[i])fresh.open=true});
 }catch{}
}
function say(m){try{global.App?.notify?.(m)}catch{}}
function onEvent(e){
 const el=e?.target;if(!el||typeof el.closest!=='function')return false;
 const L=lang(),t=T[L];
 if(e.type==='change'&&el.matches?.('[data-gmr-mode]')){setMode(el.value);return true}
 if(e.type!=='click')return false;
 const r=el.closest('[data-gmr-reveal]');
 if(r){const ok=reveal(int(r.dataset.gmrReveal));say(ok?t.revealed:t.revealFail);focusAfter();return true}
 if(el.closest('[data-gmr-clear]')){
  const was=clear();
  if(typeof global.App?.notifyAction==='function'&&was.length)global.App.notifyAction(t.cleared,t.undo,()=>restore(was));else say(t.cleared);
  focusAfter();return true;
 }
 return false;
}
function focusAfter(){try{const d=document.querySelector('[data-gmr-history]');if(d){d.open=true;d.querySelector('summary')?.focus?.()}}catch{}}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','change'])document.addEventListener(type,onEvent)}
global.GmRolls={MAX,MODE_KEY,LOG_KEY,cleanMode,cleanEntry,cleanList,pushEntry,mode:getMode,setMode,emit,check,sum,entries,reveal,clear,restore,toggleHTML,historyHTML,onEvent,_reset(){loaded=false;mode='open';log=[]}};
})(window);
