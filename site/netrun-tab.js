/* NETRUN tab for characters with the Netrunner role (primary or multiclass):
   Interface rank, NET actions per turn and one-tap Interface ability checks.
   Ability names and short descriptions come from RoleTools; rolls go through the
   app's own checkRoll via window.App, so crits, history and online rooms work. */
(function(global){
'use strict';
const doc=global.document;
const T={ru:{title:'NETRUN',lead:'Проверки способностей Interface: 1d10 + ранг Interface против DV узла, ICE или программы. Штраф от ранений учитывается автоматически.',rank:'Ранг Interface',actions:'NET-действий за ход',roll:'Бросок',zap:'Урон Zap 1d6',open:'Открыть NET-архитектуры',deck:'Кибердека, программы и пароли — ниже, в инструментах роли.',none:'У персонажа нет роли Netrunner.'},
 en:{title:'NETRUN',lead:'Interface ability checks: 1d10 + Interface rank against the DV of a node, ICE or program. The wound penalty is applied automatically.',rank:'Interface rank',actions:'NET actions per turn',roll:'Roll',zap:'Zap damage 1d6',open:'Open NET architectures',deck:'Cyberdeck, programs and passwords are below, in the role tools.',none:'This character has no Netrunner role.'}};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=l=>l==='en'?'en':'ru';

function interfaceRank(c){
 if(!c||typeof c!=='object')return 0;
 const clamp=v=>{const n=Math.floor(Number(v));return Number.isFinite(n)?Math.max(0,Math.min(10,n)):0};
 if(c.role==='netrunner')return clamp(c.rank);
 const extra=Array.isArray(c.extra?.additionalRoles)?c.extra.additionalRoles.find(r=>r?.role==='netrunner'):null;
 return extra?clamp(extra.rank):0;
}
function abilities(){const list=global.RoleTools?.data?.netAbilities;return Array.isArray(list)?list.filter(a=>Array.isArray(a)&&a.length>=3):[]}
function render(c,l){
 const r=interfaceRank(c);if(!r)return '';
 const d=T[lang(l)],ru=lang(l)==='ru',actions=global.RoleTools?.netActions?.(r)??'—';
 return `<section class="card netrun-card"><div class="card-heading"><span>${esc(d.title)}</span><span>INTERFACE</span></div><p class="netrun-lead">${esc(d.lead)}</p><div class="netrun-stats"><div><small>${esc(d.rank)}</small><b>${r}</b></div><div><small>${esc(d.actions)}</small><b>${esc(actions)}</b></div></div>${global.RolePlay?.netrunBar?.(c,r,l)||''}<div class="netrun-grid">${abilities().map(([name,ruText,enText])=>`<button type="button" class="netrun-ability" data-netrun-roll="${esc(name)}"><span><b>${esc(name)}</b><small>${esc(ru?ruText:enText)}</small></span><em>+${r}</em></button>`).join('')}</div><div class="netrun-actions"><button type="button" class="btn ghost" data-netrun-zap>⌁ ${esc(d.zap)}</button><button type="button" class="btn ghost" data-action="navigate" data-view="net">⌬ ${esc(d.open)}</button></div><p class="netrun-lead">${esc(d.deck)}</p></section>`;
}
doc.addEventListener('click',e=>{
 const roll=e.target.closest?.('[data-netrun-roll]'),zap=e.target.closest?.('[data-netrun-zap]');
 if(!roll&&!zap)return;
 const c=global.App?.active?.(),r=interfaceRank(c);if(!r)return;
 if(roll){if(!global.RolePlay?.netrunRoll?.(c,r,roll.dataset.netrunRoll))global.App.check(r,`${roll.dataset.netrunRoll} (Interface ${r})`)}
 else global.App.dice?.(1,6,'Zap');
});
global.NetrunTab={render,interfaceRank};
})(window);
