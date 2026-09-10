(function(){
'use strict';
const MONTH_ORDER=['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'];
let sourceData=null,currentMonth='สค',searchTerm='';
const el=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=v=>Number(v||0).toLocaleString('th-TH');

async function loadLegacyData(){
  if(sourceData)return sourceData;
  const r=await fetch('/index.html',{cache:'no-store'});
  if(!r.ok)throw new Error('อ่านข้อมูลตั้งเบิกเดิมไม่สำเร็จ HTTP '+r.status);
  const text=await r.text();
  const marker='const CLAIM_SOURCE_DATA=';
  const start=text.indexOf(marker);
  if(start<0)throw new Error('ไม่พบข้อมูล CLAIM_SOURCE_DATA ในระบบเดิม');
  let i=start+marker.length,depth=0,inStr=false,quote='',escNext=false,end=-1;
  for(;i<text.length;i++){
    const ch=text[i];
    if(inStr){if(escNext){escNext=false;continue}if(ch==='\\'){escNext=true;continue}if(ch===quote){inStr=false;quote=''}continue}
    if(ch==='"'||ch==="'"){inStr=true;quote=ch;continue}
    if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){end=i+1;break}}
  }
  if(end<0)throw new Error('โครงสร้างข้อมูลตั้งเบิกเดิมไม่สมบูรณ์');
  const raw=text.slice(start+marker.length,end);
  try{sourceData=JSON.parse(raw)}catch(e){throw new Error('แปลงข้อมูลตั้งเบิกเดิมไม่สำเร็จ')}
  return sourceData;
}

function mount(){
  const ws=document.querySelector('.workspace[data-workspace="claim"]');
  if(!ws||ws.dataset.claimV2Mounted==='1')return;
  ws.dataset.claimV2Mounted='1';
  ws.innerHTML=`<div class="claimv2">
    <div class="claimv2-head"><div><h2>ตั้งเบิกค่าตอบแทน</h2><div id="claimv2State" class="claimv2-state">กำลังอ่านข้อมูลจากระบบเดิม...</div></div>
      <div class="claimv2-controls"><label>เดือน<select id="claimv2Month"></select></label><button id="claimv2Reload" type="button">รีเฟรช</button></div>
    </div>
    <div class="claimv2-kpis">
      <div><span>จำนวนไซด์งาน</span><b id="claimv2Sites">0</b></div>
      <div><span>จำนวนรายตั้งเบิก</span><b id="claimv2Bills">0</b></div>
      <div><span>ยอดตั้งเบิก</span><b id="claimv2Claim">0.00</b></div>
      <div><span>ยอดรับจริง</span><b id="claimv2Received">0.00</b></div>
      <div><span>ค่าปรับ</span><b id="claimv2Penalty">0.00</b></div>
    </div>
    <div class="claimv2-tools"><input id="claimv2Search" type="search" placeholder="ค้นหาไซด์งาน / ผู้ติดต่อ"><span id="claimv2Count"></span></div>
    <div class="claimv2-tablewrap"><table class="claimv2-table"><thead><tr>
      <th>ลำดับ</th><th>การไฟฟ้า / ไซด์งาน</th><th>ผู้ติดต่อ</th><th>จำนวนราย</th><th>ทำจริง</th><th>เรต</th><th>ยอดตั้งเบิก</th><th>ค่าปรับ</th><th>ยอดรับจริง</th><th>วันที่รับเงิน</th>
    </tr></thead><tbody id="claimv2Body"><tr><td colspan="10">กำลังโหลด...</td></tr></tbody></table></div>

    <section class="claimv2-outstanding">
      <div class="claimv2-outstanding-head">
        <div><h3>ยอดค้างแยกตามไซด์งาน</h3><p>แสดงเฉพาะไซด์งานที่ยังมียอดค้าง โดยแยกตามเดือน</p></div>
        <div class="claimv2-outstanding-total"><span>ยอดค้างรวมทุกไซด์</span><b id="claimv2OutstandingGrand">0.00</b></div>
      </div>
      <div id="claimv2OutstandingGroups" class="claimv2-outstanding-groups"><div class="claimv2-empty">กำลังคำนวณยอดค้าง...</div></div>
    </section>
  </div>`;
  el('claimv2Reload').addEventListener('click',()=>{sourceData=null;init()});
  el('claimv2Month').addEventListener('change',e=>{currentMonth=e.target.value;render()});
  el('claimv2Search').addEventListener('input',e=>{searchTerm=String(e.target.value||'').trim().toLowerCase();renderTable()});
  init();
}

async function init(){
  try{
    el('claimv2State').textContent='กำลังอ่านข้อมูลจากระบบเดิม...';
    const data=await loadLegacyData();
    const keys=MONTH_ORDER.filter(k=>data[k]);
    if(!keys.length)throw new Error('ไม่พบข้อมูลรายเดือน');
    if(!data[currentMonth])currentMonth=keys[keys.length-1];
    el('claimv2Month').innerHTML=keys.map(k=>`<option value="${esc(k)}" ${k===currentMonth?'selected':''}>${esc(data[k].label||k)}</option>`).join('');
    el('claimv2State').textContent='เชื่อมข้อมูลระบบเดิมแล้ว ✓';
    render();
    renderOutstanding();
  }catch(e){
    el('claimv2State').textContent='โหลดข้อมูลไม่สำเร็จ';
    el('claimv2Body').innerHTML='<tr><td colspan="10" class="claimv2-error">'+esc(e.message||e)+'</td></tr>';
    if(el('claimv2OutstandingGroups'))el('claimv2OutstandingGroups').innerHTML='<div class="claimv2-empty">'+esc(e.message||e)+'</div>';
  }
}

