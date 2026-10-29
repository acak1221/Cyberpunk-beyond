/* A short, bilingual route into the companion's main workflows. */
(function(){
'use strict';
const copy={
 ru:{title:'С чего начать',intro:'Четыре шага для первой игры и подсказка, где искать остальные инструменты.',steps:[
  ['Создайте персонажа','Откройте создание персонажа и выберите стартовый метод. Готовый лист можно редактировать, экспортировать и распечатать.','Создать персонажа','new',''],
  ['Подключите книгу','В разделе «Книга» выберите свой PDF Corebook. Файл остаётся в браузере; после перезагрузки выберите его снова. Ссылки на страницы в инструментах открывают соответствующую страницу.','Открыть книгу','navigate','book'],
  ['Подготовьте игру','В разделе «Кампании» можно вести личные заметки и инициативу. В разделе «Ведущему» находятся инструменты для подготовки игры; совместные кампании доступны в разделе кампаний.','Открыть кампании','navigate','campaigns'],
  ['Проверьте бой и лечение','Разделы «Бой» и «Медицина» помогают с проверками и состоянием персонажей. Читайте подсказки: некоторые решения и эффекты нужно подтвердить или учесть вручную.','Открыть бой','navigate','combat']
 ],directoryTitle:'Где найти инструменты',directory:[
  ['Персонажи','Листы, экипировка, способности роли и история персонажа.','characters'],
  ['Жизненный путь','Происхождение, связи и прошлое персонажа.','lifepath'],
  ['Правила','Поиск и краткие справки по правилам.','rules'],
  ['Каталог','Оружие, броня, импланты, транспорт, услуги и другое снаряжение.','catalog'],
  ['Бой','Атаки, урон, захваты, опасности и транспорт.','combat'],
  ['Нетраннинг','Действия, программы и архитектура Сети.','net'],
  ['Медицина','Лечение, критические ранения, терапия и вещества.','medical'],
  ['Ремонт и создание','Ремонт, изготовление и проекты техника.','repair'],
  ['Ведущему','NPC, встречи и инструменты подготовки игры.','gm'],
  ['Кубики','Броски навыков и произвольные кубики.','dice'],
  ['Кампании','Личные и совместные кампании, участники и инициатива.','campaigns'],
  ['Книга','Свой PDF, оглавление, поиск и закладки.','book']
 ],saveTitle:'Сохранение и резервная копия',save:'Состояние сохранения показано над приложением и в листе. Дождитесь синхронизации перед сменой устройства. В разделе «Персонажи» можно скачать резервную копию личных данных; совместные кампании хранятся отдельно и в неё не входят. При конфликте следуйте инструкциям на экране и сначала сохраните предлагаемый черновик.',saveButton:'Перейти к персонажам'},
 en:{title:'Getting started',intro:'Four steps for your first game and a guide to the other tools.',steps:[
  ['Create a character','Open the character builder and choose a starting method. You can edit, export and print the resulting sheet.','Create character','new',''],
  ['Connect your book','In Book, choose your own Corebook PDF. The file stays in your browser; select it again after a reload. Page links in tools open the corresponding page.','Open book','navigate','book'],
  ['Prepare the game','Use Campaigns for personal notes and initiative. GM tools help you prepare the game; shared campaigns are available in Campaigns.','Open campaigns','navigate','campaigns'],
  ['Check combat and healing','Combat and Medicine help with checks and character condition. Read the on-screen notes: some decisions and effects need confirmation or manual tracking.','Open combat','navigate','combat']
 ],directoryTitle:'Find your tools',directory:[
  ['Characters','Sheets, equipment, role abilities and character history.','characters'],
  ['Lifepath','Character origins, connections and background.','lifepath'],
  ['Rules','Search and quick rules references.','rules'],
  ['Catalog','Weapons, armor, cyberware, vehicles, services and other gear.','catalog'],
  ['Combat','Attacks, damage, grappling, hazards and vehicles.','combat'],
  ['Netrunning','Actions, programs and NET architectures.','net'],
  ['Medicine','Treatment, critical injuries, therapy and drugs.','medical'],
  ['Repair and crafting','Repair, fabrication and Tech projects.','repair'],
  ['GM tools','NPCs, encounters and session preparation.','gm'],
  ['Dice','Skill checks and custom dice.','dice'],
  ['Campaigns','Personal and shared campaigns, participants and initiative.','campaigns'],
  ['Book','Your PDF, contents, search and bookmarks.','book']
 ],saveTitle:'Saving and backups',save:'The save status appears above the application and on the character sheet. Wait for sync before changing devices. Download a backup of personal data from Characters; shared campaigns are stored separately and are not included. If a conflict appears, follow the on-screen instructions and save the offered draft first.',saveButton:'Go to characters'}
};
function render(lang){const t=copy[lang==='en'?'en':'ru'];return `<details class="getting-started"><summary>${t.title}</summary><p>${t.intro}</p><ol>${t.steps.map(([heading,body,button,action,view])=>`<li><h3>${heading}</h3><p>${body}</p><button class="btn ghost" type="button" data-action="${action}"${view?` data-view="${view}"`:''}>${button} ↗</button></li>`).join('')}</ol><div class="getting-started-directory"><h3>${t.directoryTitle}</h3><div>${t.directory.map(([title,description,view])=>`<button type="button" data-action="navigate" data-view="${view}"><strong>${title} ↗</strong><span>${description}</span></button>`).join('')}</div></div><div class="getting-started-save"><h3>${t.saveTitle}</h3><p>${t.save}</p><button class="btn ghost" type="button" data-action="navigate" data-view="characters">${t.saveButton} ↗</button></div></details>`}
window.GettingStarted={render};
})();
