/* Staff expense print report V2 — grouped by employee with per-person totals. */
(function(){
  'use strict';

  const originalBuild = window.buildMoneyPrintHtml;
  const originalPreview = window.refreshMoneyReportPreview;

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function money(v){
    return Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function safeRows(){
    try{
      if(typeof window.moneyReportRows==='function')return window.moneyReportRows()||[];
      if(typeof moneyReportRows==='function')return moneyReportRows()||[];
    }catch(_){}
    return [];
  }
  function currentType(){
    try{if(typeof moneyReportType!=='undefined')return moneyReportType;}catch(_){}
    const title=(document.getElementById('moneyReportTitle')?.textContent||'');
    return title.includes('ค่าใช้จ่าย')?'expense':'payroll';
  }
  function cycleText(){
    try{
      const id=Number(document.getElementById('expenseCycleSelect')?.value||0);
      if(typeof staffExpenseCycles!=='undefined'&&Array.isArray(staffExpenseCycles)){
        const c=staffExpenseCycles.find(x=>Number(x.id)===id);
        if(c&&typeof expenseCycleLabel==='function')return expenseCycleLabel(c);
      }
    }catch(_){}
    const s=document.getElementById('expenseCycleSelect');
    return s?.selectedOptions?.[0]?.textContent?.trim()||'-';
  }
  function thaiDate(v){
    if(!v)return '-';
    const d=new Date(String(v).length===10?`${v}T00:00:00`:v);
    if(Number.isNaN(d.getTime()))return esc(v);
    return d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'});
  }
  function groupByStaff(rows){
    const map=new Map();
    rows.forEach((x,index)=>{
      const key=String(x.staff_id||x.staff_user_id||x.app_user_id||x.staff_name||`staff-${index}`);
      if(!map.has(key))map.set(key,{name:x.staff_name||'ไม่ระบุชื่อ',bank_name:x.bank_name||'',bank_account:x.bank_account||'',items:[],total:0});
      const g=map.get(key);
      g.items.push(x);
      g.total+=Number(x.amount||0);
      if(!g.bank_name&&x.bank_name)g.bank_name=x.bank_name;
      if(!g.bank_account&&x.bank_account)g.bank_account=x.bank_account;
    });
    return [...map.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'th'));
  }

  function expensePrintHtml(){
    const rows=safeRows();
    const groups=groupByStaff(rows);
    const total=groups.reduce((s,g)=>s+g.total,0);
    const cycle=cycleText();
    const now=new Date().toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
    const approved=rows.filter(x=>String(x.approval_status||'').toUpperCase()==='APPROVED').reduce((s,x)=>s+Number(x.amount||0),0);
    const pending=rows.filter(x=>String(x.approval_status||'').toUpperCase()==='PENDING').reduce((s,x)=>s+Number(x.amount||0),0);

    const staffBlocks=groups.map((g,gi)=>{
      const rowsHtml=g.items.map((x,i)=>`<tr>
        <td class="c">${i+1}</td>
        <td class="c date">${thaiDate(x.expense_date)}</td>
        <td>${esc(x.category_name_snapshot||'-')}</td>
        <td class="detail">${esc(x.other_detail||x.note||'-')}</td>
        <td>${esc(x.payment_method||'-')}</td>
        <td class="num">${money(x.amount)}</td>
      </tr>`).join('');
      const bank=[g.bank_name,g.bank_account].filter(Boolean).join(' • ');
      return `<section class="staff-card">
        <div class="staff-head">
          <div class="staff-ident">
            <span class="staff-no">${gi+1}</span>
            <div><div class="staff-name">${esc(g.name)}</div>${bank?`<div class="staff-meta">บัญชีรับเงิน: ${esc(bank)}</div>`:''}</div>
          </div>
          <div class="staff-total"><span>ยอดรวมของบุคคล</span><b>${money(g.total)} บาท</b></div>
        </div>
        <table class="expense-table">
          <colgroup><col class="col-no"><col class="col-date"><col class="col-cat"><col><col class="col-pay"><col class="col-money"></colgroup>
          <thead><tr><th>ลำดับ</th><th>วันที่</th><th>หมวดค่าใช้จ่าย</th><th>รายละเอียด</th><th>วิธีจ่าย</th><th class="num">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td colspan="5" class="staff-sum-label">รวม ${esc(g.name)}</td><td class="num staff-sum">${money(g.total)}</td></tr></tfoot>
        </table>
      </section>`;
    }).join('');

    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานเบิกค่าใช้จ่าย</title><style>
      @page{size:210mm 297mm;margin:9mm 10mm 10mm}
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      html,body{margin:0;padding:0;background:#fff;color:#202124;font-family:'TH Sarabun New','TH SarabunPSK','Sarabun',Tahoma,sans-serif;font-size:14pt;line-height:1.18}
      body{width:210mm;max-width:210mm;margin:0 auto}
      .report{width:190mm;max-width:190mm;margin:0 auto}
      .top{display:flex;justify-content:space-between;gap:12mm;align-items:flex-start;border-bottom:2px solid #5b2a86;padding-bottom:4mm;margin-bottom:4mm}
      .brand{font-size:11pt;font-weight:800;letter-spacing:.35px;color:#5b2a86;margin-bottom:1mm}.title{font-size:24pt;font-weight:800;line-height:1.05;color:#241233}.subtitle{font-size:12.5pt;color:#655b6b;margin-top:1.5mm}
      .doc-meta{text-align:right;font-size:11.5pt;color:#5f5764;min-width:48mm}.doc-meta b{display:block;color:#2f2534;font-size:12.5pt;margin-bottom:1mm}
      .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm;margin:0 0 4mm}
      .sum-box{border:1px solid #ded4e8;border-radius:3mm;padding:2.7mm 3mm;background:#faf8fc;min-height:17mm}.sum-box span{display:block;font-size:10.5pt;color:#786d7e;margin-bottom:1mm}.sum-box b{display:block;font-size:16pt;line-height:1.05;color:#34213f}.sum-box.total{background:#5b2a86;border-color:#5b2a86}.sum-box.total span,.sum-box.total b{color:#fff}
      .staff-card{border:1.2px solid #cfc5d9;border-radius:3mm;overflow:hidden;margin:0 0 4mm;break-inside:avoid;page-break-inside:avoid;background:#fff}
      .staff-head{display:flex;align-items:center;justify-content:space-between;gap:4mm;padding:2.8mm 3.4mm;background:#f3eef8;border-bottom:1px solid #d8cfe0}
      .staff-ident{display:flex;align-items:center;gap:2.5mm;min-width:0}.staff-no{display:inline-flex;align-items:center;justify-content:center;width:8mm;height:8mm;border-radius:50%;background:#5b2a86;color:#fff;font-size:12pt;font-weight:800;flex:0 0 auto}.staff-name{font-size:16pt;font-weight:800;color:#2d1836;white-space:normal}.staff-meta{font-size:10.5pt;color:#75697b;margin-top:.6mm}
      .staff-total{text-align:right;flex:0 0 auto}.staff-total span{display:block;font-size:10pt;color:#766a7d}.staff-total b{display:block;font-size:15pt;color:#4d1d78;margin-top:.5mm}
      table{width:100%;border-collapse:collapse;table-layout:fixed}.expense-table{font-size:12.2pt}.expense-table th{background:#5b2a86;color:#fff;font-weight:700;padding:1.8mm 1.5mm;border-right:1px solid rgba(255,255,255,.24);vertical-align:middle}.expense-table td{padding:1.8mm 1.5mm;border-right:1px solid #ded8e3;border-top:1px solid #ded8e3;vertical-align:top;overflow-wrap:anywhere}.expense-table th:last-child,.expense-table td:last-child{border-right:0}.expense-table tbody tr:nth-child(even){background:#fcfbfd}
      .col-no{width:9mm}.col-date{width:22mm}.col-cat{width:32mm}.col-pay{width:25mm}.col-money{width:29mm}.c{text-align:center}.num{text-align:right;white-space:nowrap}.date{white-space:nowrap}.detail{line-height:1.16}
      .expense-table tfoot td{background:#f7f3fa;font-weight:800;border-top:1.5px solid #c8b9d5}.staff-sum-label{text-align:right;color:#4e3d57}.staff-sum{font-size:13.5pt;color:#4d1d78}
      .grand{display:flex;justify-content:flex-end;margin-top:1mm}.grand-box{width:78mm;border:1.5px solid #5b2a86;border-radius:3mm;overflow:hidden}.grand-row{display:flex;justify-content:space-between;gap:6mm;padding:2.2mm 3mm;border-bottom:1px solid #ded4e8;font-size:12.5pt}.grand-row:last-child{border-bottom:0;background:#5b2a86;color:#fff;font-size:15pt;font-weight:800}.grand-row b{white-space:nowrap}
      .signs{display:grid;grid-template-columns:repeat(3,1fr);gap:7mm;margin-top:11mm;break-inside:avoid;page-break-inside:avoid}.sign{height:29mm;border:1px solid #bfb7c4;border-radius:2mm;text-align:center;padding:3mm 2mm;font-size:11.5pt;display:flex;flex-direction:column;justify-content:flex-end}.sign-line{border-top:1px solid #555;width:72%;margin:0 auto 2mm}.footer{margin-top:4mm;font-size:9.5pt;color:#8a818e;text-align:right}
      @media print{
        @page{size:210mm 297mm;margin:9mm 10mm 10mm}
        html,body{width:210mm!important;min-width:210mm!important;max-width:210mm!important;margin:0!important;padding:0!important}
        .report{width:190mm!important;min-width:190mm!important;max-width:190mm!important;margin:0 auto!important}
        body{font-size:14pt}.staff-card{box-shadow:none}
      }
    </style></head><body><main class="report">
      <header class="top"><div><div class="brand">DIVERGENT CORPORATION CO., LTD.</div><div class="title">รายงานเบิกค่าใช้จ่าย</div><div class="subtitle">รอบเบิก: ${esc(cycle)}</div></div><div class="doc-meta"><b>รายงานค่าใช้จ่ายพนักงาน</b>สร้างเมื่อ ${esc(now)}<br>จำนวน ${rows.length.toLocaleString('th-TH')} รายการ</div></header>
      <div class="summary"><div class="sum-box"><span>จำนวนพนักงาน</span><b>${groups.length.toLocaleString('th-TH')} คน</b></div><div class="sum-box"><span>อนุมัติแล้ว</span><b>${money(approved)}</b></div><div class="sum-box"><span>รอตรวจสอบ</span><b>${money(pending)}</b></div><div class="sum-box total"><span>ยอดรวมทั้งหมด</span><b>${money(total)} บาท</b></div></div>
      ${staffBlocks||'<div style="padding:20mm;text-align:center;color:#777">ไม่มีรายการค่าใช้จ่ายในช่วงที่เลือก</div>'}
      <div class="grand"><div class="grand-box"><div class="grand-row"><span>จำนวนพนักงาน</span><b>${groups.length.toLocaleString('th-TH')} คน</b></div><div class="grand-row"><span>จำนวนรายการ</span><b>${rows.length.toLocaleString('th-TH')} รายการ</b></div><div class="grand-row"><span>ยอดรวมค่าใช้จ่ายทั้งหมด</span><b>${money(total)} บาท</b></div></div></div>
      <div class="signs"><div class="sign"><div class="sign-line"></div><b>ผู้จัดทำรายงาน</b><span>วันที่ ____ / ____ / ____</span></div><div class="sign"><div class="sign-line"></div><b>ผู้ตรวจสอบ</b><span>วันที่ ____ / ____ / ____</span></div><div class="sign"><div class="sign-line"></div><b>ผู้อนุมัติ</b><span>วันที่ ____ / ____ / ____</span></div></div>
      <div class="footer">Divergent Corporation • Expense Report • A4 Portrait</div>
    </main></body></html>`;
  }

  window.buildMoneyPrintHtml=function(){
    if(currentType()!=='expense'&&typeof originalBuild==='function')return originalBuild();
    return expensePrintHtml();
  };

  window.refreshMoneyReportPreview=function(){
    if(currentType()!=='expense'&&typeof originalPreview==='function')return originalPreview();
    const rows=safeRows();
    const groups=groupByStaff(rows);
    const total=rows.reduce((s,x)=>s+Number(x.amount||0),0);
    const target=document.getElementById('moneyReportPreview');
    if(!target)return;
    target.innerHTML=`<b>รายงานเบิกค่าใช้จ่ายแบบแยกรายบุคคล</b><br>รอบ: ${esc(cycleText())}<br>พนักงาน ${groups.length.toLocaleString('th-TH')} คน • ${rows.length.toLocaleString('th-TH')} รายการ<br><b>ยอดรวม ${money(total)} บาท</b><div style="margin-top:6px;font-size:12px;color:#756681">พิมพ์ A4 แนวตั้ง • รายงานจะแยกกรอบของแต่ละคนและมียอดรวมรายบุคคล</div>`;
  };
})();