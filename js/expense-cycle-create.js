/* Staff expense cycle creation UI */
(function(){
  'use strict';

  const STYLE_ID='expense-cycle-create-style';
  const MODAL_ID='expenseCycleCreateModal';
  const BUTTON_ID='expenseCycleCreateBtn';
  let saving=false;

  function todayBangkok(){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
      const get=t=>parts.find(x=>x.type===t)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }catch(_){
      const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }
  }

  function defaultType(date){
    const day=Number(String(date||'').slice(-2));
    if(day===3)return 'DAY3';
    if(day===7)return 'DAY7';
    return 'EXTRA';
  }

  function installStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      #${BUTTON_ID}{background:#6c4ed9!important;color:#fff!important;border:1px solid #6c4ed9!important;font-weight:800}
      #${MODAL_ID}{display:none;position:fixed;inset:0;z-index:12050;background:rgba(22,18,33,.48);align-items:center;justify-content:center;padding:20px}
      #${MODAL_ID}.show{display:flex}
      #${MODAL_ID} .expense-cycle-create-panel{width:min(520px,96vw);background:#fff;border-radius:16px;padding:20px;box-shadow:0 18px 70px rgba(0,0,0,.25)}
      #${MODAL_ID} h3{margin:0 0 6px;color:#3d226f}
      #${MODAL_ID} .sub{font-size:13px;color:#6b7280;margin-bottom:16px}
      #${MODAL_ID} label{display:block;font-weight:800;margin:12px 0 6px}
      #${MODAL_ID} input,#${MODAL_ID} select,#${MODAL_ID} textarea{width:100%;box-sizing:border-box;border:1px solid #d7dbe3;border-radius:10px;padding:10px 12px;font:inherit;background:#fff}
      #${MODAL_ID} textarea{min-height:76px;resize:vertical}
      #${MODAL_ID} .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
      #${MODAL_ID} .cancel{background:#fff!important;color:#475569!important;border:1px solid #cbd5e1!important}
      #${MODAL_ID} .save{background:#6c4ed9!important;color:#fff!important}
      #${MODAL_ID} .status{margin-top:10px;font-size:13px;color:#6b7280;min-height:18px}
      @media(max-width:620px){#${MODAL_ID} .actions button{flex:1 1 140px}}
    `;document.head.appendChild(s);
  }

  function ensureModal(){
    let m=document.getElementById(MODAL_ID);if(m)return m;
    m=document.createElement('div');m.id=MODAL_ID;m.innerHTML=`
      <div class="expense-cycle-create-panel" role="dialog" aria-modal="true" aria-labelledby="expenseCycleCreateTitle">
        <h3 id="expenseCycleCreateTitle">ตั้งรอบค่าใช้จ่ายใหม่</h3>
        <div class="sub">เลือกรอบและวันที่ที่ต้องการเปิดรับรายการค่าใช้จ่าย</div>
        <label for="expenseCycleCreateType">ประเภทรอบ</label>
        <select id="expenseCycleCreateType">
          <option value="DAY3">รอบวันที่ 3</option>
          <option value="DAY7">รอบวันที่ 7</option>
          <option value="EXTRA">รอบพิเศษ</option>
        </select>
        <label for="expenseCycleCreateDate">วันที่รอบ</label>
        <input id="expenseCycleCreateDate" type="date" />
        <label for="expenseCycleCreateNote">หมายเหตุ</label>
        <textarea id="expenseCycleCreateNote" placeholder="เช่น รอบค่าใช้จ่ายประจำเดือน"></textarea>
        <div id="expenseCycleCreateStatus" class="status"></div>
        <div class="actions">
          <button type="button" class="expense-soft cancel" id="expenseCycleCreateCancel">ยกเลิก</button>
          <button type="button" class="expense-soft save" id="expenseCycleCreateSave">บันทึกรอบ</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)closeModal();});
    m.querySelector('#expenseCycleCreateCancel')?.addEventListener('click',closeModal);
    m.querySelector('#expenseCycleCreateSave')?.addEventListener('click',saveCycle);
    m.querySelector('#expenseCycleCreateDate')?.addEventListener('change',e=>{
      const type=m.querySelector('#expenseCycleCreateType');
      if(type&&type.dataset.manual!=='1')type.value=defaultType(e.target.value);
    });
    m.querySelector('#expenseCycleCreateType')?.addEventListener('change',e=>{e.target.dataset.manual='1';});
    return m;
  }

  async function openModal(){
    if(typeof window.staffExpenseApi!=='function')return alert('ระบบค่าใช้จ่ายยังโหลดไม่ครบ กรุณารีเฟรชหน้า');
    try{
      const p=await window.staffExpenseApi('permissions',{});
      if(!p?.can_manage)return alert('บัญชีนี้ไม่มีสิทธิ์ตั้งรอบค่าใช้จ่าย');
    }catch(e){return alert('ตรวจสอบสิทธิ์ไม่สำเร็จ: '+(e?.message||e));}
    const m=ensureModal(),date=todayBangkok();
    const dateEl=m.querySelector('#expenseCycleCreateDate'),typeEl=m.querySelector('#expenseCycleCreateType'),noteEl=m.querySelector('#expenseCycleCreateNote'),st=m.querySelector('#expenseCycleCreateStatus');
    if(dateEl)dateEl.value=date;
    if(typeEl){typeEl.dataset.manual='';typeEl.value=defaultType(date);}
    if(noteEl)noteEl.value='';
    if(st)st.textContent='';
    m.classList.add('show');
  }

  function closeModal(){if(!saving)document.getElementById(MODAL_ID)?.classList.remove('show');}

  function errorText(code){
    if(code.includes('CYCLE_ALREADY_CLOSED'))return 'รอบวันและประเภทนี้เคยถูกปิดแล้ว กรุณาเลือกวันอื่นหรือเลือก “รอบพิเศษ”';
    if(code.includes('INVALID_SCHEDULED_DATE'))return 'กรุณาเลือกวันที่รอบให้ถูกต้อง';
    if(code.includes('INVALID_CYCLE_TYPE'))return 'กรุณาเลือกประเภทรอบ';
    if(code.includes('STAFF_EXPENSE_MANAGE_DENIED'))return 'บัญชีนี้ไม่มีสิทธิ์ตั้งรอบค่าใช้จ่าย';
    return code;
  }

  async function saveCycle(){
    if(saving)return;
    const m=ensureModal(),type=m.querySelector('#expenseCycleCreateType')?.value||'',scheduled=m.querySelector('#expenseCycleCreateDate')?.value||'',note=m.querySelector('#expenseCycleCreateNote')?.value?.trim()||'',st=m.querySelector('#expenseCycleCreateStatus'),save=m.querySelector('#expenseCycleCreateSave');
    if(!scheduled){if(st)st.textContent='กรุณาเลือกวันที่รอบ';return;}
    saving=true;if(save)save.disabled=true;if(st)st.textContent='กำลังบันทึกรอบ...';
    try{
      const d=await window.staffExpenseApi('create_cycle',{cycle_type:type,scheduled_date:scheduled,note});
      const id=Number(d?.cycle?.id||0);
      if(typeof window.loadStaffExpenseBootstrap==='function')await window.loadStaffExpenseBootstrap(true);
      const sel=document.getElementById('expenseCycleSelect');
      if(sel&&id){sel.value=String(id);sel.dispatchEvent(new Event('change',{bubbles:true}));}
      if(st)st.textContent=d?.existing?'มีรอบนี้อยู่แล้ว ระบบเลือกให้แล้ว':'บันทึกรอบใหม่สำเร็จ ✓';
      setTimeout(()=>{saving=false;if(save)save.disabled=false;m.classList.remove('show');},450);
    }catch(e){
      const code=String(e?.message||e||'');if(st)st.textContent='บันทึกไม่สำเร็จ: '+errorText(code);saving=false;if(save)save.disabled=false;
    }
  }

  function injectButton(){
    installStyle();ensureModal();
    if(document.getElementById(BUTTON_ID))return;
    const card=document.querySelector('.expense-cycle-card');if(!card)return;
    const b=document.createElement('button');b.type='button';b.id=BUTTON_ID;b.className='expense-soft';b.textContent='＋ ตั้งรอบใหม่';b.addEventListener('click',openModal);
    const refresh=[...card.querySelectorAll('button')].find(x=>(x.textContent||'').includes('รีเฟรช'));
    if(refresh)card.insertBefore(b,refresh);else card.appendChild(b);
  }

  function boot(){injectButton();const root=document.body;new MutationObserver(injectButton).observe(root,{childList:true,subtree:true});[200,800,1800].forEach(ms=>setTimeout(injectButton,ms));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
