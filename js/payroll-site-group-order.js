/* Payroll site grouping/order: keep each site's employees together; QC always last. */
(function(){
  'use strict';

  function cleanSite(v){
    let s=String(v||'').trim().replace(/\s+/g,' ');
    // Collapse duplicated Thai combining marks caused by historical typing/imports.
    s=s.replace(/([\u0E31\u0E34-\u0E3A\u0E47-\u0E4E])\1+/g,'$1');
    // Known legacy spelling variant: หนองบุัวระเหว -> หนองบัวระเหว.
    s=s.replace(/หนองบุัวระเหว/g,'หนองบัวระเหว');
    return s;
  }

  function siteKey(v){return cleanSite(v).toLocaleLowerCase('th-TH');}
  function isQcSite(v){
    const s=siteKey(v);
    return s.includes('qc')||s.includes('คิวซี')||s.includes('ตรวจงาน');
  }
  function rowNo(v){const n=Number(v);return Number.isFinite(n)?n:999999999;}
  function profileKey(row){return row?.profile_id?('profile:'+row.profile_id):('row:'+row?.id);}

  function primarySiteByProfile(rows){
    const map=new Map();
    const sorted=(rows||[]).slice().sort((a,b)=>rowNo(a?.source_row)-rowNo(b?.source_row));
    for(const row of sorted){
      const key=profileKey(row);
      if(!map.has(key))map.set(key,cleanSite(row?.site_name));
    }
    return map;
  }

  function siteOrderMap(rows,primaryMap){
    const first=new Map();
    const profileFirstRow=new Map();
    for(const row of rows||[]){
      const pk=profileKey(row),r=rowNo(row?.source_row);
      if(!profileFirstRow.has(pk)||r<profileFirstRow.get(pk))profileFirstRow.set(pk,r);
    }
    for(const [pk,site] of primaryMap.entries()){
      if(isQcSite(site))continue;
      const key=siteKey(site),r=profileFirstRow.get(pk)??999999999;
      if(!first.has(key)||r<first.get(key))first.set(key,r);
    }
    return new Map([...first.entries()].sort((a,b)=>a[1]-b[1]).map(([key],i)=>[key,i]));
  }

  function groupPayrollRows(rows){
    const primaryMap=primarySiteByProfile(rows);
    const orderMap=siteOrderMap(rows,primaryMap);
    const groups=new Map();
    const sumKeys=['work_count','gross_amount','special_amount','withholding_amount','advance_deduction','shirt_cost','total_amount','transfer_amount'];

    const sorted=(rows||[]).slice().sort((a,b)=>rowNo(a?.source_row)-rowNo(b?.source_row));
    for(const row of sorted){
      const key=profileKey(row);
      let g=groups.get(key);
      if(!g){
        g={...row,area_rows:[],area_sites:[],area_rates:[],area_count:0,primary_site_name:primaryMap.get(key)||cleanSite(row?.site_name)};
        for(const k of sumKeys)g[k]=0;
        groups.set(key,g);
      }
      g.area_rows.push(row);g.area_count++;
      const site=cleanSite(row?.site_name);
      if(site&&!g.area_sites.some(x=>siteKey(x)===siteKey(site)))g.area_sites.push(site);
      const rate=Number(row?.rate_per_unit);if(Number.isFinite(rate))g.area_rates.push(rate);
      for(const k of sumKeys){
        const v=k==='total_amount'?Number(row?.total_amount??row?.transfer_amount??0):Number(row?.[k]??0);
        if(Number.isFinite(v))g[k]+=v;
      }
      if(!g.app_user_id&&row?.app_user_id)g.app_user_id=row.app_user_id;
    }

    return [...groups.values()].map(g=>({
      ...g,
      site_name:g.area_sites.join(' / ')||g.site_name,
      source_rows:g.area_rows.map(x=>x.source_row).filter(v=>v!==null&&v!==undefined)
    })).sort((a,b)=>{
      const aq=isQcSite(a.primary_site_name),bq=isQcSite(b.primary_site_name);
      if(aq!==bq)return aq?1:-1; // QC inspection always at the bottom.
      const ak=siteKey(a.primary_site_name),bk=siteKey(b.primary_site_name);
      const ao=orderMap.has(ak)?orderMap.get(ak):999999998;
      const bo=orderMap.has(bk)?orderMap.get(bk):999999998;
      if(ao!==bo)return ao-bo;
      // New employees naturally append to the end of their site's group.
      const ar=Math.min(...(a.source_rows?.length?a.source_rows:[a.source_row]).map(rowNo));
      const br=Math.min(...(b.source_rows?.length?b.source_rows:[b.source_row]).map(rowNo));
      if(ar!==br)return ar-br;
      return String(a.employee_name||'').localeCompare(String(b.employee_name||''),'th');
    });
  }

  function install(){
    if(typeof window.payrollGroupedEmployees!=='function')return false;
    if(window.payrollGroupedEmployees.__siteGroupedV1)return true;
    groupPayrollRows.__siteGroupedV1=true;
    window.payrollGroupedEmployees=groupPayrollRows;
    // Re-apply immediately if payroll data is already loaded.
    try{if(typeof filterPayrollEmployees==='function')filterPayrollEmployees();}catch(_){ }
    return true;
  }

  window.payrollCanonicalSiteName=cleanSite;
  window.payrollIsQcSite=isQcSite;
  window.payrollGroupRowsBySite=groupPayrollRows;

  if(!install()){
    let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer);},100);
  }
})();
