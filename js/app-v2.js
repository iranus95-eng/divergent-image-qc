(function(){
  'use strict';
  const items=[
    ['home','หน้าหลัก'],['claim','ตั้งเบิก'],['claimPending','งานค้าง'],['payroll','เงินเดือน'],
    ['staffPayroll','เงินเดือนสตาฟ'],['advance','เบิกล่วงหน้า'],['expense','ค่าใช้จ่าย'],['qc','ตรวจงาน'],['search','ค้นหา'],
    ['location','พิกัด'],['users','ผู้ใช้'],['invoice','ใบตั้งหนี้'],['billing','ใบวางบิล'],['pnl','กำไร/ขาดทุน']
  ];
  const calls={
    home:()=>window.switchWorkspace('home'),claim:()=>window.openClaimManagement(),claimPending:()=>window.openClaimPendingManagement(),
    payroll:()=>window.openPayrollManagement(),staffPayroll:()=>window.openStaffPayrollManagement(),advance:()=>window.openEmployeeAdvanceManagement&&window.openEmployeeAdvanceManagement(),
    expense:()=>window.openStaffExpenseManagement(),qc:()=>window.switchWorkspace('qc'),search:()=>window.switchWorkspace('search'),
    location:()=>window.switchWorkspace('location'),users:()=>window.openUserManagement(),invoice:()=>window.openInvoiceManagement(),
    billing:()=>window.openBillingManagement(),pnl:()=>window.openProfitLossManagement()
  };
  const navIds={home:'navHome',claim:'navClaim',claimPending:'navClaimPending',payroll:'navPayroll',staffPayroll:'navStaffPayroll',advance:'navEmployeeAdvance',
    expense:'navStaffExpense',qc:'navQc',search:'navSearch',location:'navLocation',users:'navUsers',invoice:'navInvoice',billing:'navBilling',pnl:'navPnL'};
  function visible(key){const source=document.getElementById(navIds[key]);return source&&getComputedStyle(source).display!=='none'}
  function activeKey(){const active=document.querySelector('.side-nav .nav-item.active');if(!active)return'home';return Object.keys(navIds).find(k=>navIds[k]===active.id)||'home'}
  function sync(){const nav=document.querySelector('.v2-mobile-nav');if(!nav)return;nav.querySelectorAll('button').forEach(button=>{const key=button.dataset.v2Page;button.hidden=!visible(key);button.classList.toggle('active',key===activeKey())})}
  function mount(){
    document.documentElement.dataset.ui='v2';
    const brand=document.querySelector('.side-brand');if(brand)brand.setAttribute('aria-label','Divergent Image Rescue V2');
    if(!document.querySelector('.v2-mobile-nav')){
      const nav=document.createElement('nav');nav.className='v2-mobile-nav';nav.setAttribute('aria-label','เมนู V2 สำหรับมือถือ');
      for(const [key,label] of items){const button=document.createElement('button');button.type='button';button.dataset.v2Page=key;button.textContent=label;button.addEventListener('click',()=>{if(calls[key])calls[key]();setTimeout(sync,0)});nav.appendChild(button)}
      document.body.appendChild(nav);
    }
    const side=document.querySelector('.side-nav');if(side)new MutationObserver(sync).observe(side,{attributes:true,childList:true,subtree:true,attributeFilter:['class','style']});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

/* Staff expense auth hotfix: use the authenticated web session first,
 * then LINE only as a fallback. This overrides the legacy inline helper
 * which used a LINE token for write actions and could show AUTH_REQUIRED
 * even after a successful web login.
 */
(function(){
  'use strict';
  const EXPENSE_API='https://neauzvqroaszvqffahkv.functions.supabase.co/staff-expense-web-api';
  const WEB_SESSION_KEY='divergent_web_session_token_v1';
  const FALLBACK_SESSION_KEY='divergent_fallback_session_token';

  function localSessionToken(){
    try{
      return localStorage.getItem(WEB_SESSION_KEY)
        || localStorage.getItem(FALLBACK_SESSION_KEY)
        || '';
    }catch(_){return '';}
  }

  async function expenseToken(){
    const local=localSessionToken();
    if(local)return local;
    try{
      if(typeof window.getBestDataToken==='function'){
        const t=await window.getBestDataToken();
        if(t)return t;
      }
    }catch(_){}
    try{
      if(window.liff&&liff.isLoggedIn&&liff.isLoggedIn()&&liff.getAccessToken){
        return liff.getAccessToken()||'';
      }
    }catch(_){}
    return '';
  }

  async function fixedStaffExpenseApi(action,payload={}){
    const accessToken=await expenseToken();
    if(!accessToken){
      if(location.protocol!=='file:'){
        try{location.replace('./web-login.html');}catch(_){}
      }
      throw new Error('AUTH_REQUIRED');
    }
    const r=await fetch(EXPENSE_API,{
      method:'POST',
      headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({action,...payload})
    });
    const t=await r.text();
    let d={};
    try{d=t?JSON.parse(t):{}}catch(_){throw new Error('EXPENSE_INVALID_RESPONSE');}
    if(!r.ok){
      const code=String(d.error||('HTTP '+r.status));
      if((code==='AUTH_REQUIRED'||code==='AUTH_INVALID')&&location.protocol!=='file:'){
        try{
          localStorage.removeItem(WEB_SESSION_KEY);
          localStorage.removeItem(FALLBACK_SESSION_KEY);
          location.replace('./web-login.html');
        }catch(_){}
      }
      throw new Error(code);
    }
    return d;
  }

  window.staffExpenseApi=fixedStaffExpenseApi;
})();

/* Staff expense delete UI: the legacy expense table only renders an Edit button.
 * Add a safe soft-delete button next to Edit whenever the current user can manage
 * expenses. The API keeps the row for audit/history by setting is_active=false.
 */
(function(){
  'use strict';

  function installDeleteStyle(){
    if(document.getElementById('expense-delete-v2-style'))return;
    const style=document.createElement('style');
    style.id='expense-delete-v2-style';
    style.textContent=`
      .expense-delete-v2{margin-left:6px!important;background:#fff1f2!important;color:#b4233c!important;border:1px solid #fecdd3!important}
      .expense-delete-v2:hover{background:#ffe4e6!important}
      .expense-row-actions-v2{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
    `;
    document.head.appendChild(style);
  }

  async function deleteStaffExpenseItem(id){
    id=Number(id||0);
    if(!id)return;
    if(!confirm('ยืนยันลบรายการนี้?\n\nรายการจะหายจากรอบปัจจุบัน แต่ยังเก็บประวัติไว้ในระบบ'))return;
    try{
      await window.staffExpenseApi('delete_item',{id});
      if(typeof window.loadStaffExpenseItems==='function')await window.loadStaffExpenseItems(true);
      else if(typeof window.loadStaffExpenseBootstrap==='function')await window.loadStaffExpenseBootstrap(true);
    }catch(e){
      alert('ลบรายการไม่สำเร็จ: '+(e?.message||e));
    }
  }

  function addDeleteButtons(){
    const body=document.getElementById('expenseBody');
    if(!body)return;
    const edits=body.querySelectorAll('button[onclick^="openExpenseItemModal("]');
    edits.forEach(edit=>{
      const cell=edit.closest('td');
      if(!cell||cell.querySelector('.expense-delete-v2'))return;
      const raw=edit.getAttribute('onclick')||'';
      const match=raw.match(/openExpenseItemModal\((\d+)\)/);
      if(!match)return;
      const id=Number(match[1]);
      const wrap=document.createElement('div');
      wrap.className='expense-row-actions-v2';
      edit.parentNode.insertBefore(wrap,edit);
      wrap.appendChild(edit);
      const del=document.createElement('button');
      del.type='button';
      del.className='expense-soft expense-delete-v2';
      del.textContent='🗑 ลบ';
      del.addEventListener('click',()=>deleteStaffExpenseItem(id));
      wrap.appendChild(del);
    });
  }

  window.deleteStaffExpenseItem=deleteStaffExpenseItem;

  function bootDeleteUi(){
    installDeleteStyle();
    addDeleteButtons();
    const body=document.getElementById('expenseBody');
    if(body)new MutationObserver(()=>addDeleteButtons()).observe(body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootDeleteUi,{once:true});
  else bootDeleteUi();
})();
