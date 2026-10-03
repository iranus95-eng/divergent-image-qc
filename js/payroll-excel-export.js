/* Payroll Excel export (.xlsx) */
(function(){
  'use strict';

  const BUTTON_ID='payrollExcelExportBtn';
  const XLSX_SRC='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  let loadingXlsx=null;

  function installStyle(){
    if(document.getElementById('payroll-excel-export-style'))return;
    const s=document.createElement('style');s.id='payroll-excel-export-style';s.textContent=`
      #${BUTTON_ID}{background:#18794e!important;color:#fff!important;border:1px solid #18794e!important;font-weight:800!important}
      #${BUTTON_ID}:hover{background:#12633f!important}
      #${BUTTON_ID}[disabled]{opacity:.6!important;cursor:wait!important}
    `;document.head.appendChild(s);
  }

  function getRows(){
    try{
      if(typeof payrollVisibleRows!=='undefined'&&Array.isArray(payrollVisibleRows))return payrollVisibleRows.slice();
    }catch(_){}
    try{
      if(typeof payrollGroupedEmployees==='function'&&typeof payrollEmployees!=='undefined'&&Array.isArray(payrollEmployees)){
        return payrollGroupedEmployees(payrollEmployees);
      }
    }catch(_){}
    return [];
  }

  function text(v){return v===null||v===undefined?'':String(v)}
  function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
  function nationalId(x){
    const raw=text(x?.national_id||x?.national_id_last4||'').replace(/\s+/g,'');
    if(!raw)return '';
    try{if(typeof formatNationalIdOriginal==='function')return text(formatNationalIdOriginal(raw));}catch(_){}
    return raw;
  }
  function siteText(x){
    const a=Array.isArray(x?.area_sites)&&x.area_sites.length?x.area_sites:[x?.site_name||''];
    return a.filter(Boolean).join('\n');
  }
  function rateText(x){
    const a=Number(x?.area_count||0)>1&&Array.isArray(x?.area_rates)&&x.area_rates.length?x.area_rates:[x?.rate_per_unit];
    return a.map(v=>Number.isFinite(Number(v))?Number(v).toFixed(2):'').filter(Boolean).join('\n');
  }

  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(loadingXlsx)return loadingXlsx;
    loadingXlsx=new Promise((resolve,reject)=>{
      const old=document.querySelector('script[data-payroll-xlsx-lib]');
      if(old){old.addEventListener('load',()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX_LOAD_FAILED')),{once:true});old.addEventListener('error',()=>reject(new Error('XLSX_LOAD_FAILED')),{once:true});return;}
      const s=document.createElement('script');s.src=XLSX_SRC;s.async=true;s.crossOrigin='anonymous';s.setAttribute('data-payroll-xlsx-lib','1');
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX_LOAD_FAILED'));
      s.onerror=()=>reject(new Error('XLSX_LOAD_FAILED'));
      document.head.appendChild(s);
    }).finally(()=>{loadingXlsx=null;});
    return loadingXlsx;
  }

  function sourceMonth(rows){
    const v=rows.find(x=>x?.source_month)?.source_month||'';
    const m=String(v).match(/\d{4}-\d{2}/);if(m)return m[0];
    const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  async function exportPayrollExcel(){
    const btn=document.getElementById(BUTTON_ID),rows=getRows();
    if(!rows.length){alert('ยังไม่มีข้อมูลเงินเดือนให้ส่งออก');return;}
    const original=btn?.textContent||'📗 ส่งออก Excel';
    if(btn){btn.disabled=true;btn.textContent='กำลังสร้าง Excel...';}
    try{
      const XLSX=await loadXlsx();
      const headers=['ลำดับ','ชื่อพนักงาน','เลขบัตรประชาชน','ไซต์งาน','จำนวนงาน','ค่าแรงต่อราย','ค่าแรงรวม','เงินพิเศษ','รายการหัก','เบิกล่วงหน้า','ค่าเสื้อ','ยอดโอน','ธนาคาร','เลขบัญชี','สถานะ','หมายเหตุ'];
      const data=rows.map(x=>[
        x.source_row??'',
        text(x.employee_name||x.name),
        nationalId(x),
        siteText(x),
        num(x.work_count),
        rateText(x),
        num(x.gross_amount),
        num(x.special_amount),
        num(x.withholding_amount),
        num(x.advance_deduction),
        num(x.shirt_cost),
        num(x.total_amount??x.transfer_amount),
        text(x.bank_name),
        text(x.bank_account),
        x.is_active===false?'ปิด':'ใช้งาน',
        text(x.notes)
      ]);
      const totals=['รวม','','','',data.reduce((s,r)=>s+num(r[4]),0),'',data.reduce((s,r)=>s+num(r[6]),0),data.reduce((s,r)=>s+num(r[7]),0),data.reduce((s,r)=>s+num(r[8]),0),data.reduce((s,r)=>s+num(r[9]),0),data.reduce((s,r)=>s+num(r[10]),0),data.reduce((s,r)=>s+num(r[11]),0),'','','',''];
      const ws=XLSX.utils.aoa_to_sheet([headers,...data,totals]);
      ws['!cols']=[
        {wch:9},{wch:28},{wch:19},{wch:28},{wch:12},{wch:16},{wch:15},{wch:14},{wch:14},{wch:14},{wch:12},{wch:16},{wch:20},{wch:20},{wch:12},{wch:28}
      ];
      ws['!autofilter']={ref:`A1:P${data.length+1}`};
      const moneyCols=['G','H','I','J','K','L'];
      for(let r=2;r<=data.length+2;r++)for(const c of moneyCols){const cell=ws[c+r];if(cell&&typeof cell.v==='number')cell.z='#,##0.00';}
      for(let r=2;r<=data.length+2;r++){const cell=ws['E'+r];if(cell&&typeof cell.v==='number')cell.z='#,##0.00';}
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,'เงินเดือน');
      const month=sourceMonth(rows).replace('-','');
      XLSX.writeFile(wb,`Payroll_${month}.xlsx`,{compression:true});
    }catch(e){
      console.error('payroll excel export',e);
      alert('สร้างไฟล์ Excel ไม่สำเร็จ: '+String(e?.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=original;}
    }
  }

  function injectButton(){
    installStyle();
    if(document.getElementById(BUTTON_ID))return;
    const workspace=document.getElementById('payrollWorkspace');if(!workspace)return;
    const head=workspace.querySelector('.payroll-head');if(!head)return;
    const actions=head.querySelector('div[style*="display:flex"]')||head.lastElementChild;if(!actions)return;
    const b=document.createElement('button');b.type='button';b.id=BUTTON_ID;b.className='payroll-btn payroll-btn-secondary';b.textContent='📗 ส่งออก Excel';b.addEventListener('click',exportPayrollExcel);
    const print=[...actions.querySelectorAll('button')].find(x=>(x.textContent||'').includes('พิมพ์รายงาน'));
    if(print&&print.nextSibling)actions.insertBefore(b,print.nextSibling);else actions.appendChild(b);
  }

  window.exportPayrollExcel=exportPayrollExcel;
  function boot(){injectButton();new MutationObserver(injectButton).observe(document.body,{childList:true,subtree:true});[200,800,1600].forEach(ms=>setTimeout(injectButton,ms));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
