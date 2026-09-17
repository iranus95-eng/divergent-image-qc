/* After closing a paper cycle, immediately open the next month for staggered site completion. */
(function(){
'use strict';
let installed=false;
function nextMonth(v){
  const m=/^(\d{4})-(\d{2})$/.exec(String(v||''));
  if(!m)return '';
  const d=new Date(Number(m[1]),Number(m[2])-1,1);
  d.setMonth(d.getMonth()+1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function switchToNextIfClosed(){
  const status=(document.getElementById('poCycleStatus')?.textContent||'').trim().toUpperCase();
  if(status!=='CLOSED')return false;
  const monthInput=document.getElementById('poMonth');
  const current=monthInput?.value||'';
  const nm=nextMonth(current);
  if(!nm||!monthInput)return false;
  monthInput.value=nm;
  monthInput.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
}
function install(){
  if(installed||typeof window.paperOrderCloseCycle!=='function'||typeof window.openPaperOrderManagement!=='function')return false;
  const originalClose=window.paperOrderCloseCycle;
  const originalOpen=window.openPaperOrderManagement;

  window.paperOrderCloseCycle=async function(){
    const monthInput=document.getElementById('poMonth');
    const oldMonth=monthInput?.value||'';
    await originalClose.apply(this,arguments);
    const status=(document.getElementById('poCycleStatus')?.textContent||'').trim().toUpperCase();
    if(status!=='CLOSED')return;
    const nm=nextMonth(oldMonth);
    if(!nm)return;
    if(monthInput){
      monthInput.value=nm;
      monthInput.dispatchEvent(new Event('change',{bubbles:true}));
    }
  };

  window.openPaperOrderManagement=async function(){
    await originalOpen.apply(this,arguments);
    // On entry, do not leave staff on an already-closed calendar month.
    // Move only once to the next month; historical months remain selectable manually afterwards.
    setTimeout(()=>{switchToNextIfClosed()},80);
  };

  installed=true;
  return true;
}
function boot(){
  if(install())return;
  let tries=0;
  const t=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(t)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
