// «Быстрые броски»: the rail above the tabs and the star on a Skill row (site/quick-rail.js).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const same=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);

const SKILLS={Handgun:{name:'Handgun',ru:'Пистолеты',stat:'REF',total:'+12'},Perception:{name:'Perception',ru:'Восприятие',stat:'INT',total:'+9'},Athletics:{name:'Athletics',ru:'Атлетика',stat:'DEX',total:'+8'},Stealth:{name:'Stealth',ru:'Скрытность',stat:'DEX',total:'+7'},Acting:{name:'Acting',ru:'Актёрское мастерство',stat:'COOL',total:'+6'},Streetwise:{name:'Streetwise',ru:'Знание улиц',stat:'COOL',total:'+5'},Brawling:{name:'Brawling',ru:'Рукопашный бой',stat:'DEX',total:'+4'}};
function load(over={}){
 const listeners={},notes=[],saves=[];
 const el={focus(){}};
 const doc={documentElement:{lang:'ru'},addEventListener(t,fn){(listeners[t]||=[]).push(fn)}};
 const win={document:doc,SKILL_LABELS:Object.fromEntries(Object.values(SKILLS).map(s=>[s.name,{ru:s.ru,en:s.name}])),
  App:{lang:()=>doc.documentElement.lang,skillInfo:n=>SKILLS[n]||null,notify:m=>notes.push(m),save:()=>saves.push(1),active:()=>over.c||null,checkBonus:(c,stat,level)=>(c?.stats?.[stat]||0)+(Number(level)||0),initiativeBonus:c=>c.stats.REF},
  CharacterExtra:{init:c=>{if(c.extra===undefined)c.extra={};return c.extra},attackBonus:(c,i)=>10+i},SheetTabs:{refreshHud(){win.refreshed=(win.refreshed||0)+1}},PlayCombat:{precision:()=>2},...over.win};
 vm.runInNewContext(src('quick-rail.js'),{window:win});
 return {Q:win.QuickRail,win,doc,notes,saves,listeners,el};
}
const hero=(extra)=>({id:'c',name:'V',stats:{INT:6,REF:7,DEX:6,TECH:5,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Evasion:4,Handgun:5},extra});

test('clean keeps known names, once each, at most five, and shrugs at anything else',()=>{
 const {Q}=load(),known=n=>n in SKILLS;
 same(Q.clean(['Handgun','Handgun','Nope','Perception'],known),['Handgun','Perception']);
 same(Q.clean(Object.keys(SKILLS),known).length,5);
 same(Q.clean('Handgun',known),[]);same(Q.clean(null,known),[]);same(Q.clean({0:'Handgun'},known),[]);
 same(Q.clean([1,null,{},'x'.repeat(81),'Handgun'],known),['Handgun'],'only short strings');
 same(Q.clean(['a','b'],new Set(['b'])),['b'],'a Set works as the list of known names');
 same(Q.clean(['a','b']),['a','b'],'without a list of known names the strings pass');
});

test('toggle adds, removes and refuses a sixth star without losing the others',()=>{
 const {Q}=load(),known=n=>n in SKILLS;
 let r=Q.toggle([],'Handgun',known);same(r,{list:['Handgun'],changed:true,full:false,on:true});
 r=Q.toggle(r.list,'Handgun',known);same(r,{list:[],changed:true,full:false,on:false});
 let l=['Handgun','Perception','Athletics','Stealth','Acting'];
 r=Q.toggle(l,'Streetwise',known);same(r,{list:l,changed:false,full:true});
 r=Q.toggle(l,'Acting',known);same(r.list,['Handgun','Perception','Athletics','Stealth'],'unstarring works when the list is full');
 r=Q.toggle([],'Nope',known);assert.equal(r.changed,false);assert.equal(Q.toggle([],'',known).changed,false);assert.equal(Q.toggle([],'x'.repeat(81)).changed,false);
 same(Q.toggle(undefined,'Handgun',known).list,['Handgun']);
});

