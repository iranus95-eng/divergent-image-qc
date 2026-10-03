/* Payroll multi-site deduction netting UI fix */
(function(){
  'use strict';

  function sumGroup(rows,key){
    return (rows||[]).reduce((s,x)=>s+(Number(x?.[key])||0),0);
  }

  function aggregateForRow(id){
    try{
      if(typeof payrollEmployees==='undefined'||!Array.isArray(payrollEmployees))return null;
      const row=payrollEmployees.find(x=>String(x.id||x.master_row_id||'')===String(id||''));
      if(!row)return null;
      const pid=Number(row.profile_id||0);
      const month=String(row.source_month||'');
      const group=pid?payrollEmployees.filter(x=>Number(x.profile_id||0)===pid&&String(x.source_month||'')===month):[row];
      return {
        advance:sumGroup(group,'advance_deduction'),
        shirt:sumGroup(group,'shirt_cost'),
        special:sumGroup(group,'special_amount'),
        total:sumGroup(group,'total_amount'),
        rows:group
      };
    }catch(_){return null;}
  }

  function syncModalTotals(id){
    const agg=aggregateForRow(id);if(!agg)return;
    const adv=document.getElementById('peAdvance');
    const shirt=document.getElementById('peShirt');
    const special=document.getElementById('peSpecial');
    if(adv)adv.value=Number(agg.advance||0).toFixed(2);
    if(shirt)shirt.value=Number(agg.shirt||0).toFixed(2);
    if(special)special.value=Number(agg.special||0).toFixed(2);
    try{if(typeof refreshPayrollFormula==='function')refreshPayrollFormula();}catch(_){}
  }

  function relabel(){
    const labels=[...document.querySelectorAll('#payrollModal .payroll-field label')];
    for(const l of labels){
      const t=(l.textContent||'').trim();
      if(t==='หัก เบิกล่วงหน้า')l.textContent='หัก เบิกล่วงหน้า (รวมทุกพื้นที่)';
      if(t==='ค่าเสื้อ')l.textContent='ค่าเสื้อ (รวมทุกพื้นที่)';
      if(t==='บวก เงินพิเศษ')l.textContent='บวก เงินพิเศษ (รวมทุกพื้นที่)';
    }
  }

  function wrapOpen(){
    if(typeof window.openPayrollEmployee!=='function'||window.openPayrollEmployee.__deductionNetWrapped)return false;
    const original=window.openPayrollEmployee;
    const wrapped=async function(id=null){
      const out=await original.apply(this,arguments);
      if(id){
        syncModalTotals(id);
        setTimeout(()=>syncModalTotals(id),80);
      }
      relabel();
      return out;
    };
    wrapped.__deductionNetWrapped=true;
    window.openPayrollEmployee=wrapped;
    return true;
  }

  function boot(){
    relabel();wrapOpen();
    [100,350,900,1800,3200].forEach(ms=>setTimeout(()=>{relabel();wrapOpen();},ms));
    new MutationObserver(()=>{relabel();wrapOpen();}).observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
