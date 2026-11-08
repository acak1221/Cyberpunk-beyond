/* In-page navigation for the combat reference and tools. */
(function(){
'use strict';
const entries=[['overview','Дальность, броня и ранения','Range, armor & injuries'],['autofire','Автоматический огонь','Autofire'],['area','Площадные атаки','Area attacks'],['grapple','Рукопашный бой и захват','Brawling & grappling'],['hazards','Опасности среды','Environmental hazards'],['vehicles','Транспорт и погони','Vehicles & chases'],['martial','Боевые искусства','Martial arts'],['weapons','Оружие и модификации','Weapons & attachments']];
function render(lang){const ru=lang!=='en';return `<nav class="combat-navigation card" aria-label="${ru?'Разделы боевых инструментов':'Combat tool sections'}"><strong>${ru?'БЫСТРЫЙ ПЕРЕХОД':'QUICK LINKS'}</strong><div>${entries.map(([id,r,e])=>`<a href="#combat-${id}">${ru?r:e}</a>`).join('')}</div></nav>`}
function wrap(id,content){return `<div id="combat-${id}" class="combat-section">${content||''}</div>`}
window.CombatNavigation={render,wrap};
})();
