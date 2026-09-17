/* Staff expense cycle status fix: allow one-click READY/PAID/CLOSED while preserving backend transition rules. */
(function(){
  'use strict';

  const ORDER=['DRAFT','READY','PAID','CLOSED'];
  const LABEL={DRAFT:'DRAFT',READY:'พร้อมจ่าย',PAID:'จ่ายแล้ว',CLOSED:'ปิดรอบ'};
  let busy=false;

  function currentStatus(){
    const direct=(document.getElementById('expenseCycleStatus')?.textContent||document.getElementById('expenseCycleBadge')?.textContent||'').trim().toUpperCase();
    if(ORDER.includes(direct))return direct;
    const sel=document.getElementById('expenseCycleSelect');
    const txt=(sel?.selectedOptions?.[0]?.textContent||'').toUpperCase();
    return ORDER.find(s=>txt.includes(s))||'DRAFT';
  }

  function setUiStatus(status){
    const t=document.getElementById('expenseCycleStatus');if(t)t.textContent=status;
    const b=document.getElementById('expenseCycleBadge');if(b){b.textContent=status;b.className='expense-status '+status;}
    const sel=document.getElementById('expenseCycleSelect');
    if(sel&&sel.selectedOptions&&sel.selectedOptions[0]){
      const o=sel.selectedOptions[0];
      const text=o.textContent||'';
      if(/\b(DRAFT|READY|PAID|CLOSED)\b/.test(text))o.textContent=text.replace(/\b(DRAFT|READY|PAID|CLOSED)\b/,status);
    }
  }

  async function refresh(){
    try{
      if(typeof window.loadStaffExpenseBootstrap==='function')await window.loadStaffExpenseBootstrap(true);
      else if(typeof window.loadStaffExpenseItems==='function')await window.loadStaffExpenseItems(true);
    }catch(_){}
  }

  async function smartSet(target){
    target=String(target||'').toUpperCase();
    if(!ORDER.includes(target))return alert('สถานะไม่ถูกต้อง');
    if(target==='DRAFT')return alert('ไม่สามารถย้อนสถานะกลับเป็น DRAFT ได้');
    if(busy)return;
    const cycleId=Number(document.getElementById('expenseCycleSelect')?.value||0);
    if(!cycleId)return alert('กรุณาเลือกรอบเบิก');
    if(typeof window.staffExpenseApi!=='function')return alert('ระบบค่าใช้จ่ายยังโหลดไม่ครบ กรุณารีเฟรชหน้า');

    let from=currentStatus();
    const fromIndex=ORDER.indexOf(from),targetIndex=ORDER.indexOf(target);
    if(fromIndex<0)return alert('ไม่พบสถานะปัจจุบันของรอบ');
    if(targetIndex===fromIndex)return;
    if(targetIndex<fromIndex)return alert(`สถานะปัจจุบันคือ ${LABEL[from]||from} ไม่สามารถย้อนกลับได้`);

    const steps=ORDER.slice(fromIndex+1,targetIndex+1);
    const msg=steps.length>1
      ?`ยืนยันเปลี่ยนจาก ${LABEL[from]||from} เป็น ${LABEL[target]||target}?\n\nระบบจะเปลี่ยนสถานะตามลำดับอัตโนมัติ: ${steps.map(s=>LABEL[s]||s).join(' → ')}`
      :`ยืนยันเปลี่ยนสถานะเป็น ${LABEL[target]||target} ?`;
    if(!confirm(msg))return;

    busy=true;
    try{
      let expected=from;
      for(const status of steps){
        await window.staffExpenseApi('set_cycle_status',{cycle_id:cycleId,status,expected_status:expected});
        expected=status;
        setUiStatus(status);
      }
      await refresh();
    }catch(e){
      await refresh();
      const code=String(e?.message||e||'');
      if(code.includes('CYCLE_STATUS_CONFLICT'))alert('สถานะรอบถูกเปลี่ยนจากหน้าจออื่นแล้ว ระบบรีเฟรชข้อมูลให้ใหม่ กรุณาลองอีกครั้ง');
      else if(code.includes('INVALID_CYCLE_TRANSITION'))alert('ลำดับสถานะไม่ถูกต้อง ระบบรีเฟรชสถานะล่าสุดแล้ว กรุณาลองอีกครั้ง');
      else alert('เปลี่ยนสถานะไม่สำเร็จ: '+code);
    }finally{busy=false;}
  }

  window.setExpenseCycleStatus=smartSet;
})();
