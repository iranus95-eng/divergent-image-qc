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
