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
function install(){
  if(installed||typeof window.paperOrderCloseCycle!=='function')return false;
  const original=window.paperOrderCloseCycle;
  window.paperOrderCloseCycle=async function(){
    const monthInput=document.getElementById('poMonth');
    const oldMonth=monthInput?.value||'';
    await original();
    const status=(document.getElementById('poCycleStatus')?.textContent||'').trim().toUpperCase();
    if(status!=='CLOSED')return;
    const nm=nextMonth(oldMonth);
    if(!nm)return;
    if(monthInput){
      monthInput.value=nm;
      monthInput.dispatchEvent(new Event('change',{bubbles:true}));
    }
    setTimeout(()=>{
      const label=document.getElementById('poCycleLabel');
      if(label&&document.getElementById('poCycleStatus')?.textContent!=='CLOSED'){
        console.info('Paper order: next cycle is ready for staggered site submissions.');
      }
    },500);
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
