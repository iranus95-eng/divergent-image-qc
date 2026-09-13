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
