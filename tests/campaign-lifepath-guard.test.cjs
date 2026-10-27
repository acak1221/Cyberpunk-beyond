const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../public/game');
function setup(file){const s={console,Math,Date,confirm:()=>true,document:{querySelector:()=>null},crypto:{randomUUID:()=>Math.random().toString(36)}};s.window=s;vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s);return s}
const action=(attr,value,id)=>({type:'click',target:{closest:selector=>selector===`[data-${attr}-action]`||attr==='lp'&&value==='apply'&&selector==='[data-lp-action="apply"]'?{dataset:{[attr==='campaign'?'campaignAction':'lpAction']:value,id}}:null}});
test('campaign delete and participant removal reject detached or changed snapshots',()=>{
 const s=setup('campaigns.js'),p=s.Campaigns;let campaign={id:'c',name:'Work',notes:'',round:1,turnIndex:0,roster:[{id:'a',kind:'npc',name:'A',initiative:1},{id:'b',kind:'npc',name:'B',initiative:2}]},live=[campaign],old=live,characters=[],saves=0,alerts=[];
 const ctx={lang:'en',campaigns:old,characters,save:()=>saves++,render(){},notify:x=>alerts.push(x),isCurrent:c=>live===old&&live.includes(c)};
 p.handle(action('campaign','open','c'),ctx);
 s.confirm=()=>{live=[JSON.parse(JSON.stringify(campaign))];return true};p.handle(action('campaign','delete'),ctx);
 assert.equal(old.length,1);assert.equal(live.length,1);assert.equal(saves,0);assert.match(alerts.at(-1),/changed/);
 live=old;s.confirm=()=>{campaign.roster.unshift({id:'new',kind:'npc',name:'New',initiative:3});return true};p.handle(action('campaign','remove','a'),ctx);
 assert.equal(campaign.roster.length,3);assert(campaign.roster.some(x=>x.id==='a'));assert.equal(saves,0);
});
test('general Lifepath overwrite never applies to a detached or changed character',()=>{
 const s=setup('lifepath.js'),p=s.Lifepath,c={id:'c',role:'solo',native:'',extra:{life:{culture:'My own origin'}}};let live=[c],scope='a';
 p.setScope('a');p.setChoice('culture',1);p.handle({type:'change',target:{value:'c',hasAttribute:k=>k==='data-lp-target'}},'en',live);
 const opt={isCurrent:x=>scope==='a'&&live.includes(x)};
 s.confirm=()=>{live=[JSON.parse(JSON.stringify(c))];return true};let r=p.handle(action('lp','apply'),'en',[c],opt);
 assert.equal(r.dirty,undefined);assert.equal(c.extra.life.culture,'My own origin');assert.equal(live[0].extra.life.culture,'My own origin');assert.match(r.notify,/changed/);
 live=[c];s.confirm=()=>{c.extra.life.culture='Newer edit';return true};r=p.handle(action('lp','apply'),'en',live,opt);assert.equal(r.dirty,undefined);assert.equal(c.extra.life.culture,'Newer edit');
});
test('role Lifepath overwrite cannot mutate a stale sheet after confirmation',()=>{
 const s=setup('lifepath.js'),p=s.Lifepath,c={id:'c',role:'solo',extra:{life:{roleHistory:'My own role history'}}};let live=[c],scope='a';
 p.setScope('a');p.handle({type:'change',target:{value:'c',hasAttribute:k=>k==='data-lp-target'}},'en',live);p.handle({type:'change',target:{value:'solo',hasAttribute:k=>k==='data-lpr-role'}},'en',live);p.rollAllRole('solo');
 s.confirm=()=>{scope='b';p.setScope('b');return true};const r=p.handle(action('lp','apply'),'en',live,{isCurrent:x=>scope==='a'&&live.includes(x)});
 assert.equal(r.dirty,undefined);assert.equal(c.extra.life.roleHistory,'My own role history');assert.match(r.notify,/changed/);
});
test('role overwrite rejects generator changes made while confirmation is open',()=>{
 const s=setup('lifepath.js'),p=s.Lifepath,c={id:'c',role:'solo',extra:{life:{roleHistory:'My own role history'}}},live=[c];
 p.setScope('a');p.setChoice('culture',1);p.handle({type:'change',target:{value:'c',hasAttribute:k=>k==='data-lp-target'}},'en',live);p.handle({type:'change',target:{value:'solo',hasAttribute:k=>k==='data-lpr-role'}},'en',live);p.rollAllRole('solo');
 s.confirm=()=>{p.setChoice('culture',2);return true};const r=p.handle(action('lp','apply'),'en',live,{isCurrent:x=>live.includes(x)});assert.equal(r.dirty,undefined);assert.equal(c.extra.life.roleHistory,'My own role history');assert.equal(c.extra.life.culture,undefined);assert.match(r.notify,/changed/);
});
test('temporary scope loss hides the Lifepath draft and restores it only to the same account',()=>{
 const s=setup('lifepath.js'),p=s.Lifepath,chars=[{id:'a',name:'Private',role:'solo'}];p.setScope('a');p.setChoice('culture',1);p.handle({type:'change',target:{value:'a',hasAttribute:k=>k==='data-lp-target'}},'en',chars);p.handle({type:'input',target:{value:'My secret language',hasAttribute:k=>k==='data-lp-native'}},'en',chars);p.handle({type:'change',target:{value:'solo',hasAttribute:k=>k==='data-lpr-role'}},'en',chars);p.rollAllRole('solo');let role=p.roleText('solo','en');
 p.setScope(null);assert.equal(p.resultText('culture','en'),'');assert.equal(p.roleText('solo','en'),'');assert(!p.render('en',[]).includes('My secret language'));
 p.setScope('b');assert.equal(p.resultText('culture','en'),'');assert(!p.render('en',[]).includes('My secret language'));
 p.setScope('a');assert.equal(p.resultText('culture','en'),'North America');assert.equal(p.roleText('solo','en'),role);assert(p.render('en',chars).includes('My secret language'));
});