test('the rail always has Initiative and Evasion, the main weapon and the starred Skills, with the numbers of the sheet',()=>{
 const {Q}=load();
 const c=hero({weapons:[{name:'Pistol'}],quickRolls:['Perception','Handgun']});
 const e=Q.entries(c,'ru');
 same(e.map(x=>x.id),['init','evasion','weapon','skill:Perception','skill:Handgun']);
 same(e.map(x=>x.total),['+7','+10','+12','+9','+12'],'initiative from REF, evasion DEX + level, weapon attack plus the Solo precision, then the Skill rows');
 assert.equal(e[2].label,'Pistol');assert.equal(e[3].label,'Восприятие');assert.equal(Q.entries(c,'en')[3].label,'Perception');
 assert.match(e[1].warn,/не от пуль/,'REF 7 is under 8: a warning');
});

test('the rail warns that Evasion does not work against bullets with a low REF, and shows no weapon without one',()=>{
 const {Q}=load(),c=hero(undefined);c.stats.REF=6;
 const e=Q.entries(c,'ru');
 same(e.map(x=>x.id),['init','evasion']);assert.match(e[1].warn,/не от пуль/);
 assert.match(Q.entries(c,'en')[1].warn,/not vs bullets/);
 c.stats.REF=8;assert.equal(Q.entries(c,'ru')[1].warn,'');
});

test('every button presses the sheet\'s own roll button',()=>{
 const {Q}=load(),e=Q.entries(hero({weapons:[{name:'A'},{name:'B'}],quickRolls:['Handgun']}),'ru');
 same(e.map(x=>x.selector),['[data-action="initiative-roll"]','[data-action="skill-roll"][data-skill="Evasion"]','[data-cx-action="attack"][data-cx-index="0"]','[data-action="skill-roll"][data-skill="Handgun"]']);
 const html=Q.html(hero({quickRolls:['Handgun']}),'ru');
 assert.match(html,/data-proxy-roll="\[data-action=&quot;skill-roll&quot;\]\[data-skill=&quot;Handgun&quot;\]"/);
});

test('a star whose Skill is not known any more drops out of the rail; a hostile list is read as empty',()=>{
 const {Q}=load();
 same(Q.entries(hero({quickRolls:['Gone','Handgun']}),'ru').map(x=>x.id),['init','evasion','skill:Handgun']);
 same(Q.entries(hero({quickRolls:'Handgun'}),'ru').map(x=>x.id),['init','evasion']);
 same(Q.entries(hero({quickRolls:{length:3}}),'ru').map(x=>x.id),['init','evasion']);
 same(Q.entries(hero({weapons:[null,'x',[],{name:'Real'}]}),'ru').map(x=>x.label),['Инициатива','Уклонение','Real'],'the first usable weapon');
 assert.doesNotThrow(()=>Q.entries(null,'ru'));same(Q.entries(null,'ru'),[]);
});

test('the markup is a labelled group, escaped, with a hint to star Skills when there are none',()=>{
 const {Q}=load();
 const h=Q.html(hero({weapons:[{name:'<b>x</b>"'}]}),'ru');
 assert.match(h,/role="group" aria-label="Быстрые броски"/);assert.doesNotMatch(h,/<b>x/);assert.match(h,/&lt;b&gt;x/);
 assert.match(h,/qr-add/);assert.match(h,/data-hud-jump="sheet-skills"/);assert.match(h,/★ у навыка — быстрый бросок/);
 assert.doesNotMatch(Q.html(hero({quickRolls:['Handgun']}),'ru'),/qr-add/);
 assert.match(Q.html(hero(),'en'),/Quick rolls/);assert.equal(Q.html(null,'ru'),'');
});

test('the star on a Skill row is a toggle button with a name in both languages',()=>{
 const {Q}=load();
 const off=Q.starHTML(hero(),'Handgun','ru'),on=Q.starHTML(hero({quickRolls:['Handgun']}),'Handgun','en');
 assert.match(off,/data-quick-star="Handgun" aria-pressed="false" aria-label="В быстрые броски: Пистолеты"/);assert.match(off,/☆/);
 assert.match(on,/aria-pressed="true" aria-label="Remove from quick rolls: Handgun"/);assert.match(on,/★/);
 assert.match(Q.starHTML(hero(),'A"B','ru'),/data-quick-star="A&quot;B"/);
});