function monthRows(){return (sourceData&&sourceData[currentMonth]&&sourceData[currentMonth].records)||[]}
function render(){
  const rows=monthRows();
  const bill=rows.reduce((s,r)=>s+Number(r.bill_count||0),0);
  const claim=rows.reduce((s,r)=>s+Number(r.claim_amount||0),0);
  const received=rows.reduce((s,r)=>s+Number(r.received||0),0);
  const penalty=rows.reduce((s,r)=>s+Number(r.penalty_raw||0),0);
  el('claimv2Sites').textContent=num(rows.length);
  el('claimv2Bills').textContent=num(bill);
  el('claimv2Claim').textContent=money(claim);
  el('claimv2Received').textContent=money(received);
  el('claimv2Penalty').textContent=money(penalty);
  const meta=sourceData&&sourceData[currentMonth];
  el('claimv2State').textContent=(meta&&meta.period?meta.period:'เชื่อมข้อมูลระบบเดิมแล้ว ✓');
  renderTable();
}
function renderTable(){
  let rows=monthRows();
  if(searchTerm)rows=rows.filter(r=>[r.branch,r.contact,r.phone].some(v=>String(v||'').toLowerCase().includes(searchTerm)));
  el('claimv2Count').textContent='แสดง '+num(rows.length)+' รายการ';
  if(!rows.length){el('claimv2Body').innerHTML='<tr><td colspan="10">ไม่พบรายการ</td></tr>';return}
  el('claimv2Body').innerHTML=rows.map((r,i)=>`<tr>
    <td>${esc(r.seq||i+1)}</td><td class="claimv2-branch">${esc(r.branch||'-')}</td><td>${esc(r.contact||'-')}${r.phone?'<small>'+esc(r.phone)+'</small>':''}</td>
    <td class="num">${num(r.bill_count)}</td><td class="num">${num(r.actual_count)}</td><td class="num">${money(r.rate)}</td>
    <td class="num">${money(r.claim_amount)}</td><td class="num">${money(r.penalty_raw)}</td><td class="num">${money(r.received)}</td><td>${esc(r.received_date||'-')}</td>
  </tr>`).join('');
}

function outstandingAmount(r){
  const claim=Number(r.claim_amount||0);
  const penalty=Number(r.penalty_raw||0);
  const received=Number(r.received||0);
  return Math.max(0,claim-penalty-received);
}
function buildOutstandingGroups(){
  const groups=new Map();
  if(!sourceData)return groups;
  MONTH_ORDER.forEach(monthKey=>{
    const month=sourceData[monthKey];
    if(!month||!Array.isArray(month.records))return;
    month.records.forEach(r=>{
      const outstanding=outstandingAmount(r);
      if(outstanding<=0.005)return;
      const branch=String(r.branch||'ไม่ระบุไซด์งาน').trim();
      const key=branch.toLowerCase();
      if(!groups.has(key))groups.set(key,{branch,rows:[],total:0});
      const g=groups.get(key);
      g.rows.push({monthKey,monthLabel:month.label||monthKey,claim:Number(r.claim_amount||0),penalty:Number(r.penalty_raw||0),received:Number(r.received||0),outstanding});
      g.total+=outstanding;
    });
  });
  return groups;
}
function renderOutstanding(){
  const host=el('claimv2OutstandingGroups');
  if(!host)return;
  const groups=[...buildOutstandingGroups().values()].sort((a,b)=>a.branch.localeCompare(b.branch,'th'));
  const grand=groups.reduce((s,g)=>s+g.total,0);
  el('claimv2OutstandingGrand').textContent=money(grand);
  if(!groups.length){host.innerHTML='<div class="claimv2-empty">ไม่พบไซด์งานที่มียอดค้าง</div>';return}
  host.innerHTML=groups.map(g=>`<article class="claimv2-outstanding-card">
    <div class="claimv2-outstanding-title"><h4>${esc(g.branch)}</h4><span>ค้าง ${num(g.rows.length)} เดือน</span></div>
    <div class="claimv2-outstanding-tablewrap"><table class="claimv2-outstanding-table">
      <thead><tr><th>เดือน</th><th>ยอดตั้งเบิก</th><th>ค่าปรับ</th><th>รับแล้ว</th><th>ยอดค้าง</th></tr></thead>
      <tbody>${g.rows.map(r=>`<tr><td>${esc(r.monthLabel)}</td><td class="num">${money(r.claim)}</td><td class="num">${money(r.penalty)}</td><td class="num">${money(r.received)}</td><td class="num claimv2-due">${money(r.outstanding)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">รวมยอดค้าง ${esc(g.branch)}</td><td class="num">${money(g.total)}</td></tr></tfoot>
    </table></div>
  </article>`).join('');
}
function boot(){mount();window.addEventListener('divergent:v2-auth',mount)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();