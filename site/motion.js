/* Motion layer: view-enter reveals, tab transitions, roll count-up, HP hit/heal
   pulses, card hover glow, an animated hero skyline and a short boot screen.
   Purely decorative: never touches state, and does nothing when the user asks
   the system for reduced motion. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement;
const reduce=()=>!!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const EASE='cubic-bezier(.2,.75,.25,1)';
const calm=()=>root.classList.contains('ui-native'); // clean look: shorter, subtler motion
const REVEAL='.page-header,.hero,.section-head,.card,.quick-card,.character-card,.backup-strip,.source-strip,.room-banner,.room-member,.sheet-dock,.sheet-extras,.empty,.getting-started,.countbar';
let lastKey=null,io=null,lastHp=null,lastHpKey=null;

function animate(el,frames,opts){try{return el.animate?.(frames,opts)}catch{return null}}
function rise(el,i){const c=calm();return animate(el,[{opacity:0,transform:`translateY(${c?6:16}px)`},{opacity:1,transform:'none'}],{duration:c?240:460,delay:Math.min(i,12)*(c?22:45),easing:EASE,fill:'backwards'})}
function wipe(el){return animate(el,[{clipPath:'inset(0 100% 0 0)',opacity:.4},{clipPath:'inset(0 0 0 0)',opacity:1}],{duration:560,delay:80,easing:EASE,fill:'backwards'})}

// Reveal the top-level blocks of a freshly opened view; blocks below the fold animate as they scroll in.
function revealView(){
 io?.disconnect();io=null;
 const content=doc.querySelector('.content');if(!content)return;
 const blocks=[...content.querySelectorAll(REVEAL)].filter(el=>el.offsetParent!==null&&!el.parentElement?.closest(REVEAL));
 const vh=global.innerHeight||800,below=[];let i=0;
 for(const el of blocks){if(el.getBoundingClientRect().top<vh)rise(el,i++);else below.push(el)}
 if(!calm())for(const h of content.querySelectorAll('.page-header h1,.hero h1'))wipe(h);
 if(below.length&&'IntersectionObserver' in global){
  for(const el of below)el.classList.add('rv-wait');
  io=new IntersectionObserver(entries=>{let k=0;for(const e of entries){if(!e.isIntersecting)continue;io?.unobserve(e.target);e.target.classList.remove('rv-wait');rise(e.target,k++)}},{rootMargin:'0px 0px -30px 0px'});
  for(const el of below)io.observe(el);
  // Never leave anything hidden for long, whatever happens to the observer.
  setTimeout(()=>{for(const el of doc.querySelectorAll('.rv-wait'))el.classList.remove('rv-wait')},5000);
 }
}

// The sections that become visible after a sheet tab switch slide in.
function revealTab(){
 const layout=doc.querySelector('.sheet-layout');if(!layout)return;
 const blocks=[...layout.querySelectorAll('.sheet-primary > *, .cx-root > *, .sheet-aside')].filter(el=>el.offsetParent!==null&&!el.classList.contains('cx-root'));
 blocks.slice(0,8).forEach((el,i)=>animate(el,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:320,delay:i*40,easing:EASE,fill:'backwards'}));
}

// HP chip shakes red when HP drops and glows green when it rises.
function watchHud(key){
 const hp=doc.querySelector('.sheet-hud .hud-hp b');if(!hp)return;
 const value=Number(hp.textContent);
 if(lastHpKey===key&&Number.isFinite(lastHp)&&Number.isFinite(value)&&value!==lastHp){
  const chip=hp.closest('.hud-chip');
  if(value<lastHp)animate(chip,[{transform:'translateX(0)',boxShadow:'0 0 0 0 rgba(227,66,60,0)'},{transform:'translateX(-5px)',boxShadow:'0 0 0 3px rgba(227,66,60,.55)'},{transform:'translateX(4px)'},{transform:'translateX(-2px)'},{transform:'none',boxShadow:'0 0 0 0 rgba(227,66,60,0)'}],{duration:480,easing:'ease-out'});
  else animate(chip,[{boxShadow:'0 0 0 0 rgba(132,183,153,0)'},{boxShadow:'0 0 0 4px rgba(132,183,153,.6)'},{boxShadow:'0 0 0 0 rgba(132,183,153,0)'}],{duration:700,easing:'ease-out'});
 }
 lastHp=value;lastHpKey=key;
}

// Roll result card: the big number tumbles for a moment before landing.
let tumble=null;
function countUp(el){
 const final=el.textContent.trim(),n=Number(final);if(!Number.isFinite(n)||el.dataset.counted===final)return;
 el.dataset.counted=final;clearInterval(tumble);
 const lo=Math.max(1,n-9),hi=n+9,started=Date.now();
 tumble=setInterval(()=>{if(Date.now()-started>380||!el.isConnected){clearInterval(tumble);el.textContent=final;el.dataset.counted=final;animate(el,[{transform:'skew(-6deg) scale(1.25)'},{transform:'skew(-6deg) scale(1)'}],{duration:260,easing:EASE});return}el.textContent=String(lo+Math.floor(Math.random()*(hi-lo+1)));el.dataset.counted=el.textContent},40);
}
function watchNotices(){
 const check=()=>{const total=doc.querySelector('#app-notice.roll-notice.visible .roll-total');if(total)countUp(total)};
 new MutationObserver(muts=>{for(const m of muts){const t=m.target;if(t.id==='app-notice'||t.closest?.('#app-notice')||[...m.addedNodes].some(n=>n.id==='app-notice')){check();return}}}).observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

// A soft red light follows the pointer across cards (desktop only).
function hoverGlow(){
 if(!global.matchMedia?.('(hover: hover) and (pointer: fine)').matches)return;
 let pending=null,queued=false;
 doc.addEventListener('pointermove',e=>{pending=e;if(queued)return;queued=true;global.requestAnimationFrame(()=>{queued=false;const ev=pending,card=ev?.target?.closest?.('.card,.quick-card,.character-card');if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--mx',(ev.clientX-r.left)+'px');card.style.setProperty('--my',(ev.clientY-r.top)+'px')})},{passive:true});
}

// An original, procedurally drawn skyline with flickering windows for the home hero.
let skylineSvg='';
function skyline(){
 if(skylineSvg)return skylineSvg;
 let seed=2045;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const W=600,H=170,parts=[];
 // Two layers for depth: a hazy far row of towers, then a darker near row.
 const layer=(minH,maxH,minW,maxW,tones,windowChance,cls)=>{
  let x=-10;
  while(x<W){const w=minW+Math.floor(rnd()*(maxW-minW)),h=minH+Math.floor(rnd()*(maxH-minH)),y=H-h,tone=tones[Math.floor(rnd()*tones.length)];
   parts.push(`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${tone}"/>`);
   if(rnd()>.55)parts.push(`<rect class="${cls}" x="${x+3}" y="${y-6}" width="${Math.max(4,w-6)}" height="6" fill="${tone}"/>`);
   if(rnd()>.72){const ax=x+Math.floor(w/2);parts.push(`<rect x="${ax-1}" y="${y-22}" width="2" height="22" fill="${tone}"/><circle class="sk-beacon" cx="${ax}" cy="${y-23}" r="2" style="animation-delay:${(rnd()*3).toFixed(2)}s"/>`)}
   for(let wy=y+7;wy<H-5;wy+=9)for(let wx=x+4;wx<x+w-5;wx+=7){const r=rnd();if(r>1-windowChance){const blink=r>1-windowChance*.18;parts.push(`<rect class="sk-w ${cls}-w${blink?' sk-blink':''}" x="${wx}" y="${wy}" width="3" height="4"${blink?` style="animation-delay:${(rnd()*6).toFixed(2)}s"`:''}/>`)}}
   x+=w+1+Math.floor(rnd()*4);
  }
 };
 layer(70,150,14,30,['#2a1c1d','#2f1f20'],.16,'sk-far');
 layer(30,105,18,38,['#140e10','#181113','#100b0d'],.28,'sk-near');
 skylineSvg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${parts.join('')}</svg>`;
 return skylineSvg;
}
function decorateHero(){
 const art=doc.querySelector('.hero-art');if(!art||art.querySelector('.hero-skyline'))return;
 art.insertAdjacentHTML('beforeend',`<div class="hero-skyline">${skyline()}</div><div class="hero-scan"></div>`);
}

// A short boot screen, once per browser session.
function boot(){
 let shown=false;try{shown=global.sessionStorage?.getItem('nc-boot')==='1';global.sessionStorage?.setItem('nc-boot','1')}catch{}
 if(shown||reduce()||calm())return;
 const ru=(root.lang||'ru')!=='en';
 const el=doc.createElement('div');el.className='boot-screen';el.setAttribute('aria-hidden','true');
 el.innerHTML=`<div class="boot-inner"><div class="boot-mark">NC</div><div class="boot-lines"><span>NIGHT CITY // RED</span><span>${ru?'ПОДКЛЮЧЕНИЕ К СЕТИ…':'JACKING IN…'}</span><span class="boot-ok">${ru?'ДОСТУП ОТКРЫТ':'ACCESS GRANTED'}</span></div><div class="boot-bar"><i></i></div></div>`;
 doc.body.appendChild(el);
 const done=()=>{el.classList.add('out');setTimeout(()=>el.remove(),420)};
 el.addEventListener('click',done);setTimeout(done,950);
}

function afterRender(key){
 decorateHero();
 if(reduce()){lastKey=key;return}
 const changed=key!==lastKey;lastKey=key;
 if(changed)revealView();
 watchHud(key);
}
doc.addEventListener('click',e=>{if(e.target.closest?.('.sheet-tabs [data-sheet-tab]')&&!reduce())setTimeout(revealTab,0)});
// HP edits re-render the HUD in place; check it after any edit.
for(const type of ['input','change','click'])doc.addEventListener(type,()=>setTimeout(()=>{if(!reduce())watchHud(lastKey)},20));

boot();
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>{watchNotices();hoverGlow()});else{watchNotices();hoverGlow()}
global.Motion={afterRender,skyline};
})(window);
