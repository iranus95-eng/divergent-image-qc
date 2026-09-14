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
  const navIds={home:'navHome',claim:'navClaim',claimPending:'navClaimPending',payroll:'navPayroll',staffPayroll:'navStaffPayroll',advance:'navEmployeeAdvance',expense:'navStaffExpense',qc:'navQc',search:'navSearch',location:'navLocation',users:'navUsers',invoice:'navInvoice',billing:'navBilling',pnl:'navPnL'};
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

/* Staff expense auth hotfix */
(function(){
  'use strict';
  const EXPENSE_API='https://neauzvqroaszvqffahkv.functions.supabase.co/staff-expense-web-api';
  const WEB_SESSION_KEY='divergent_web_session_token_v1';
  const FALLBACK_SESSION_KEY='divergent_fallback_session_token';
  function localSessionToken(){try{return localStorage.getItem(WEB_SESSION_KEY)||localStorage.getItem(FALLBACK_SESSION_KEY)||''}catch(_){return ''}}
  async function expenseToken(){
    const local=localSessionToken();if(local)return local;
    try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t}}catch(_){}
    try{if(window.liff&&liff.isLoggedIn&&liff.isLoggedIn()&&liff.getAccessToken)return liff.getAccessToken()||''}catch(_){}
    return '';
  }
  async function fixedStaffExpenseApi(action,payload={}){
    const accessToken=await expenseToken();
    if(!accessToken){if(location.protocol!=='file:'){try{location.replace('./web-login.html')}catch(_){}}throw new Error('AUTH_REQUIRED')}
    const r=await fetch(EXPENSE_API,{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
    const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch(_){throw new Error('EXPENSE_INVALID_RESPONSE')}
    if(!r.ok){const code=String(d.error||('HTTP '+r.status));if((code==='AUTH_REQUIRED'||code==='AUTH_INVALID')&&location.protocol!=='file:'){try{localStorage.removeItem(WEB_SESSION_KEY);localStorage.removeItem(FALLBACK_SESSION_KEY);location.replace('./web-login.html')}catch(_){}}throw new Error(code)}
    return d;
  }
  window.staffExpenseApi=fixedStaffExpenseApi;
})();

/* Staff expense delete UI */
(function(){
  'use strict';
  function installDeleteStyle(){
    if(document.getElementById('expense-delete-v2-style'))return;
    const style=document.createElement('style');style.id='expense-delete-v2-style';style.textContent=`
      .expense-delete-v2{margin-left:6px!important;background:#fff1f2!important;color:#b4233c!important;border:1px solid #fecdd3!important}
      .expense-delete-v2:hover{background:#ffe4e6!important}
      .expense-row-actions-v2{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
    `;document.head.appendChild(style);
  }
  async function deleteStaffExpenseItem(id){
    id=Number(id||0);if(!id)return;
    if(!confirm('ยืนยันลบรายการนี้?\n\nรายการจะหายจากรอบปัจจุบัน แต่ยังเก็บประวัติไว้ในระบบ'))return;
    try{await window.staffExpenseApi('delete_item',{id});if(typeof window.loadStaffExpenseItems==='function')await window.loadStaffExpenseItems(true);else if(typeof window.loadStaffExpenseBootstrap==='function')await window.loadStaffExpenseBootstrap(true)}catch(e){alert('ลบรายการไม่สำเร็จ: '+(e?.message||e))}
  }
  function addDeleteButtons(){
    const body=document.getElementById('expenseBody');if(!body)return;
    body.querySelectorAll('button[onclick^="openExpenseItemModal("]').forEach(edit=>{
      const cell=edit.closest('td');if(!cell||cell.querySelector('.expense-delete-v2'))return;
      const match=(edit.getAttribute('onclick')||'').match(/openExpenseItemModal\((\d+)\)/);if(!match)return;
      const id=Number(match[1]),wrap=document.createElement('div');wrap.className='expense-row-actions-v2';edit.parentNode.insertBefore(wrap,edit);wrap.appendChild(edit);
      const del=document.createElement('button');del.type='button';del.className='expense-soft expense-delete-v2';del.textContent='🗑 ลบ';del.addEventListener('click',()=>deleteStaffExpenseItem(id));wrap.appendChild(del);
    });
  }
  window.deleteStaffExpenseItem=deleteStaffExpenseItem;
  function bootDeleteUi(){installDeleteStyle();addDeleteButtons();const body=document.getElementById('expenseBody');if(body)new MutationObserver(addDeleteButtons).observe(body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootDeleteUi,{once:true});else bootDeleteUi();
})();

/* Header navigation: move the real Back/Home nav into the same row as login/status. */
(function(){
  'use strict';
  const STYLE_ID='header-actions-v4-style';
  const WRAP_ID='headerActionsV4';
  function installStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${WRAP_ID}{position:absolute;right:24px;top:20px;z-index:11060;display:flex;align-items:center;justify-content:flex-end;gap:8px;max-width:calc(100% - 48px)}
      #${WRAP_ID} .global-workspace-navigation{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:flex!important;align-items:center!important;gap:8px!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important}
      #${WRAP_ID} .global-workspace-navigation button{flex:0 0 auto!important;margin:0!important;padding:10px 12px!important;white-space:nowrap!important}
      #${WRAP_ID} #topLoginButton,#${WRAP_ID} .top-login{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;margin:0!important;white-space:nowrap!important;flex:0 0 auto!important}
      .main-shell .header{position:relative!important;padding-right:540px!important}
      @media(max-width:1050px){#${WRAP_ID}{position:static!important;width:100%;max-width:none;margin:10px 0 0;justify-content:flex-end;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.main-shell .header{padding-right:12px!important}}
      @media(max-width:620px){#${WRAP_ID}{gap:6px;justify-content:flex-start}#${WRAP_ID} .global-workspace-navigation{gap:6px!important}#${WRAP_ID} .global-workspace-navigation button,#${WRAP_ID} #topLoginButton,#${WRAP_ID} .top-login{padding:9px 10px!important;font-size:12px!important}}
    `;document.head.appendChild(style);
  }
  function alignHeaderActions(){
    const header=document.querySelector('.main-shell .header')||document.querySelector('.header');
    const login=document.getElementById('topLoginButton');
    const nav=document.querySelector('.global-workspace-navigation');
    if(!header||!login||!nav)return false;
    let wrap=document.getElementById(WRAP_ID);
    if(!wrap){wrap=document.createElement('div');wrap.id=WRAP_ID;wrap.setAttribute('aria-label','การนำทางและสถานะผู้ใช้');header.insertBefore(wrap,header.firstChild)}
    if(nav.parentNode!==wrap)wrap.appendChild(nav);
    if(login.parentNode!==wrap)wrap.appendChild(login);
    const back=nav.querySelector('.workspace-back-button');if(back)back.textContent='← ย้อนกลับ';
    const home=nav.querySelector('.workspace-home-button');if(home)home.textContent='⌂ หน้าหลัก';
    return true;
  }
  function bootHeaderActions(){
    installStyle();
    alignHeaderActions();
    const observer=new MutationObserver(()=>alignHeaderActions());observer.observe(document.body,{childList:true,subtree:true});
    [100,300,800,1500,3000].forEach(ms=>setTimeout(alignHeaderActions,ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootHeaderActions,{once:true});else bootHeaderActions();
})();
