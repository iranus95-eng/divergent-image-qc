(function(){
'use strict';
const LABEL='ใบเสร็จรับเงิน-ใบกำกับภาษี';
let queued=false;
function fix(){
  queued=false;
  const grid=document.getElementById('homeMenuGrid5');
  if(!grid)return;
  const matches=[...grid.querySelectorAll('.home-menu5-card')].filter(card=>{
    const title=card.querySelector('.home-menu5-copy b');
    return title&&String(title.textContent||'').includes(LABEL);
  });
  if(!matches.length)return;
  const keep=matches.find(card=>card.hasAttribute('data-receipt-tax-card'))||matches[0];
  matches.forEach(card=>{if(card!==keep)card.remove()});
  const title=keep.querySelector('.home-menu5-copy b');
  const sub=keep.querySelector('.home-menu5-copy span');
  const icon=keep.querySelector('.home-menu5-icon');
  if(title)title.textContent=LABEL;
  if(sub)sub.textContent='สร้างใบเสร็จรับเงินและใบกำกับภาษี';
  if(icon)icon.textContent='▤';
}
function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(fix);
}
function boot(){
  fix();
  const root=document.body;
  if(root)new MutationObserver(muts=>{
    for(const m of muts){
      if(m.type==='childList'&&m.addedNodes.length){schedule();break;}
    }
  }).observe(root,{childList:true,subtree:true});
  [100,400,800,1400,2200,4200].forEach(ms=>setTimeout(fix,ms));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
