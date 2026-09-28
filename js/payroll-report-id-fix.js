/* Payroll print report: ensure full 13-digit national ID is visible. */
(function(){
  'use strict';
  const originalBuild=window.buildMoneyPrintHtml;
  if(typeof originalBuild!=='function')return;

  window.buildMoneyPrintHtml=function(){
    let html=originalBuild.apply(this,arguments);
    if(typeof html!=='string'||!html.includes('รายงานเงินเดือน'))return html;

    // Give national-ID column more room while keeping the full A4 landscape table at 100%.
    html=html.replace(
      '<col style="width:2%"><col style="width:7%"><col style="width:11%"><col style="width:5.5%"><col style="width:7.5%"><col style="width:7%"><col style="width:6.5%"><col style="width:5%"><col style="width:5%"><col style="width:7%"><col style="width:5%"><col style="width:5.5%"><col style="width:6%"><col style="width:4.5%"><col style="width:6.5%"><col style="width:9.5%">',
      '<col style="width:2%"><col style="width:9%"><col style="width:10.5%"><col style="width:5.5%"><col style="width:7.5%"><col style="width:7%"><col style="width:6%"><col style="width:5%"><col style="width:5%"><col style="width:7%"><col style="width:5%"><col style="width:5.5%"><col style="width:6%"><col style="width:4.5%"><col style="width:6.5%"><col style="width:8.5%">'
    );

    html=html.replace(
      '.id,.account{white-space:nowrap;text-align:center}',
      '.id{white-space:nowrap;text-align:center;font-size:6.15pt;letter-spacing:-.02mm}.account{white-space:nowrap;text-align:center}'
    );

    // Printed report should show all 13 digits without spacing that can cause clipping.
    html=html.replace(/<td class="id">([^<]*)<\/td>/g,function(full,value){
      const digits=String(value||'').replace(/\D/g,'');
      return '<td class="id">'+(digits.length===13?digits:value)+'</td>';
    });
    return html;
  };
})();
