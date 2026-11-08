/* Show the complete current contents of sheet text fields when printing. */
(function(global){
'use strict';
let mirrors=[];
function clear(){for(const pair of mirrors){pair.source.classList.remove('sheet-print-source');pair.mirror.remove()}mirrors=[]}
function prepare(){
 clear();
 const root=global.document?.querySelector('.sheet-layout');
 if(!root)return;
 for(const source of root.querySelectorAll('textarea, input[type="text"], input:not([type])')){
  const mirror=global.document.createElement('span');
  mirror.className='sheet-print-text';
  mirror.textContent=source.value;
  mirror.setAttribute('aria-hidden','true');
  source.insertAdjacentElement('afterend',mirror);
  source.classList.add('sheet-print-source');
  mirrors.push({source,mirror});
 }
}
global.addEventListener('beforeprint',prepare);
global.addEventListener('afterprint',clear);
})(window);