test('pressing a star writes extra.quickRolls, saves, redraws the rail and keeps the focus; the sixth star is refused with a message',()=>{
 const c=hero(),h=load({c});
 const btn=(name)=>{const b={dataset:{quickStar:name},attrs:{},title:'',focused:0,setAttribute(k,v){this.attrs[k]=v},focus(){this.focused++},querySelector:()=>({textContent:''})};return {b,event:{target:{closest:s=>s==='[data-quick-star]'?b:null}}}};
 let p=btn('Handgun');assert.equal(h.Q.onClick(p.event),true);
 same(c.extra.quickRolls,['Handgun']);assert.equal(h.saves.length,1);assert.equal(p.b.attrs['aria-pressed'],'true');assert.equal(p.b.focused,1);assert.equal(h.win.refreshed,1);
 for(const n of ['Perception','Athletics','Stealth','Acting'])h.Q.onClick(btn(n).event);
 same(c.extra.quickRolls,['Handgun','Perception','Athletics','Stealth','Acting']);
 const before=h.saves.length;h.Q.onClick(btn('Streetwise').event);
 same(c.extra.quickRolls.length,5);assert.equal(h.saves.length,before,'nothing saved');assert.match(h.notes.at(-1),/Уже 5 навыков/);
 h.Q.onClick(btn('Handgun').event);assert.equal(c.extra.quickRolls.includes('Handgun'),false);
 for(const n of ['Perception','Athletics','Stealth','Acting'])h.Q.onClick(btn(n).event);
 assert.equal('quickRolls' in c.extra,false,'an empty list is not stored at all');
 assert.equal(h.Q.onClick({target:{closest:()=>null}}),false);
});

test('without a sheet nothing is written; an unknown skill name from the page is ignored',()=>{
 const h=load({c:null});
 const b={dataset:{quickStar:'Handgun'},setAttribute(){},focus(){}};
 assert.equal(h.Q.onClick({target:{closest:()=>b}}),true);
 const c=hero(),g=load({c});g.Q.onClick({target:{closest:()=>({dataset:{quickStar:'Bogus'},setAttribute(){},focus(){}})}});
 assert.equal(c.extra?.quickRolls,undefined);assert.equal(g.saves.length,0);
 assert.equal(g.Q.setStars(null,['Handgun']),false);
 const odd={extra:[]};g.Q.setStars(odd,['Handgun']);assert.ok(odd.extra&&odd.extra.quickRolls,'a sheet whose extra is not an object is repaired by the sheet\'s own init');
});

test('old saves load unchanged: a sheet without the field has the default rail and no field is added by reading',()=>{
 const {Q}=load(),c=hero({weapons:[]}),snapshot=JSON.stringify(c);
 Q.entries(c,'ru');Q.html(c,'ru');Q.stars(c);assert.equal(JSON.stringify(c),snapshot);
});

test('the stylesheet gives touch targets of 44 px, scrolls sideways instead of wrapping, and the star is 44 × 44',()=>{
 const css=src('quick-rail.css')+src('sheet-compact.css');
 assert.match(src('quick-rail.css'),/\.qr-btn \{[^}]*min-height: 44px/);
 assert.match(css,/\.skill-star \{[^}]*width: 44px[^}]*height: 44px/);
 assert.match(src('quick-rail.css'),/overflow-x: auto/);
});

test('a star is refused when the app says the sheet cannot be edited now (stale scope, other view, mid-switch)',()=>{
 const c=hero(),h=load({c});
 h.win.App.canEdit=()=>false;
 const b={dataset:{quickStar:'Handgun'},setAttribute(){},focus(){},querySelector:()=>null};
 assert.equal(h.Q.onClick({target:{closest:()=>b}}),true);
 assert.equal(c.extra?.quickRolls,undefined,'nothing written');assert.equal(h.saves.length,0);assert.ok(h.notes.length>0,'and it says so');
 h.win.App.canEdit=x=>x===c;h.Q.onClick({target:{closest:()=>b}});same(c.extra.quickRolls,['Handgun']);
});
test('Evasion is never twice in the rail: a star on it adds no second button and no hint is hidden by it',()=>{
 const c=hero({quickRolls:['Evasion','Handgun']}),h=load({c});
 const ids=h.Q.entries(c,'ru').map(e=>e.id);
 assert.equal(ids.filter(i=>i==='evasion'||i==='skill:Evasion').length,1);assert.ok(ids.includes('skill:Handgun'));
 const only=hero({quickRolls:['Evasion']});assert.match(load({c:only}).Q.html(only,'ru'),/qr-add/,'the hint to star a Skill stays while only Evasion is starred');
});
