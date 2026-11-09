'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const SITE=path.join(__dirname,'../site');
// Lifepath tables and the book's own chapter titles keep the corebook's voice ("Что у тебя при себе").
const BOOK_VOICE=new Set(['lifepath.js','book-toc.js']);
const files=fs.readdirSync(SITE).filter(f=>f.endsWith('.js')&&!BOOK_VOICE.has(f));
const src=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(SITE,f),'utf8')]));
const WORD=/(?<![А-Яа-яЁё])[А-Яа-яЁё]{3,}(?![А-Яа-яЁё])/g;
function hits(words){const out=[];for(const [f,t] of Object.entries(src))for(const m of t.matchAll(WORD)){const w=m[0].toLowerCase();if(words.has(w))out.push(`${f}: …${t.slice(Math.max(0,m.index-40),m.index+w.length+20).replace(/\s+/g,' ')}…`)}return out}

test('Russian interface text addresses the user formally (no informal imperatives)',()=>{
 // Every formal imperative the interface uses ("Выберите", "проверьте", "убедитесь") must not
 // also appear in its informal form ("Выбери", "проверь", "убедись").
 const informal=new Set(['распредели','подтверди','проверь','уточни','продолжи','подбери','исправь','выбери','брось','нажми','введи','укажи','добавь','отметь','заполни','сохрани','открой','вернись','перейди','используй','попробуй','убедись','запиши','измени','загрузи','скопируй','удали','создай','подожди','возьми','оставь','потрать','прибавь','начни','задай','учитывай','проверяй','записывай','примени','отправь','сделай','найди','посмотри']);
 for(const t of Object.values(src))for(const m of t.matchAll(/(?<![А-Яа-яЁё])([А-Яа-яЁё]{3,}[иьй])те(сь)?(?![А-Яа-яЁё])/g))informal.add((m[1]+(m[2]?'сь':'')).toLowerCase());
 assert.deepEqual(hits(informal),[]);
});
test('Russian interface text has no informal pronouns or "ты" verb forms',()=>{
 assert.deepEqual(hits(new Set(['ты','тебя','тебе','тобой','твой','твоя','твоё','твое','твои','твоего','твоей','твоих','твоим','твоими','твою'])),[]);
 const verbs=[];for(const [f,t] of Object.entries(src))for(const m of t.matchAll(/(?<![А-Яа-яЁё])[а-яё]{2,}(?:ешь|ишь|ёшь)(?:ся)?(?![А-Яа-яЁё])/gi))verbs.push(`${f}: ${m[0]}`);
 assert.deepEqual(verbs,[],'second-person singular verbs such as «ценишь»');
 assert.match(src['character-extra.js'],/valued:'Главная ценность'/,'the sheet uses the lifepath card title');
});
test('creation wizards use the formal forms',()=>{
 const b=src['builder.js'],q=src['quick-builder.js'];
 assert.match(b,/Распределите ровно 62 очка/);assert.match(b,/Распределите 86 очков/);assert.match(b,/Перед созданием проверьте:/);
 assert.match(q,/Подтвердите стартовое снаряжение/);assert.match(q,/Распределите 86 очков/);assert.match(q,/проверьте их эффекты/);
});
