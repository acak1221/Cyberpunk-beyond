/* A short, bilingual route into the companion's main workflows. */
(function(){
'use strict';
const copy={
 ru:{title:'С чего начать',intro:'Четыре шага для первой игры и подсказка, где искать остальные инструменты.',steps:[
  ['Создайте персонажа','Откройте создание персонажа и выберите стартовый метод. Готовый лист можно редактировать, экспортировать и распечатать.','Создать персонажа','new',''],
  ['Подключите книгу','В разделе «Книга» выберите свой PDF Corebook. Файл остаётся в браузере; после перезагрузки выберите его снова. Ссылки на страницы в инструментах открывают соответствующую страницу.','Открыть книгу','navigate','book'],
  ['Подготовьте игру','В разделе «Кампании» можно вести личные заметки и инициативу. В разделе «Ведущему» находятся инструменты для подготовки игры; совместные кампании доступны в разделе кампаний.','Открыть кампании','navigate','campaigns'],
  ['Проверьте бой и лечение','Разделы «Бой» и «Медицина» помогают с проверками и состоянием персонажей. Читайте подсказки: некоторые решения и эффекты нужно подтвердить или учесть вручную.','Открыть бой','navigate','combat']
 ],saveTitle:'Сохранение и резервная копия',save:'Состояние сохранения показано над приложением и в листе. Дождитесь синхронизации перед сменой устройства. В разделе «Персонажи» можно скачать резервную копию личных данных; совместные кампании хранятся отдельно и в неё не входят. При конфликте следуйте инструкциям на экране и сначала сохраните предлагаемый черновик.',saveButton:'Перейти к персонажам'},
 en:{title:'Getting started',intro:'Four steps for your first game and a guide to the other tools.',steps:[
  ['Create a character','Open the character builder and choose a starting method. You can edit, export and print the resulting sheet.','Create character','new',''],
  ['Connect your book','In Book, choose your own Corebook PDF. The file stays in your browser; select it again after a reload. Page links in tools open the corresponding page.','Open book','navigate','book'],
  ['Prepare the game','Use Campaigns for personal notes and initiative. GM tools help you prepare the game; shared campaigns are available in Campaigns.','Open campaigns','navigate','campaigns'],
  ['Check combat and healing','Combat and Medicine help with checks and character condition. Read the on-screen notes: some decisions and effects need confirmation or manual tracking.','Open combat','navigate','combat']
 ],saveTitle:'Saving and backups',save:'The save status appears above the application and on the character sheet. Wait for sync before changing devices. Download a backup of personal data from Characters; shared campaigns are stored separately and are not included. If a conflict appears, follow the on-screen instructions and save the offered draft first.',saveButton:'Go to characters'}
};
function render(lang){const t=copy[lang==='en'?'en':'ru'];return `<details class="getting-started"><summary>${t.title}</summary><p>${t.intro}</p><ol>${t.steps.map(([heading,body,button,action,view])=>`<li><h3>${heading}</h3><p>${body}</p><button class="btn ghost" type="button" data-action="${action}"${view?` data-view="${view}"`:''}>${button} ↗</button></li>`).join('')}</ol><div class="getting-started-save"><h3>${t.saveTitle}</h3><p>${t.save}</p><button class="btn ghost" type="button" data-action="navigate" data-view="characters">${t.saveButton} ↗</button></div></details>`}
window.GettingStarted={render};
})();
