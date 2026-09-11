/* Divergent employee cash-advance staff module */
(function(){
  'use strict';
  const API='https://neauzvqroaszvqffahkv.functions.supabase.co/employee-advance-web-api';
  const SESSION_KEYS=['divergent_fallback_session_token','divergent_web_session_token_v1'];
  let currentStatus='ALL';

  function money(v){return Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  async function token(){
    try{if(typeof window.getBestDataToken==='function'){const best=await window.getBestDataToken();if(best)return best;}}catch(_){}
    try{for(const k of SESSION_KEYS){const t=localStorage.getItem(k)||'';if(t)return t;}}catch(_){}
    return '';
  }
  function statusLabel(s){return ({PENDING:'รออนุมัติ',APPROVED:'อนุมัติแล้ว',REJECTED:'ไม่อนุมัติ',PAID:'โอนแล้ว',CANCELLED:'ยกเลิก'})[s]||s;}
  function statusClass(s){return 'adv-status adv-'+String(s||'').toLowerCase();}
  function lineDelivery(x){
    if(x.line_delivery_status==='SENT')return '<span class="adv-line-ok">✓ ส่งแล้ว</span>';
    if(x.line_delivery_status==='FAILED')return `<span class="adv-line-fail">✕ ส่งไม่สำเร็จ</span><div class="adv-note">${esc(x.line_delivery_reason||'ไม่ทราบสาเหตุ')}</div>`;
    if(!x.line_linked)return '<span class="adv-line-fail">ยังไม่เชื่อม LINE</span>';
    if(x.status==='APPROVED')return '<span class="adv-line-wait">ยังไม่ได้ส่ง</span>';
    return '<span class="adv-note">เชื่อมแล้ว</span>';
  }

  function addStyles(){
    if(document.getElementById('employeeAdvanceStyle'))return;
    const st=document.createElement('style');st.id='employeeAdvanceStyle';st.textContent=`
      #employeeAdvanceWorkspace{display:none;padding:6px 0 30px}
      .adv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}
      .adv-head h2{margin:0;font-size:28px}.adv-head p{margin:6px 0 0;color:#6b7280}
      .adv-refresh{background:#2563eb!important}
      .adv-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
      .adv-tab{background:#fff!important;color:#334155!important;border:1px solid #dbe3ef!important;padding:9px 14px!important}
      .adv-tab.active{background:#2563eb!important;color:#fff!important;border-color:#2563eb!important}
      .adv-kpis{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:12px;margin-bottom:18px}
      .adv-kpi{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:15px;box-shadow:0 4px 14px rgba(15,23,42,.05)}
      .adv-kpi span{display:block;color:#64748b;font-size:12px;margin-bottom:6px}.adv-kpi b{font-size:23px;color:#0f172a}
      .adv-site{background:#fff;border:1px solid #e5e7eb;border-radius:16px;margin-bottom:15px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,.05)}
      .adv-site-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;background:#f8fbff;border-bottom:1px solid #e5e7eb}
      .adv-site-title{font-weight:800;font-size:17px;color:#163b72}.adv-site-total{font-weight:800;color:#166534}
      .adv-table-wrap{overflow:auto}.adv-table{width:100%;border-collapse:collapse;min-width:990px}
      .adv-table th,.adv-table td{padding:11px 12px;border-bottom:1px solid #eef2f7;text-align:left;font-size:13px;vertical-align:middle}
      .adv-table th{background:#fbfdff;color:#475569;font-size:12px;position:sticky;top:0}
      .adv-status{display:inline-block;padding:5px 9px;border-radius:999px;font-weight:800;font-size:12px;white-space:nowrap}
      .adv-pending{background:#fff3cd;color:#8a5b00}.adv-approved{background:#dcfce7;color:#166534}.adv-rejected{background:#fee2e2;color:#991b1b}.adv-paid{background:#dbeafe;color:#1d4ed8}
      .adv-actions{display:flex;gap:6px;flex-wrap:wrap}.adv-approve{background:#16a34a!important;padding:7px 11px!important;font-size:12px!important}.adv-reject{background:#dc2626!important;padding:7px 11px!important;font-size:12px!important}.adv-retry-line{background:#0ea5e9!important;padding:7px 11px!important;font-size:12px!important}
      .adv-line-ok{font-weight:800;color:#15803d}.adv-line-fail{font-weight:800;color:#b91c1c}.adv-line-wait{font-weight:800;color:#a16207}
      .adv-empty,.adv-loading{background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:28px;text-align:center;color:#64748b}
      .adv-note{font-size:12px;color:#64748b}.adv-error{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;padding:12px;border-radius:12px;margin-bottom:14px;display:none}
      @media(max-width:800px){.adv-kpis{grid-template-columns:1fr 1fr}.adv-head h2{font-size:23px}}
    `;document.head.appendChild(st);
  }

  function build(){
    addStyles();
    if(!document.getElementById('navEmployeeAdvance')){
      const ref=document.getElementById('navPayroll');
      if(ref){const nav=document.createElement('div');nav.className='nav-item';nav.id='navEmployeeAdvance';nav.innerHTML='<span class="nav-ico">💸</span><span>พนักงานเบิกเงินล่วงหน้า</span>';nav.onclick=open;ref.insertAdjacentElement('afterend',nav);}
    }
    if(!document.getElementById('employeeAdvanceWorkspace')){
      const w=document.createElement('section');w.className='payroll-workspace';w.id='employeeAdvanceWorkspace';w.innerHTML=`
        <div class="adv-head"><div><h2>พนักงานเบิกเงินล่วงหน้า</h2><p>ตรวจสอบคำขอ แยกตามไซต์งาน • เมื่ออนุมัติจะบันทึกยอดเข้าเงินเดือนอัตโนมัติ</p></div><button class="adv-refresh" onclick="window.EmployeeAdvance.reload()">↻ รีเฟรช</button></div>
        <div id="advError" class="adv-error"></div>
        <div class="adv-tabs"><button class="adv-tab active" data-status="ALL">ทั้งหมด</button><button class="adv-tab" data-status="PENDING">รออนุมัติ</button><button class="adv-tab" data-status="APPROVED">อนุมัติแล้ว</button><button class="adv-tab" data-status="REJECTED">ไม่อนุมัติ</button></div>
        <div class="adv-kpis"><div class="adv-kpi"><span>จำนวนรายการ</span><b id="advCount">0</b></div><div class="adv-kpi"><span>ยอดรวมทั้งหมด</span><b id="advTotal">0.00</b></div><div class="adv-kpi"><span>รออนุมัติ</span><b id="advPending">0</b></div><div class="adv-kpi"><span>อนุมัติแล้ว</span><b id="advApproved">0</b></div></div>
        <div id="advContent" class="adv-loading">กำลังโหลดข้อมูล...</div>`;
      const main=document.querySelector('.main-content')||document.querySelector('main')||document.body;main.appendChild(w);
      w.querySelectorAll('.adv-tab').forEach(b=>b.addEventListener('click',()=>{currentStatus=b.dataset.status||'ALL';w.querySelectorAll('.adv-tab').forEach(x=>x.classList.toggle('active',x===b));reload();}));
    }
    syncVisibility();
  }

  function syncVisibility(){
    const nav=document.getElementById('navEmployeeAdvance');if(!nav)return;
    const auth=window.DivergentAuth;if(!auth||typeof auth.getState!=='function'){nav.style.display='';return;}
    const s=auth.getState();if(!s||!s.confirmed){nav.style.display='';return;}
    nav.style.display=s.access&&s.access.payroll?'':'none';
  }

  function hideOthers(){document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));const nav=document.getElementById('navEmployeeAdvance');if(nav)nav.classList.add('active');document.querySelectorAll('[id$="Workspace"]').forEach(el=>{if(el.id!=='employeeAdvanceWorkspace')el.style.display='none';});const w=document.getElementById('employeeAdvanceWorkspace');if(w)w.style.display='block';}

  async function call(body){const t=await token();if(!t)throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชี Staff ใหม่อีกครั้ง');const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j;}

  async function open(){if(window.DivergentAuth&&window.DivergentAuth.requireAccess&&!window.DivergentAuth.requireAccess('payroll','เมนูพนักงานเบิกเงินล่วงหน้า'))return;hideOthers();window.scrollTo(0,0);await reload();}

  function render(data){
    document.getElementById('advCount').textContent=String(data.totals?.count||0);document.getElementById('advTotal').textContent=money(data.totals?.total_amount||0)+' บาท';document.getElementById('advPending').textContent=String(data.totals?.pending||0);document.getElementById('advApproved').textContent=String(data.totals?.approved||0);
    const root=document.getElementById('advContent');if(!data.sites||!data.sites.length){root.className='adv-empty';root.innerHTML='ยังไม่มีรายการเบิกเงินล่วงหน้า';return;}
    root.className='';root.innerHTML=data.sites.map(g=>`<div class="adv-site"><div class="adv-site-head"><div class="adv-site-title">📍 ไซต์งาน: ${esc(g.site_name)} <span class="adv-note">(${g.employee_count} รายการ)</span></div><div class="adv-site-total">รวม ${money(g.total_amount)} บาท</div></div><div class="adv-table-wrap"><table class="adv-table"><thead><tr><th>#</th><th>ชื่อพนักงาน</th><th>จำนวนเงิน</th><th>วันที่ขอ</th><th>เหตุผล</th><th>LINE</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${g.items.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.employee_name)}</b><div class="adv-note">${esc(x.request_code||'')}</div></td><td><b>${money(x.requested_amount)} บาท</b></td><td>${new Date(x.created_at).toLocaleString('th-TH')}</td><td>${esc(x.request_note||'-')}</td><td>${lineDelivery(x)}</td><td><span class="${statusClass(x.status)}">${statusLabel(x.status)}</span></td><td>${x.status==='PENDING'?`<div class="adv-actions"><button class="adv-approve" onclick="window.EmployeeAdvance.approve(${Number(x.id)},'${esc(x.employee_name).replace(/'/g,'&#39;')}',${Number(x.requested_amount)})">อนุมัติ</button><button class="adv-reject" onclick="window.EmployeeAdvance.reject(${Number(x.id)},'${esc(x.employee_name).replace(/'/g,'&#39;')}')">ไม่อนุมัติ</button></div>`:(x.status==='APPROVED'&&x.line_delivery_status!=='SENT'?`<button class="adv-retry-line" onclick="window.EmployeeAdvance.retryLine(${Number(x.id)},'${esc(x.employee_name).replace(/'/g,'&#39;')}')">ส่ง LINE ซ้ำ</button>`:'-')}</td></tr>`).join('')}</tbody></table></div></div>`).join('');
  }

  async function reload(){const err=document.getElementById('advError');if(err){err.style.display='none';err.textContent='';}const root=document.getElementById('advContent');if(root){root.className='adv-loading';root.innerHTML='กำลังโหลดข้อมูล...';}try{render(await call({action:'list',status:currentStatus}));}catch(e){if(err){err.textContent=e.message||String(e);err.style.display='block';}if(root){root.className='adv-empty';root.innerHTML='โหลดข้อมูลไม่สำเร็จ';}}}

  async function approve(id,name,amount){if(!confirm(`ยืนยันอนุมัติยอด ${money(amount)} บาท ของ ${name}?\n\nระบบจะบันทึกยอดนี้ลงคอลัมน์เบิกล่วงหน้าในเงินเดือนอัตโนมัติ`))return;try{const j=await call({action:'approve',request_id:id});let msg=`อนุมัติเรียบร้อย\nยอดเบิกล่วงหน้าในเงินเดือนปัจจุบัน: ${money(j.approval?.advance_deduction||0)} บาท`;if(j.line?.ok)msg+='\nส่งข้อความ LINE ให้พนักงานแล้ว';else msg+=`\nLINE: ${j.line?.reason||'ยังไม่ได้ส่ง'}`;alert(msg);await reload();}catch(e){alert('อนุมัติไม่สำเร็จ: '+(e.message||e));}}

  async function retryLine(id,name){if(!confirm(`ส่งข้อความแจ้งอนุมัติทาง LINE ให้ ${name} อีกครั้ง?`))return;try{const j=await call({action:'retry_line',request_id:id});alert(j.line?.ok?'ส่ง LINE สำเร็จ':'ส่ง LINE ไม่สำเร็จ: '+(j.line?.reason||'ไม่ทราบสาเหตุ'));await reload();}catch(e){alert('ส่ง LINE ไม่สำเร็จ: '+(e.message||e));}}

  async function reject(id,name){if(!confirm(`ยืนยันไม่อนุมัติคำขอของ ${name}?`))return;try{await call({action:'reject',request_id:id});await reload();}catch(e){alert('ดำเนินการไม่สำเร็จ: '+(e.message||e));}}

  window.EmployeeAdvance={open,reload,approve,reject,retryLine};window.openEmployeeAdvanceManagement=open;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();window.addEventListener('divergent:permissions',syncVisibility);
})();

/* Staff expense per-person payment status hotfix V2.5.1 */
(function(){
  'use strict';
  const EXPENSE_API='https://neauzvqroaszvqffahkv.functions.supabase.co/staff-expense-web-api';

  async function bestToken(){
    try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t;}}catch(_){}
    try{return localStorage.getItem('divergent_fallback_session_token')||localStorage.getItem('divergent_web_session_token_v1')||'';}catch(_){return '';}
  }

  /* WEB DIRECT LOGIN: do not force LIFF for staff-expense actions. */
  window.staffExpenseApi=async function(action,payload={}){
    const accessToken=await bestToken();
    if(!accessToken)throw new Error('AUTH_REQUIRED');
    const r=await fetch(EXPENSE_API,{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
    const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch(_){throw new Error('STAFF_EXPENSE_INVALID_RESPONSE');}
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  };

  function ensureStyle(){
    if(document.getElementById('staffPerPersonPaidWaitingStyle'))return;
    const s=document.createElement('style');
    s.id='staffPerPersonPaidWaitingStyle';
    s.textContent=`
      .expense-staff-head{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important}
      .expense-staff-head .expense-staff-paid-waiting{
        margin-left:auto!important;
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        min-height:27px!important;padding:5px 11px!important;border-radius:8px!important;
        border:1px solid #86d7a8!important;background:#16a34a!important;color:#fff!important;
        font-size:11px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;
        box-shadow:0 2px 7px rgba(22,163,74,.16)!important
      }
      .expense-staff-head .expense-staff-paid-waiting + strong{margin-left:0!important}
    `;
    document.head.appendChild(s);
  }

  function injectStatuses(){
    ensureStyle();
    document.querySelectorAll('#staffExpenseWorkspace .expense-staff-head').forEach(head=>{
      if(head.querySelector('.expense-staff-paid-waiting'))return;
      const badge=document.createElement('span');
      badge.className='expense-staff-paid-waiting';
      badge.textContent='จ่ายแล้วรอจ่าย';
      badge.title='สถานะรายบุคคล: จ่ายแล้วรอจ่าย';
      const total=head.querySelector('strong');
      if(total)head.insertBefore(badge,total);else head.appendChild(badge);
    });
  }

  function start(){
    ensureStyle();
    injectStatuses();
    const root=document.getElementById('staffExpenseWorkspace')||document.body;
    const obs=new MutationObserver(()=>injectStatuses());
    obs.observe(root,{childList:true,subtree:true});
    window.addEventListener('divergent:permissions',injectStatuses);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();