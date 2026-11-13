(function(){
// Per-step validation helpers for the creation wizards (builder.js, quick-builder.js). Pure, plus two small DOM helpers.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function progress(errors,count){
 const list=Array.isArray(errors)?errors:[];let reachable=count-1;
 for(const e of list){const s=Number(e?.step);if(Number.isInteger(s)&&s>=0&&s<count&&s<reachable)reachable=s}
 const states=[];for(let i=0;i<count;i++)states.push(i<reachable?'done':i===reachable?(list.some(e=>e?.step===i)?'todo':'ready'):'locked');
 return {reachable,states};
}
function resolve(errors,count,from,to){
 to=Math.max(0,Math.min(count-1,Math.trunc(Number(to))||0));
 if(to<=from)return {step:to,blocked:false};
 const step=Math.min(to,progress(errors,count).reachable);return {step,blocked:step!==to};
}
function stepErrors(errors,step){
 const seen=new Set(),out=[];
 for(const e of Array.isArray(errors)?errors:[]){if(e?.step!==step)continue;const k=e.ru+'\0'+e.en;if(seen.has(k))continue;seen.add(k);out.push(e)}
 return out;
}
function firstField(errors,step){const e=stepErrors(errors,step).find(x=>x.field);return e?e.field:null}
function sel(attr,value){return value===undefined?`[${attr}]`:`[${attr}="${String(value).replace(/["\\]/g,'\\$&')}"]`}
const isControl=el=>/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(String(el?.tagName||'').toUpperCase());
function focus(root,selector){
 try{
  let el=null;try{el=selector?root.querySelector(selector):null}catch{el=null}
  if(!el||el.disabled||el.closest?.('[hidden]'))el=root.querySelector('[data-wizard-errors]');
  if(!el)return false;
  if(!isControl(el)&&!el.hasAttribute?.('tabindex'))el.setAttribute('tabindex','-1');
  el.focus({preventScroll:true});el.scrollIntoView?.({block:'center'});return true;
 }catch{return false}
}
function mark(root,selectors){
 if(!root?.querySelectorAll)return;
 for(const n of root.querySelectorAll('[data-wz-invalid]')){n.removeAttribute('aria-invalid');n.removeAttribute('data-wz-invalid')}
 for(const s of selectors||[]){let n=null;try{n=s?root.querySelector(s):null}catch{n=null}if(n&&isControl(n)&&String(n.tagName).toUpperCase()!=='BUTTON'){n.setAttribute('aria-invalid','true');n.setAttribute('data-wz-invalid','')}}
}
function listHTML(title,entries){
 if(!Array.isArray(entries)||!entries.length)return '';
 return `<div class="wz-review"><h3>${esc(title)}</h3><ul class="wz-chips">${entries.map(x=>`<li>${esc(x.label)}${x.value!==''&&x.value!=null?` <b>${esc(x.value)}</b>`:''}</li>`).join('')}</ul></div>`;
}
function syncAttrs(a,b){for(const x of [...a.attributes])if(!b.hasAttribute(x.name))a.removeAttribute(x.name);for(const x of [...b.attributes])if(a.getAttribute(x.name)!==x.value)a.setAttribute(x.name,x.value)}
function swap(strip,html){if(typeof document==='undefined'||!strip.children){strip.outerHTML=html;return}const t=document.createElement('template');t.innerHTML=html;const n=t.content.firstElementChild;if(!n)return;const A=[...strip.children],B=[...n.children];if(A.length===B.length&&A.every((e,i)=>e.tagName===B[i].tagName)){syncAttrs(strip,n);A.forEach((e,i)=>{syncAttrs(e,B[i]);if(e.innerHTML!==B[i].innerHTML)e.innerHTML=B[i].innerHTML});return}strip.replaceWith(n)}
window.WizardSteps={swap,progress,resolve,stepErrors,firstField,sel,focus,mark,listHTML};
})();
