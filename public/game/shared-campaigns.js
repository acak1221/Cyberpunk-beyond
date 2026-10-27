/* Shared campaigns use a separate, membership-checked server store. Personal sheets stay private. */
(function(){
'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T={ru:{title:'СОВМЕСТНЫЕ КАМПАНИИ',intro:'Общие сведения, участники и выбранные копии персонажей. Ваши личные листы не открываются другим автоматически.',access:'Ссылка на кампанию не даёт доступа к сайту: ведущий должен отдельно предоставить игроку доступ к самому сайту. Если после входа приглашение не появилось, откройте ссылку ещё раз.',open:'Открыть совместные кампании',close:'Свернуть',signin:'Для совместных кампаний необходимо войти и дождаться синхронизации.',loading:'Загрузка…',create:'Создать',name:'Название кампании',list:'Все совместные кампании',enter:'Открыть',none:'Совместных кампаний пока нет.',refresh:'Обновить',save:'Сохранить',description:'Общее описание для участников',notes:'Личные заметки ведущего',private:'Эти заметки видит только ведущий.',players:'Участники',owner:'Ведущий',player:'Игрок',you:'вы',remove:'Исключить',leave:'Покинуть кампанию',removeConfirm:'Исключить участника, удалить его опубликованные копии персонажей и отозвать все неиспользованные приглашения?',leaveConfirm:'Покинуть кампанию и удалить свои опубликованные копии персонажей?',delete:'Удалить кампанию',deleteConfirm:'Удалить совместную кампанию и её данные для всех участников?',invites:'Приглашения',newInvite:'Создать одноразовую ссылку',inviteHelp:'Ссылка действует 7 дней и может быть использована одним участником. Передавайте её только приглашённому игроку.',inviteOnce:'Скопируйте ссылку сейчас: повторно показать её нельзя.',revoke:'Отозвать',used:'использовано',revoked:'отозвано',expires:'истекает',join:'Присоединиться к кампании',joinHelp:'Приглашение будет принято только после нажатия кнопки.',joined:'Вы присоединились к кампании.',share:'Опубликовать копию персонажа',shareHelp:'Другие участники увидят только имя, роль, характеристики и HP из выбранного листа. Личные записи, снаряжение и предыстория не передаются.',select:'Выберите персонажа',publish:'Опубликовать копию',shares:'Опубликованные персонажи',unshare:'Убрать копию',unshareConfirm:'Убрать эту копию из совместной кампании?',update:'Обновить из личного листа',changed:'На сервере уже есть более новая версия. Ваш несохранённый текст сохранён ниже: скопируйте его перед загрузкой актуальной версии.',latest:'Загрузить актуальную версию',copyFirst:'Несохранённый текст будет убран с экрана. Сначала скопируйте его, если он нужен. Продолжить?',error:'Не удалось выполнить действие',offline:'Для совместной кампании требуется подключение к сети.',same:'Аккаунт изменился. Обновите страницу.',inviteLimit:'Сначала отзовите одно из 50 действующих приглашений.',inviteFailed:'Приглашение недействительно, истекло или уже использовано.',deleted:'Кампания удалена.',saved:'Сохранено.',noCharacter:'Сначала создайте личного персонажа.'},en:{title:'SHARED CAMPAIGNS',intro:'Shared information, members and selected character copies. Your personal sheets are never shared automatically.',access:'A campaign link does not grant access to the site: the owner must separately grant each player access to the site. If the invitation is missing after sign-in, open the link again.',open:'Open shared campaigns',close:'Collapse',signin:'Sign in and wait for synchronization to use shared campaigns.',loading:'Loading…',create:'Create',name:'Campaign name',list:'All shared campaigns',enter:'Open',none:'No shared campaigns yet.',refresh:'Refresh',save:'Save',description:'Shared description for members',notes:'Private GM notes',private:'Only the owner can read these notes.',players:'Members',owner:'Owner',player:'Player',you:'you',remove:'Remove',leave:'Leave campaign',removeConfirm:'Remove this member and their published character copies, and revoke all unused invitations?',leaveConfirm:'Leave this campaign and remove your published character copies?',delete:'Delete campaign',deleteConfirm:'Delete the shared campaign and its data for all members?',invites:'Invitations',newInvite:'Create single-use link',inviteHelp:'The link expires after 7 days and can be used by one member. Share it only with the intended player.',inviteOnce:'Copy this link now: it cannot be shown again.',revoke:'Revoke',used:'used',revoked:'revoked',expires:'expires',join:'Join campaign',joinHelp:'The invitation is accepted only when you press the button.',joined:'You joined the campaign.',share:'Publish a character copy',shareHelp:'Other members will see only the selected sheet’s name, role, STATs and HP. Private notes, equipment and Lifepath are not shared.',select:'Select a character',publish:'Publish copy',shares:'Published characters',unshare:'Remove copy',unshareConfirm:'Remove this copy from the shared campaign?',update:'Update from personal sheet',changed:'A newer version exists on the server. Your unsaved text is preserved below: copy it before loading the latest version.',latest:'Load latest version',copyFirst:'The unsaved text will be removed from the screen. Copy it first if needed. Continue?',error:'The action could not be completed',offline:'Shared campaigns require a network connection.',same:'The signed-in account changed. Reload the page.',inviteLimit:'Revoke one of the 50 active invitations before creating another.',inviteFailed:'The invitation is invalid, expired or already used.',deleted:'Campaign deleted.',saved:'Saved.',noCharacter:'Create a personal character first.'}};
const CT={ru:{title:'ОБЩИЙ БОЙ И ИНИЦИАТИВА',help:'Ведущий редактирует бой и сохраняет его вместе с общим описанием. Игроки видят сохранённые изменения после обновления. HP здесь не меняет личный лист персонажа.',unsupported:'Формат боя не поддерживается этой версией. Данные сохранены без изменений.',round:'Раунд',turn:'Текущий ход',none:'Участников пока нет.',name:'Имя противника или участника',ref:'REF',hp:'HP',initiative:'Инициатива',bonus:'Бонус',ties:'Переброс',add:'Добавить участника',addShare:'Добавить опубликованного персонажа',chooseShare:'Выберите опубликованную копию',noShare:'Нет опубликованных копий.',copyHelp:'При добавлении создаётся копия имени, REF и HP. Последующие изменения листа не меняют бой автоматически.',roll:'Бросить инициативу',rollHelp:'Инициатива: 1d10 + REF + бонус. При равенстве участники перебрасывают результат до разрешения ничьей (до 12 раз); если ничья сохраняется, определите порядок вручную.',next:'Следующий ход',reset:'Начать бой заново',remove:'Удалить участника',removeConfirm:'Удалить участника из общего боя?',save:'Сохранить описание и бой',limit:'В бою может быть не более 100 участников.',invalid:'Укажите имя и корректные значения REF и HP.',current:'Ход'},en:{title:'SHARED COMBAT & INITIATIVE',help:'The GM edits combat and saves it together with the shared description. Players see saved changes after refreshing. HP here does not change the personal character sheet.',unsupported:'This combat format is not supported by this version. Its data has not been changed.',round:'Round',turn:'Current turn',none:'No combatants yet.',name:'Opponent or participant name',ref:'REF',hp:'HP',initiative:'Initiative',bonus:'Bonus',ties:'Tie roll',add:'Add participant',addShare:'Add published character',chooseShare:'Choose a published copy',noShare:'No published copies.',copyHelp:'This copies name, REF and HP once. Later sheet edits do not change combat automatically.',roll:'Roll initiative',rollHelp:'Initiative: 1d10 + REF + bonus. Tied combatants reroll up to 12 times. Resolve any remaining or manually entered ties yourself.',next:'Next turn',reset:'Start encounter again',remove:'Remove combatant',removeConfirm:'Remove this participant from shared combat?',save:'Save description and combat',limit:'Combat can have at most 100 participants.',invalid:'Enter a name and valid REF and HP.',current:'Turn'}};
let generation=0,model={scope:null,open:false,selected:null,list:null,detail:null,notes:null,invites:[],shares:[],error:'',message:'',inviteLink:'',conflict:null,draftNew:'',draftName:'',draftDescription:'',draftNotes:'',draftCombat:null,combatTouched:false,combatFieldDrafts:[],combatEntry:{name:'',ref:'6',hp:'30',share:''},waitingRestore:false,busy:false,seq:0}, ctx=null;
// Keep unsaved campaign forms in memory only, keyed by the verified Site account.
// They are not rendered until a fresh, matching /api/campaigns GET succeeds.
const suspended=new Map();
const boundRoots=new WeakSet();
const label=()=>T[ctx?.lang]||T.en;
function token(){const m=location.hash.match(/^#invite=([0-9a-f]{64})$/);return m?m[1]:''}
function reset(scope){
 if(model.scope&&!model.waitingRestore)suspended.set(model.scope,model);
 const waitingRestore=!!scope&&suspended.has(scope);
 model={scope,open:waitingRestore||!!token(),selected:null,list:null,detail:null,notes:null,invites:[],shares:[],error:'',message:'',inviteLink:'',conflict:null,draftNew:'',draftName:'',draftDescription:'',draftNotes:'',draftCombat:null,combatTouched:false,combatFieldDrafts:[],combatEntry:{name:'',ref:'6',hp:'30',share:''},waitingRestore,busy:false,seq:++generation};
 const root=box();if(root)root.inert=false;
}
function same(s,seq){return model.scope===s&&model.seq===seq&&ctx?.scope===s&&(!ctx.getScope||ctx.getScope()===s)}
function box(){return document.querySelector('#shared-campaigns')}
function btn(action,text,attr=''){return `<button class="btn ghost" data-shared="${action}" ${attr}>${E(text)}</button>`}
function shell(){return '<section id="shared-campaigns" class="card shared-campaigns" aria-live="polite"></section>'}
const validInteger=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const emptyCombat=()=>({version:1,round:1,turnId:null,roster:[]});
function validCombat(c){
 if(!c||typeof c!=='object'||Array.isArray(c)||c.version!==1||!validInteger(c.round,1,999999)||!Array.isArray(c.roster)||c.roster.length>100||(c.turnId!==null&&typeof c.turnId!=='string'))return false;
 const ids=new Set();for(const r of c.roster){
  if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>160||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||!validInteger(r.ref,0,20)||!validInteger(r.hp,-999,999)||!validInteger(r.initiative,-999,999)||!validInteger(r.bonus,-99,99)||!Array.isArray(r.ties)||r.ties.length>50||!r.ties.every(x=>validInteger(x,-99,129)))return false;ids.add(r.id);
 }
 return c.turnId===null||ids.has(c.turnId);
}
function combatOrder(c){return [...c.roster].sort((a,b)=>{
 let n=b.initiative-a.initiative;if(n)return n;
 for(let i=0;i<Math.max(a.ties.length,b.ties.length);i++){n=(b.ties[i]??0)-(a.ties[i]??0);if(n)return n}return 0;
})}
function rollCombat(c){
 const roll=r=>1+Math.floor(Math.random()*10)+r.ref+r.bonus;
 for(const r of c.roster){r.initiative=roll(r);r.ties=[]}
 let groups=new Map();for(const r of c.roster){const k=String(r.initiative);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 for(let depth=0;depth<12;depth++){const tied=[...groups.values()].filter(g=>g.length>1);if(!tied.length)break;groups=new Map();for(const group of tied)for(const r of group){r.ties.push(roll(r));const k=r.initiative+':'+r.ties.join(',');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}}
 c.round=1;c.turnId=combatOrder(c)[0]?.id||null;
}
function fieldDraft(id,key){return model.combatFieldDrafts.find(d=>d.id===id&&d.key===key)}
function clearFieldDraft(id,key){model.combatFieldDrafts=model.combatFieldDrafts.filter(d=>d.id!==id||d.key!==key)}
function combatHTML(owner){
 const z=CT[ctx.lang]||CT.en,c=model.draftCombat;let content=`<div class="shared-box shared-combat"><h3>${E(z.title)}</h3><p class="muted">${E(z.help)}</p>`;
 if(!c)return content+`<p class="shared-warning">${E(z.unsupported)}</p></div>`;
 const list=combatOrder(c),current=list.findIndex(r=>r.id===c.turnId);
 content+=`<p><strong>${E(z.round)} ${c.round}</strong> · ${E(z.turn)} ${current<0?'—':E(list[current].name)}</p><p class="muted">${E(z.rollHelp)}</p>`;
 if(owner)content+=`<div class="shared-actions">${btn('combat-roll',z.roll,list.length?'':'disabled')}${btn('combat-next',z.next,list.length?'':'disabled')}${btn('combat-reset',z.reset,list.length?'':'disabled')}</div>`;
 content+=`<div class="shared-combat-list">${list.length?list.map(r=>`<div class="shared-combatant ${r.id===c.turnId?'current':''}"><div><strong>${E(r.name)}</strong>${r.id===c.turnId?` <small>▶ ${E(z.current)}</small>`:''}</div>${[['ref',z.ref,0,20],['bonus',z.bonus,-99,99],['initiative',z.initiative,-999,999],['hp',z.hp,-999,999]].map(([key,name,min,max])=>`<label>${E(name)}<input type="text" inputmode="numeric" pattern="-?[0-9]*" maxlength="8" data-combat-field="${key}" data-id="${E(r.id)}" value="${E(fieldDraft(r.id,key)?.raw??r[key])}" ${owner?'':'readonly'}></label>`).join('')}${r.ties.length?`<small>${E(z.ties)}: ${E(r.ties.join(', '))}</small>`:''}${owner?btn('combat-remove',z.remove,`data-id="${E(r.id)}"`):''}</div>`).join(''):`<p class="muted">${E(z.none)}</p>`}</div>`;
 if(owner){content+=`<div class="shared-combat-form"><label class="field">${E(z.name)}<input id="shared-combat-name" maxlength="100" value="${E(model.combatEntry.name)}"></label><label class="field">${E(z.ref)}<input id="shared-combat-ref" type="number" min="0" max="20" value="${E(model.combatEntry.ref)}"></label><label class="field">${E(z.hp)}<input id="shared-combat-hp" type="number" min="-999" max="999" value="${E(model.combatEntry.hp)}"></label>${btn('combat-add',z.add)}</div>`;
  content+=`<p class="muted">${E(z.copyHelp)}</p><label class="field">${E(z.chooseShare)}<select id="shared-combat-share"><option value="">${E(z.chooseShare)}</option>${model.shares.map(s=>`<option value="${E(s.id)}" ${s.id===model.combatEntry.share?'selected':''}>${E(s.data?.name||'—')}</option>`).join('')}</select></label>${model.shares.length?btn('combat-add-share',z.addShare):`<p class="muted">${E(z.noShare)}</p>`}<div class="shared-actions">${btn('save-shared',z.save)}</div>`;
 }
 return content+'</div>';
}
function render(){
 const root=box();if(!root||!ctx)return;const t=label();let content=`<div class="card-heading"><span>${E(t.title)}</span><span>ONLINE</span></div><p>${E(t.intro)}</p><p class="muted">${E(t.access)}</p>`;
 if(!model.scope){root.innerHTML=content+`<p class="shared-warning">${E(t.signin)}</p>`;return}
 content+=btn('toggle',model.open?t.close:t.open);
 if(!model.open){root.innerHTML=content;return}
 if(model.error)content+=`<p class="shared-error" role="alert">${E(model.error)}</p>`;
 if(model.message)content+=`<p class="shared-warning">${E(model.message)}</p>`;
 if(model.waitingRestore){content+=`<p class="shared-warning">${E(ctx.lang==='ru'?'Черновик сохранён в этой вкладке. Для его открытия подтвердите тот же аккаунт соединением с сайтом.':'Your draft is held in this tab. Reconnect to verify the same account before opening it.')}</p>${model.busy?'':btn('verify-draft',t.refresh)}`;root.innerHTML=content;return}
 if(token())content+=`<div class="shared-box"><p>${E(t.joinHelp)}</p>${btn('join',t.join)}</div>`;
 if(model.busy)content+=`<p>${E(t.loading)}</p>`;
 if(model.conflict){content+=`<div class="shared-box"><p class="shared-warning">${E(t.changed)}</p><pre>${E(model.conflict)}</pre>${btn('resolve',t.latest)}</div>`;root.innerHTML=content;return}
 if(!model.selected){
  content+=`<div class="shared-box"><label class="field">${E(t.name)}<input id="shared-new-name" maxlength="100" value="${E(model.draftNew)}"></label><div class="shared-actions">${btn('create',t.create)} ${btn('refresh',t.refresh)}</div></div>`;
  content+=`<h3>${E(t.list)}</h3><div class="shared-grid">${(model.list||[]).map(c=>`<div class="shared-box"><strong>${E(c.name)}</strong><p>${E(c.role==='owner'?t.owner:t.player)}</p>${btn('open',t.enter,`data-id="${E(c.id)}"`)}</div>`).join('')||`<p class="muted">${E(t.none)}</p>`}</div>`;
 } else if(model.detail){
  const d=model.detail, owner=d.role==='owner';
  content+=`<div class="shared-actions">${btn('back','← '+t.list)} ${btn('refresh',t.refresh)}</div><h2>${E(d.name)}</h2><p class="muted">${E(owner?t.owner:t.player)}</p>`;
  content+=`<div class="shared-box">${owner?`<label class="field">${E(t.name)}<input id="shared-name" maxlength="100" value="${E(model.draftName)}"></label>`:''}<label class="field">${E(t.description)}<textarea id="shared-description" maxlength="8000" ${owner?'':'readonly'}>${E(model.draftDescription)}</textarea></label>${owner?btn('save-shared',t.save):''}</div>`;
  content+=combatHTML(owner);
  if(owner&&model.notes)content+=`<div class="shared-box"><h3>${E(t.notes)}</h3><p class="muted">${E(t.private)}</p><label class="field"><textarea id="shared-notes" maxlength="50000">${E(model.draftNotes)}</textarea></label>${btn('save-notes',t.save)}</div>`;
  content+=`<div class="shared-box"><h3>${E(t.players)}</h3><div class="shared-member-list">${d.members.map((m,i)=>`<div class="shared-row"><span>${E(m.role==='owner'?t.owner:t.player)} #${i+1}${m.mine?' · '+E(t.you):''}</span>${m.role==='player'&&(owner||m.mine)?btn('remove-member',m.mine?t.leave:t.remove,`data-id="${E(m.id)}" data-mine="${m.mine?'1':'0'}"`):''}</div>`).join('')}</div></div>`;
  if(owner){content+=`<div class="shared-box"><h3>${E(t.invites)}</h3><p>${E(t.inviteHelp)}</p>${btn('invite',t.newInvite)}${model.inviteLink?`<p class="shared-warning">${E(t.inviteOnce)}</p><input class="shared-mono" readonly value="${E(model.inviteLink)}" aria-label="${E(t.inviteOnce)}">`:''}<div class="shared-invite-list">${model.invites.map(i=>`<div class="shared-row"><span>${E(i.revokedAt?t.revoked:i.usedAt?t.used:t.expires+' '+new Date(i.expiresAt).toLocaleDateString(ctx.lang))}</span>${!i.revokedAt&&!i.usedAt&&i.expiresAt>Date.now()?btn('revoke',t.revoke,`data-id="${E(i.id)}"`):''}</div>`).join('')}</div></div>`}
  content+=`<div class="shared-box"><h3>${E(t.shares)}</h3>${model.shares.map(s=>`<div class="shared-row"><div><strong>${E(s.data?.name||'—')}</strong><p class="muted">${E(s.data?.role||'')} · HP ${E(s.data?.hp??'—')} · ${E(d.members.find(m=>m.id===s.memberId)?.role==='owner'?t.owner:t.player)} #${d.members.findIndex(m=>m.id===s.memberId)+1||'?'}</p><p class="muted">${E(Object.entries(s.data?.stats||{}).map(([k,v])=>k+' '+v).join(' · '))}</p></div>${s.mine?`<div class="shared-actions">${ctx.characters.length?btn('update-share',t.update,`data-id="${E(s.id)}"`):''}${btn('unshare',t.unshare,`data-id="${E(s.id)}"`)}</div>`:''}</div>`).join('')}<h3>${E(t.share)}</h3><p class="muted">${E(t.shareHelp)}</p><label class="field">${E(t.select)}<select id="shared-character">${ctx.characters.map(c=>`<option value="${E(c.id)}">${E(c.name)} · ${E(c.role)}</option>`).join('')}</select></label>${ctx.characters.length?btn('publish',t.publish):`<p>${E(t.noCharacter)}</p>`}</div>`;
  if(owner)content+=`<div class="shared-actions">${btn('delete',t.delete)}</div>`;
 }
 root.innerHTML=content;
}
async function request(path,method='GET',body){
 const s=model.scope,seq=model.seq;const options={method,credentials:'same-origin',headers:{Accept:'application/json'}};
 if(method!=='GET'){options.headers['Content-Type']='application/json';options.body=JSON.stringify({scope:s,...body})}
 let response=await fetch('/api/campaigns'+path,options),data=await response.json().catch(()=>({}));
 if(!same(s,seq)||(method==='GET'&&response.ok&&data.scope!==s))throw Object.assign(new Error('account_changed'),{code:'account_changed'});
 if(!response.ok)throw Object.assign(new Error(data.error||'request_failed'),{code:data.error||'request_failed',status:response.status});return data;
}
async function loadList(){
 const r=await request('');
 if(model.waitingRestore){
  const previous=suspended.get(model.scope);if(!previous)throw Object.assign(new Error('missing_draft'),{code:'missing_draft'});
  const seq=model.seq,busy=model.busy;let available=!previous.selected||r.campaigns.some(c=>c.id===previous.selected);
  suspended.delete(model.scope);model=previous;model.seq=seq;model.busy=busy;model.waitingRestore=false;model.list=r.campaigns;
  if(!available){
   const previousConflict=model.conflict;
   if(dirty()||previousConflict)preserveConflict({reason:'campaign_no_longer_accessible',previousConflict});
   model.selected=null;model.detail=null;model.notes=null;model.invites=[];model.shares=[];model.inviteLink='';
  }
  return;
 }
 model.list=r.campaigns;
}
async function loadDetail(id){
 const d=await request('/'+encodeURIComponent(id)),owner=d.role==='owner';
 const parts=await Promise.all([request('/'+id+'/shares'),...(owner?[request('/'+id+'/notes'),request('/'+id+'/invites')]:[])]);
 model.detail=d;model.selected=id;model.shares=parts[0].shares;model.notes=owner?parts[1]:null;model.invites=owner?parts[2].invites:[];
 model.draftName=d.name;model.draftDescription=typeof d.shared?.description==='string'?d.shared.description:'';model.draftNotes=model.notes?.notes||'';
 const combat=d.shared?.combat;model.draftCombat=combat===undefined?emptyCombat():validCombat(combat)?JSON.parse(JSON.stringify(combat)):null;model.combatTouched=false;model.combatFieldDrafts=[];model.combatEntry={name:'',ref:'6',hp:'30',share:''};
}
function snapshot(c){const stats={};for(const k of ['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'])if(Number.isFinite(Number(c.stats?.[k])))stats[k]=Number(c.stats[k]);return {name:String(c.name||'').slice(0,100),role:String(c.role||'').slice(0,100),hp:Number.isFinite(Number(c.hp))?Number(c.hp):0,stats};}
function preserveConflict(attempt){model.conflict=JSON.stringify({campaignName:model.draftName,sharedDescription:model.draftDescription,...model.notes?{privateNotes:model.draftNotes}:{},...model.combatTouched?{combat:model.draftCombat}:{},...model.combatFieldDrafts.length?{pendingCombatFields:model.combatFieldDrafts}:{},...model.combatEntry.name.trim()?{pendingCombatant:model.combatEntry}:{},attempt},null,2)}
function dirtyModel(m){return !!m.detail&&(m.draftName!==m.detail.name||m.draftDescription!==(m.detail.shared?.description||'')||!!m.notes&&m.draftNotes!==m.notes.notes||m.combatTouched||m.combatFieldDrafts.length>0||!!m.combatEntry.name.trim())}
function dirty(){return dirtyModel(model)}
function unsaved(m){return !!m.conflict||!!m.draftNew.trim()||dirtyModel(m)}
function combatValue(v,min,max){if(typeof v!=='string'||!v.trim()||!/^-?\d+$/.test(v.trim()))return null;const n=Number(v);return validInteger(n,min,max)?n:null}
function combatId(){return globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2)}
function addCombatant(name,ref,hp){const c=model.draftCombat,z=CT[ctx.lang]||CT.en;
 if(c.roster.length>=100){model.error=z.limit;return}
 if(typeof name!=='string'||!name.trim()||name.length>100||!validInteger(ref,0,20)||!validInteger(hp,-999,999)){model.error=z.invalid;return}
 let id=combatId();if(c.roster.some(r=>r.id===id)){model.error=z.invalid;return}
 c.roster.push({id,name:name.trim(),ref,hp,initiative:0,bonus:0,ties:[]});model.combatTouched=true;
}
function combatAction(action,b){
 const c=model.draftCombat,z=CT[ctx.lang]||CT.en;if(model.detail?.role!=='owner'||!c)return;
 if(action==='combat-add'){let ref=combatValue(model.combatEntry.ref,0,20),hp=combatValue(model.combatEntry.hp,-999,999);addCombatant(model.combatEntry.name,ref,hp);if(!model.error)model.combatEntry.name='';return}
 if(action==='combat-add-share'){const sh=model.shares.find(s=>s.id===model.combatEntry.share);if(!sh){model.error=z.invalid;return}const ref=Number(sh.data?.stats?.REF),hp=Number(sh.data?.hp);addCombatant(String(sh.data?.name||''),Math.max(0,Math.min(20,Math.trunc(ref))),Math.max(-999,Math.min(999,Math.trunc(hp))));return}
 if(action==='combat-remove'){const index=combatOrder(c).findIndex(r=>r.id===b.dataset.id);if(index<0||!confirm(z.removeConfirm))return;const wasCurrent=c.turnId===b.dataset.id;c.roster=c.roster.filter(r=>r.id!==b.dataset.id);model.combatFieldDrafts=model.combatFieldDrafts.filter(d=>d.id!==b.dataset.id);if(wasCurrent){const next=combatOrder(c);c.turnId=next[Math.min(index,next.length-1)]?.id||null}model.combatTouched=true;return}
 if(!c.roster.length)return;
 if(action==='combat-roll'){rollCombat(c);model.combatTouched=true;return}
 if(action==='combat-reset'){c.round=1;c.turnId=combatOrder(c)[0]?.id||null;model.combatTouched=true;return}
 if(action==='combat-next'){const order=combatOrder(c),i=order.findIndex(r=>r.id===c.turnId);if(i<0)c.turnId=order[0].id;else if(i+1<order.length)c.turnId=order[i+1].id;else{if(c.round>=999999){model.error=z.limit;return}c.round++;c.turnId=order[0].id}model.combatTouched=true}
}
async function action(action,b){
 const t=label(),id=model.selected;model.error='';model.message='';
 if(action==='verify-draft'){if(model.waitingRestore)await loadList();return}
 if(action==='toggle'){model.open=!model.open;if(model.open&&model.list===null)await loadList();return}
 if(action==='resolve'){if(!confirm(t.copyFirst))return;model.conflict=null;if(id)await loadDetail(id);else await loadList();return}
 if(action==='refresh'){if(dirty()&&!confirm(t.copyFirst))return;if(id)await loadDetail(id);else await loadList();return}
 if(action==='join'){if(dirty()&&!confirm(t.copyFirst))return;const inv=token();if(!inv)return;const x=await request('/join','POST',{token:inv});history.replaceState(null,'',location.pathname+location.search);await loadList();await loadDetail(x.campaignId);model.message=t.joined;return}
 if(action==='create'){const name=model.draftNew.trim();if(!name)return;const x=await request('','POST',{name});model.draftNew='';await loadList();await loadDetail(x.id);return}
 if(action==='back'){if(dirty()&&!confirm(t.copyFirst))return;model.selected=null;model.detail=null;model.inviteLink='';await loadList();return}
 if(action==='open'){await loadDetail(b.dataset.id);return}
 if(!id||!model.detail)return;
 if(action.startsWith('combat-')){combatAction(action,b);return}
 if(action==='save-shared'){if(model.combatFieldDrafts.length){model.error=(CT[ctx.lang]||CT.en).invalid;return}const draft={name:model.draftName,shared:{...model.detail.shared,description:model.draftDescription,...model.combatTouched?{combat:JSON.parse(JSON.stringify(model.draftCombat))}:{}}};try{const out=await request('/'+id,'PUT',{revision:model.detail.revision,...draft});model.detail={...model.detail,...draft,revision:out.revision};model.combatTouched=false;model.message=t.saved}catch(e){if(e.status===409&&e.code==='revision_conflict'){preserveConflict(draft);return}throw e}return}
 if(action==='save-notes'){const draft=model.draftNotes;try{let out=await request('/'+id+'/notes','PUT',{revision:model.notes.revision,notes:draft});model.notes={revision:out.revision,notes:draft};model.message=t.saved}catch(e){if(e.status===409&&e.code==='revision_conflict'){preserveConflict({notes:draft});return}throw e}return}
 if(action==='invite'){const x=await request('/'+id+'/invites','POST',{});model.inviteLink=location.origin+location.pathname+'#invite='+x.token;model.invites=(await request('/'+id+'/invites')).invites;return}
 if(action==='revoke'){await request('/'+id+'/invites','DELETE',{inviteId:b.dataset.id});model.invites=(await request('/'+id+'/invites')).invites;return}
 if(action==='remove-member'){if(dirty()&&!confirm(t.copyFirst))return;if(!confirm(b.dataset.mine==='1'?t.leaveConfirm:t.removeConfirm))return;await request('/'+id+'/members','DELETE',{memberId:b.dataset.id});if(b.dataset.mine==='1'){model.selected=null;model.detail=null;await loadList()}else await loadDetail(id);return}
 if(action==='delete'){if(!confirm(t.deleteConfirm))return;await request('/'+id,'DELETE',{});model.selected=null;model.detail=null;model.message=t.deleted;await loadList();return}
 if(action==='publish'){const character=ctx.characters.find(c=>c.id===box().querySelector('#shared-character')?.value);if(!character)return;await request('/'+id+'/shares','POST',{data:snapshot(character)});model.shares=(await request('/'+id+'/shares')).shares;model.message=t.saved;return}
 if(action==='update-share'){const character=ctx.characters.find(c=>c.id===box().querySelector('#shared-character')?.value),sh=model.shares.find(x=>x.id===b.dataset.id&&x.mine);if(!character||!sh)return;if(!confirm((ctx.lang==='ru'?'Заменить копию «':'Replace copy “')+String(sh.data?.name||'—')+(ctx.lang==='ru'?'» данными листа «':'” with the selected sheet “')+String(character.name||'—')+(ctx.lang==='ru'?'»?':'”?')))return;const data=snapshot(character);try{await request('/'+id+'/shares/'+sh.id,'PUT',{revision:sh.revision,data});model.shares=(await request('/'+id+'/shares')).shares;model.message=t.saved}catch(e){if(e.status===409&&e.code==='revision_conflict'){preserveConflict(data);return}throw e}return}
 if(action==='unshare'){if(!confirm(t.unshareConfirm))return;const sh=model.shares.find(x=>x.id===b.dataset.id&&x.mine);if(!sh)return;try{await request('/'+id+'/shares/'+sh.id,'DELETE',{revision:sh.revision});model.shares=(await request('/'+id+'/shares')).shares}catch(e){if(e.status===409&&e.code==='revision_conflict'){preserveConflict(sh.data);return}throw e}}
}
function mount(options){
 ctx=options;if(model.scope!==options.scope)reset(options.scope);render();const root=box();if(!root)return;root.inert=!!model.busy;
 if(!boundRoots.has(root)){
  boundRoots.add(root);
  root.addEventListener('input',e=>{const target=e.target;if(target.id==='shared-new-name')model.draftNew=target.value;if(target.id==='shared-name')model.draftName=target.value;if(target.id==='shared-description')model.draftDescription=target.value;if(target.id==='shared-notes')model.draftNotes=target.value;if(model.detail?.role==='owner'){if(target.id==='shared-combat-name')model.combatEntry.name=target.value.slice(0,100);if(target.id==='shared-combat-ref')model.combatEntry.ref=target.value;if(target.id==='shared-combat-hp')model.combatEntry.hp=target.value;const key=target.dataset?.combatField,id=target.dataset?.id,entry=model.draftCombat?.roster.find(r=>r.id===id);if(entry&&['ref','bonus','initiative','hp'].includes(key)){const raw=String(target.value);clearFieldDraft(id,key);if(raw!==String(entry[key]))model.combatFieldDrafts.push({id,key,raw})}}});
  root.addEventListener('change',e=>{const target=e.target;if(model.detail?.role!=='owner'||!model.draftCombat)return;if(target.id==='shared-combat-share'){model.combatEntry.share=target.value;return}const key=target.dataset.combatField,id=target.dataset.id;if(!key)return;const limits={ref:[0,20],bonus:[-99,99],initiative:[-999,999],hp:[-999,999]},range=limits[key],entry=model.draftCombat.roster.find(r=>r.id===id);if(!range||!entry)return;const n=combatValue(target.value,...range);if(n===null){clearFieldDraft(id,key);model.combatFieldDrafts.push({id,key,raw:String(target.value)});model.error=(CT[ctx.lang]||CT.en).invalid}else {model.error='';clearFieldDraft(id,key);if(entry[key]!==n){entry[key]=n;if(key==='initiative')entry.ties=[];model.combatTouched=true}}render()});
  root.addEventListener('click',async e=>{const b=e.target.closest('[data-shared]');if(!b)return;e.stopPropagation();if(model.busy)return;if(ctx.getScope&&ctx.getScope()!==model.scope){reset(null);render();return}model.busy=true;root.inert=true;let seq=model.seq;try{await action(b.dataset.shared,b)}catch(err){if(model.seq===seq){const t=label();if(err.code==='account_changed'||err.status===401||err.status===403){reset(null);render();return}model.error=err.code==='invite_limit'?t.inviteLimit:err.code==='invalid_or_used_invite'?t.inviteFailed:!navigator.onLine?t.offline:t.error+' ('+(err.status||'network')+')'}}finally{if(model.seq===seq){root.inert=false;const current=box();if(current)current.inert=false;model.busy=false;render()}}});
 }
 if(model.open&&model.list===null&&!model.busy&&model.scope){model.busy=true;root.inert=true;const seq=model.seq;loadList().catch(e=>{if(model.seq===seq){if(e.code==='account_changed'||e.status===401||e.status===403){reset(null);render();return}model.error=label().error+' ('+(e.status||'network')+')'}}).finally(()=>{if(model.seq===seq){root.inert=false;const current=box();if(current)current.inert=false;model.busy=false;render()}})}
}
let navigated=false;
function shouldNavigate(){if(!navigated&&token()){navigated=true;return true}return false}
function setScope(scope){if(model.scope!==scope){reset(scope);if(ctx)ctx={...ctx,scope,characters:[]};render()}}
globalThis.addEventListener?.('beforeunload',event=>{if(unsaved(model)||[...suspended.values()].some(unsaved)){event.preventDefault();event.returnValue='';return ''}});
window.SharedCampaigns={shell,mount,shouldNavigate,setScope};
})();
