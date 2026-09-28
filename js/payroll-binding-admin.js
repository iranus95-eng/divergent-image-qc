/* Payroll binding admin: show linked app account and allow authorized reset. */
(function(){
  'use strict';
  const API='https://neauzvqroaszvqffahkv.functions.supabase.co/payroll-binding-admin';
  const WEB_SESSION_KEY='divergent_web_session_token_v1';
  const FALLBACK_SESSION_KEY='divergent_fallback_session_token';
  let currentMasterRowId=0;
  let currentProfile=null;

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function token(){
    try{const t=localStorage.getItem(WEB_SESSION_KEY)||localStorage.getItem(FALLBACK_SESSION_KEY)||'';if(t)return t;}catch(_){}
    try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t;}}catch(_){}
    try{if(window.liff&&liff.isLoggedIn&&liff.isLoggedIn()&&liff.getAccessToken)return liff.getAccessToken()||'';}catch(_){}
    return '';
  }
  async function api(action,payload={}){
    const t=await token();if(!t)throw new Error('AUTH_REQUIRED');
    const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
    const d=await r.json().catch(()=>({error:'INVALID_RESPONSE'}));
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  }

  function installStyle(){
    if(document.getElementById('payroll-binding-admin-style'))return;
    const s=document.createElement('style');s.id='payroll-binding-admin-style';s.textContent=`
      #payrollBindingAdminSection{border:1px solid #e1d7ef!important;background:#faf7ff!important}
      .payroll-binding-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .payroll-binding-title{font-weight:800;color:#4b2675;font-size:15px}.payroll-binding-sub{font-size:12px;color:#756683;margin-top:3px}
      .payroll-binding-state{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #e8e0ef;color:#3d3047;font-size:13px;line-height:1.5}
      .payroll-binding-state.ok{background:#eefaf2;border-color:#bfe5ca;color:#21683a}.payroll-binding-state.warn{background:#fff7e8;border-color:#f2d39a;color:#865d12}
      .payroll-unbind-btn{background:#fff1f2!important;color:#b4233c!important;border:1px solid #fecdd3!important;padding:9px 13px!important;border-radius:10px!important;font-weight:800!important}
      .payroll-unbind-btn:hover{background:#ffe4e6!important}.payroll-unbind-btn:disabled{opacity:.55;cursor:not-allowed}
    `;document.head.appendChild(s);
  }

  function ensureUi(){
    installStyle();
    if(document.getElementById('payrollBindingAdminSection'))return;
    const rate=document.getElementById('rateSection');
    const form=document.querySelector('#payrollModal .payroll-form');
    if(!form)return;
    const sec=document.createElement('div');
    sec.id='payrollBindingAdminSection';sec.className='payroll-section payroll-wide';
    sec.innerHTML=`<div class="payroll-binding-head"><div><div class="payroll-binding-title">การเชื่อมบัญชีพนักงาน</div><div class="payroll-binding-sub">ใช้แก้กรณีพนักงานกรอกเลขบัตรผิดแล้วไปผูกกับบัญชีอื่น</div></div><button type="button" id="payrollUnbindBtn" class="payroll-unbind-btn" style="display:none">ยกเลิกการผูกบัญชี</button></div><div id="payrollBindingState" class="payroll-binding-state">ยังไม่ได้เลือกพนักงาน</div>`;
    if(rate&&rate.parentNode)rate.parentNode.insertBefore(sec,rate);else form.appendChild(sec);
    sec.querySelector('#payrollUnbindBtn')?.addEventListener('click',unbindCurrent);
  }

  function render(profile){
    ensureUi();currentProfile=profile||null;
    const box=document.getElementById('payrollBindingState'),btn=document.getElementById('payrollUnbindBtn');if(!box||!btn)return;
    if(!profile){box.className='payroll-binding-state';box.textContent='ยังไม่ได้เลือกพนักงาน';btn.style.display='none';return;}
    const u=profile.bound_user;
    if(!profile.app_user_id||!u){
      box.className='payroll-binding-state ok';
      box.innerHTML='<b>ยังไม่ผูกบัญชี</b><br>พนักงานสามารถกรอกเลขบัตรประชาชนในแอปเพื่อเชื่อมข้อมูลได้';
      btn.style.display='none';return;
    }
    const label=[u.username,u.line_display_name].filter(Boolean).join(' • ')||('User #'+u.id);
    box.className='payroll-binding-state warn';
    box.innerHTML='<b>ผูกอยู่กับบัญชี:</b> '+esc(label)+'<br><span style="font-size:12px">หากผูกผิด ให้กด “ยกเลิกการผูกบัญชี” แล้วให้พนักงานเจ้าของเลขบัตรเชื่อมใหม่</span>';
    btn.style.display='inline-block';btn.disabled=false;btn.textContent='ยกเลิกการผูกบัญชี';
  }

  async function loadStatus(masterRowId){
    currentMasterRowId=Number(masterRowId||0);ensureUi();
    const box=document.getElementById('payrollBindingState'),btn=document.getElementById('payrollUnbindBtn');
    if(!currentMasterRowId){render(null);return;}
    if(box){box.className='payroll-binding-state';box.textContent='กำลังตรวจสอบบัญชีที่เชื่อม...';}if(btn)btn.style.display='none';
    try{const d=await api('status',{master_row_id:currentMasterRowId});render(d.profile||null);}catch(e){if(box){box.className='payroll-binding-state warn';box.textContent='ตรวจสอบการผูกบัญชีไม่สำเร็จ: '+(e?.message||e);}}
  }

  async function unbindCurrent(){
    const p=currentProfile;if(!p?.id)return;
    const u=p.bound_user;const label=[u?.username,u?.line_display_name].filter(Boolean).join(' • ')||('User #'+(p.app_user_id||'-'));
    if(!confirm('ยืนยันยกเลิกการผูกบัญชี '+label+' ?\n\nข้อมูลเงินเดือนและเลขบัตรจะไม่ถูกลบ พนักงานสามารถเชื่อมบัญชีใหม่ได้ภายหลัง'))return;
    const reason=prompt('ระบุเหตุผลในการยกเลิกการผูกบัญชี','กรอกเลขบัตรผิด / ผูกผิดบัญชี')||'Admin reset incorrect payroll binding';
    const btn=document.getElementById('payrollUnbindBtn'),box=document.getElementById('payrollBindingState');
    try{
      if(btn){btn.disabled=true;btn.textContent='กำลังยกเลิก...';}
      await api('unbind',{profile_id:p.id,reason});
      if(box){box.className='payroll-binding-state ok';box.innerHTML='<b>ยกเลิกการผูกบัญชีแล้ว ✓</b><br>พนักงานเจ้าของเลขบัตรสามารถเชื่อมข้อมูลใหม่ได้ทันที';}
      if(btn)btn.style.display='none';
      currentProfile={...p,app_user_id:null,bound_at:null,bound_user:null};
      try{if(typeof window.loadPayrollEmployees==='function')await window.loadPayrollEmployees(true);}catch(_){}
    }catch(e){
      alert('ยกเลิกการผูกบัญชีไม่สำเร็จ: '+(e?.message||e));
      if(btn){btn.disabled=false;btn.textContent='ยกเลิกการผูกบัญชี';}
    }
  }

  function wrapOpen(){
    if(window.__payrollBindingAdminWrapped)return;
    const original=window.openPayrollEmployee;if(typeof original!=='function')return;
    window.__payrollBindingAdminWrapped=true;
    window.openPayrollEmployee=async function(id=null){
      const r=await original.apply(this,arguments);
      await loadStatus(id);
      return r;
    };
  }

  function boot(){ensureUi();wrapOpen();[150,600,1500].forEach(ms=>setTimeout(()=>{ensureUi();wrapOpen();},ms));}
  window.payrollBindingAdminRefresh=loadStatus;
  window.payrollBindingAdminUnbind=unbindCurrent;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
