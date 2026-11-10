/* One door for the dice the tools roll on their own (medicine, repairs, NET, hazards, vehicles and so on).
   The tools keep their arithmetic; what they rolled is handed over here and goes to the history of rolls and,
   in a room, to the feed everyone sees. Without the app (tests of a single tool) every call is a quiet no-op. */
(function(global){
'use strict';
const int=v=>{const n=Number(v);return v!==null&&v!==''&&Number.isFinite(n)?Math.trunc(n):null};
const face=(v,s)=>({v,s});
// One die. A random source that misbehaves gives null instead of a wrong face.
function d(sides,rng=Math.random){const n=rng();return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1?1+Math.floor(n*sides):null}
// 1d10 with the critical rule (p. 130): a 10 adds one more d10, a 1 subtracts one. The second die never explodes again.
function d10(rng=Math.random){
 const first=d(10,rng);if(first===null)return null;
 const extra=first===1||first===10?d(10,rng):0;if(extra===null)return null;
 return {first,extra,value:first+(first===10?extra:first===1?-extra:0)};
}
const dieText=(first,extra)=>`1d10 ${first}${extra?(first===10?' + ':' − ')+extra:''}`;
// A tool that has no language at hand gets the language of the app.
function language(lang){if(lang==='ru'||lang==='en')return lang;try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}}
const valueOf=(first,extra)=>first+(first===10?extra:first===1?-extra:0);
function report(label,detail,total,faces){
 label=String(label??'').replace(/\s+/g,' ').trim();if(!label||int(total)===null)return false;
 try{return global.App?.report?.(label,String(detail??''),int(total),faces)===true}catch{return false}
}
/* A d10 check a tool has made. `r` is the tool's own result: the first die under `die`, `first` or `one`, the second under
   `extra`, the sum under `total`, and optionally `dv` and `success`. */
function check(label,r,lang){
 if(!r||typeof r!=='object')return false;lang=language(lang);
 const first=int(r.die??r.first??r.one),extra=int(r.extra)||0,total=int(r.total);
 if(first===null||first<1||first>10||extra<0||extra>10||total===null)return false;
 const ru=lang!=='en',base=total-(first+(first===10?extra:first===1?-extra:0)),dv=r.dv===undefined||r.dv===null?null:int(r.dv);
 const success=typeof r.success==='boolean'?r.success:dv===null?null:total>dv;
 const verdict=success===null?'':` — ${success?(ru?'успех':'success'):(ru?'провал':'failure')}`;
 const detail=`${dieText(first,extra)} ${base<0?'−':'+'} ${Math.abs(base)} = ${total}`+(dv===null?verdict:` ${success?'>':'≤'} DV ${dv}${verdict}`);
 return report(label,detail,total,[face(first,10),...(extra?[face(extra,10)]:[])]);
}
// Dice that are simply added up: damage, a table, a loss of Humanity. `bonus` is added to the sum of the dice.
function sum(label,dice,sides,{bonus=0,total,note=''}={}){
 if(!Array.isArray(dice)||!dice.length||dice.length>40||dice.some(v=>int(v)===null||v<1||v>sides))return false;
 const add=int(bonus)||0,all=int(total)??dice.reduce((a,b)=>a+b,0)+add;
 const detail=`${dice.length}d${sides}: ${dice.join(' + ')}${add?(add<0?' − ':' + ')+Math.abs(add):''}${dice.length>1||add?' = '+all:''}${note?' · '+note:''}`;
 return report(label,detail,all,dice.slice(0,12).map(v=>face(v,sides)));
}
/* Two sides roll against each other; the first wins only with the higher total. Each side is {first, extra, total}.
   A side that does not roll (a fixed DV) is given as a number, and the roll becomes an ordinary check against it. */
function opposed(label,a,b,won,lang){
 lang=language(lang);
 if(typeof b==='number')return check(label,{...a,dv:b,success:typeof won==='boolean'?won:undefined},lang);
 const side=x=>{const first=int(x?.first),extra=int(x?.extra)||0,total=int(x?.total);if(first===null||first<1||first>10||extra<0||extra>10||total===null)return null;const base=total-valueOf(first,extra);return {first,extra,total,text:`${dieText(first,extra)} ${base<0?'−':'+'} ${Math.abs(base)} = ${total}`}};
 const x=side(a),y=side(b);if(!x||!y)return false;
 const ru=lang!=='en',win=typeof won==='boolean'?won:x.total>y.total;
 return report(label,`${x.text} ${ru?'против':'vs'} ${y.text} — ${win?(ru?'успех':'success'):(ru?'провал':'failure')}`,x.total,[face(x.first,10),...(x.extra?[face(x.extra,10)]:[])]);
}
global.Rolls={d,d10,dieText,check,opposed,sum,report};
})(window);
