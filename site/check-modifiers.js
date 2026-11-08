/* Optional modifiers for a check, Cyberpunk RED Corebook p. 130. */
(function(){
'use strict';
const conditions=Object.freeze({
 lowLight:{value:-1,ru:'Ночь или слабое освещение',en:'Night or low lighting'},
 firstTime:{value:-1,ru:'Никогда раньше этого не делал',en:'Never done this before'},
 complex:{value:-2,ru:'Сложная задача',en:'Complex task'},
 tools:{value:-2,ru:'Нет подходящих инструментов или деталей',en:'Missing the right tools or parts'},
 poorSleep:{value:-2,ru:'Неудобный сон накануне',en:'Uncomfortable sleep the night before'},
 stress:{value:-2,ru:'Сильный стресс',en:'Extreme stress'},
 exhausted:{value:-4,ru:'Истощение',en:'Exhausted'},
 sedated:{value:-4,ru:'Сильное опьянение или седативный эффект',en:'Extremely drunk or sedated'},
 secret:{value:-4,ru:'Попытка выполнить задачу скрытно',en:'Trying to perform the task secretly'},
 obscured:{value:-4,ru:'Задача затруднена дымом или темнотой',en:'Task obscured by smoke or darkness'}
});
const text={ru:{title:'СИТУАЦИОННЫЕ МОДИФИКАТОРЫ',intro:'Выберите только условия, которые ведущий применяет к этой проверке. Примеры штрафов из книги складываются; обстоятельства и исключения определяет ведущий.',comp:'Ведущий разрешил бонус за успешный связанный навык (+1)',time:'На задачу потрачено в четыре раза больше времени (+1)',manual:'Другие модификаторы',calculate:'Рассчитать сумму',start:'Выберите условия и рассчитайте сумму для ручного переноса в проверку.',invalid:'Введите целый дополнительный модификатор от −100 до 100.',total:'Общий модификатор',note:'Бонус связанного навыка действует на следующую попытку один раз и не складывается с другими такими бонусами. Дополнительное время даёт только один +1. Сверьте штрафы от ранений, брони, LUCK и другие эффекты: не учитывайте их повторно, если выбранный бросок уже применяет их автоматически. Этот расчёт не изменяет лист и не выполняет бросок.',source:'Книга, стр. 130'},en:{title:'SITUATIONAL MODIFIERS',intro:'Select only conditions the GM applies to this check. The example penalties from the book are cumulative; the GM decides the circumstances and exceptions.',comp:'GM approves a successful complementary skill bonus (+1)',time:'Four times the normal task time was spent (+1)',manual:'Other modifiers',calculate:'Calculate total',start:'Select conditions and calculate the total to enter manually into a check.',invalid:'Enter a whole additional modifier from −100 to 100.',total:'Total modifier',note:'A complementary skill bonus applies once to the subsequent attempt and does not stack with other complementary bonuses. Taking extra time grants only one +1. Check wounds, armor, LUCK and other effects: do not count them again if the chosen roll already applies them automatically. This calculator does not change a sheet or roll dice.',source:'Corebook p. 130'}};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function calculate(keys,complementary,extraTime,manual){
 if(!Array.isArray(keys)||new Set(keys).size!==keys.length||keys.some(k=>!Object.hasOwn(conditions,k))||typeof complementary!=='boolean'||typeof extraTime!=='boolean'||!Number.isInteger(manual)||manual< -100||manual>100)return null;
 return keys.reduce((sum,k)=>sum+conditions[k].value,0)+(complementary?1:0)+(extraTime?1:0)+manual;
}
function render(lang){const l=lang==='en'?'en':'ru',t=text[l];return `<section class="card check-modifiers" data-cm-root><div class="card-heading"><span>${esc(t.title)}</span><span>130</span></div><p>${esc(t.intro)}</p><div class="cm-conditions">${Object.entries(conditions).map(([key,v])=>`<label><input type="checkbox" data-cm-condition="${key}"> ${esc(v[l])} · ${v.value}</label>`).join('')}</div><div class="cm-conditions"><label><input type="checkbox" data-cm-complementary> ${esc(t.comp)}</label><label><input type="checkbox" data-cm-time> ${esc(t.time)}</label></div><label class="field">${esc(t.manual)}<input type="number" data-cm-manual min="-100" max="100" step="1" value="0"></label><button type="button" class="btn primary" data-cm-action="calculate">${esc(t.calculate)}</button><p data-cm-result role="status">${esc(t.start)}</p><p class="cm-note">${esc(t.note)}</p><button type="button" class="rule-source" data-action="book-page" data-page="130">${esc(t.source)} ↗</button></section>`}
function handle(e,lang){
 const target=e?.target;if((e?.type==='input'||e?.type==='change')&&target?.matches?.('[data-cm-condition],[data-cm-complementary],[data-cm-time],[data-cm-manual]')){const root=target.closest?.('[data-cm-root]'),out=root?.querySelector?.('[data-cm-result]');if(out)out.textContent=text[lang==='en'?'en':'ru'].start;return false}
 if(e?.type!=='click')return false;const b=target?.closest?.('[data-cm-action]');if(!b||b.dataset?.cmAction!=='calculate')return false;const root=b.closest?.('[data-cm-root]');if(!root)return false;const t=text[lang==='en'?'en':'ru'],out=root.querySelector('[data-cm-result]'),field=root.querySelector('[data-cm-manual]');if(!out||!field)return false;
 const raw=String(field.value).trim(),manual=/^[+-]?\d+$/.test(raw)?Number(raw):NaN,keys=Array.from(root.querySelectorAll('[data-cm-condition]:checked'),x=>x.dataset.cmCondition),complementary=!!root.querySelector('[data-cm-complementary]')?.checked,extraTime=!!root.querySelector('[data-cm-time]')?.checked,result=calculate(keys,complementary,extraTime,manual);
 out.textContent=result===null?t.invalid:`${t.total}: ${result>0?'+':''}${result}`;return true;
}
window.CheckModifiers={conditions,calculate,render,handle};
})();
