(function(){
'use strict';

const API='https://neauzvqroaszvqffahkv.functions.supabase.co/customer-import-api';
const SHEETJS='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const EXPECTED=['mru','pea_no','ca','installation','name','address','latitude','longitude','google_map'];
const ALIASES={
  mru:['mru'],pea_no:['pea_no','pea no','peano','pea'],ca:['ca'],installation:['installation','install','installation_no','installation no'],
  name:['name','customer_name','customer name','ชื่อลูกค้า'],address:['address','ที่อยู่'],latitude:['latitude','lat'],longitude:['longitude','lng','lon','long'],google_map:['google_map','google map','map','googlemap']
};
let parsedRows=[];let parsedFile='';let xlsxLoading=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normHeader(v){return String(v||'').trim().toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ')}
function getToken(){
  try{const t=localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token');if(t)return Promise.resolve(t)}catch(_){}
  try{if(typeof window.getBestDataToken==='function')return Promise.resolve(window.getBestDataToken()).then(v=>v||'')}catch(_){}
  return Promise.resolve('');
}
async function api(action,payload={}){
  const token=await getToken();if(!token)throw Error('AUTH_REQUIRED');
  const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||d.error||('HTTP '+r.status));return d;
}
function loadXlsx(){
  if(window.XLSX)return Promise.resolve(window.XLSX);if(xlsxLoading)return xlsxLoading;
  xlsxLoading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=SHEETJS;s.async=true;s.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('XLSX_LOAD_FAILED'));s.onerror=()=>reject(Error('XLSX_LOAD_FAILED'));document.head.appendChild(s)});
  return xlsxLoading;
}
function colMap(headers){
  const mapped={};const h=headers.map((x,i)=>({i,n:normHeader(x)}));
  for(const key of EXPECTED){const aliases=(ALIASES[key]||[key]).map(normHeader);const hit=h.find(x=>aliases.includes(x.n));if(hit)mapped[key]=hit.i}
  return mapped;
}
function toText(v){if(v===null||v===undefined)return'';return String(v).trim()}
function toCoord(v){const s=toText(v);if(!s)return'';const n=Number(s.replace(/,/g,''));return Number.isFinite(n)?n:s}
function buildRows(matrix){
  if(!matrix.length)throw Error('ไม่พบข้อมูลในไฟล์');
  const headers=matrix[0].map(toText),map=colMap(headers),missing=EXPECTED.filter(k=>map[k]===undefined);if(missing.length)throw Error('ไม่พบคอลัมน์: '+missing.join(', '));
  return matrix.slice(1).filter(row=>row.some(v=>toText(v)!=='')).map(row=>({
    mru:toText(row[map.mru]),pea_no:toText(row[map.pea_no]),ca:toText(row[map.ca]),installation:toText(row[map.installation]),name:toText(row[map.name]),address:toText(row[map.address]),
    latitude:toCoord(row[map.latitude]),longitude:toCoord(row[map.longitude]),google_map:toText(row[map.google_map])
  }));
}
function analyze(rows){
  const seen=new Map(),dups=new Set();let missingPea=0,withCoord=0,withoutCoord=0,invalidCoord=0;
  rows.forEach(r=>{const p=r.pea_no.trim();if(!p)missingPea++;else{if(seen.has(p))dups.add(p);seen.set(p,1)}const lat=r.latitude,lng=r.longitude;const hasLat=lat!==''&&lat!==null,hasLng=lng!==''&&lng!==null;if(!hasLat&&!hasLng)withoutCoord++;else if(typeof lat==='number'&&typeof lng==='number'&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180)withCoord++;else invalidCoord++});
  return {rows:rows.length,missingPea,duplicatePea:dups.size,withCoord,withoutCoord,invalidCoord,ok:rows.length>0&&missingPea===0&&dups.size===0&&invalidCoord===0};
}
function style(){if(document.getElementById('customer-import-style'))return;const s=document.createElement('style');s.id='customer-import-style';s.textContent=`
#customerImportV1{position:fixed;inset:0;z-index:11150;background:#f5f7fb;overflow:auto;font-family:Arial,Tahoma,sans-serif;color:#25183d}#customerImportV1 *{box-sizing:border-box}.ci-shell{max-width:1400px;margin:auto;padding:20px}.ci-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.ci-top h1{margin:0;color:#3d1978;font-size:25px}.ci-card{background:#fff;border:1px solid #e8e2f1;border-radius:16px;box-shadow:0 6px 22px rgba(60,30,105,.06);margin-bottom:14px;overflow:hidden}.ci-head{padding:13px 16px;background:#f5f0ff;color:#5630a0;font-weight:900}.ci-body{padding:16px}.ci-actions{display:flex;gap:8px;flex-wrap:wrap}.ci-btn{border:0;border-radius:10px;padding:10px 14px;background:#6d35d4;color:#fff;font-weight:800;cursor:pointer}.ci-btn.secondary{background:#fff;color:#5a36a2;border:1px solid #d9cbf4}.ci-btn:disabled{opacity:.45;cursor:not-allowed}.ci-upload{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ci-file{padding:10px;border:1px dashed #b9a9d8;border-radius:10px;background:#fcfbff;min-width:280px}.ci-stats{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:10px}.ci-stat{border:1px solid #e5deef;border-radius:12px;padding:12px;background:#faf8ff}.ci-stat b{display:block;font-size:22px;color:#4d2b88}.ci-stat span{font-size:12px;color:#756987}.ci-stat.bad b{color:#b4233c}.ci-status{margin-top:12px;padding:10px 12px;border-radius:10px;background:#f2f4f7}.ci-status.ok{background:#ecfdf3;color:#067647}.ci-status.bad{background:#fff1f3;color:#b4233c}.ci-progress{height:10px;background:#eee8f7;border-radius:999px;overflow:hidden;margin-top:10px}.ci-progress>i{display:block;height:100%;width:0;background:#6d35d4;transition:width .2s}.ci-table-wrap{overflow:auto;max-height:420px;border:1px solid #e4dced;border-radius:12px}.ci-table{width:100%;border-collapse:collapse;font-size:12px;min-width:1100px}.ci-table th,.ci-table td{padding:7px 8px;border-bottom:1px solid #eee8f5;text-align:left;white-space:nowrap}.ci-table th{position:sticky;top:0;background:#f5f0ff;z-index:1}.ci-note{font-size:12px;color:#6d627d;margin-top:8px}.ci-result{font-size:14px;line-height:1.65}@media(max-width:900px){.ci-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ci-top{align-items:flex-start;flex-direction:column}}`;
  document.head.appendChild(s)}
function setStatus(msg,type=''){const el=document.getElementById('ciStatus');if(!el)return;el.className='ci-status'+(type?' '+type:'');el.textContent=msg}
function setProgress(p){const i=document.querySelector('#ciProgress i');if(i)i.style.width=Math.max(0,Math.min(100,p))+'%'}
function renderStats(a){const root=document.getElementById('customerImportV1');if(!root)return;const vals={rows:a.rows,missingPea:a.missingPea,duplicatePea:a.duplicatePea,withCoord:a.withCoord,withoutCoord:a.withoutCoord,invalidCoord:a.invalidCoord};Object.entries(vals).forEach(([k,v])=>{const el=root.querySelector(`[data-stat="${k}"] b`);if(el)el.textContent=Number(v).toLocaleString('th-TH');const box=root.querySelector(`[data-stat="${k}"]`);if(box)box.classList.toggle('bad',['missingPea','duplicatePea','invalidCoord'].includes(k)&&v>0)});const btn=document.getElementById('ciImport');if(btn)btn.disabled=!a.ok}
function renderPreview(rows){const tb=document.getElementById('ciPreviewBody');if(!tb)return;tb.innerHTML=rows.slice(0,20).map((r,i)=>`<tr><td>${i+1}</td>${EXPECTED.map(k=>`<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10">ยังไม่มีข้อมูล</td></tr>'}
async function parseFile(file){
  parsedRows=[];parsedFile='';renderStats(analyze([]));renderPreview([]);setProgress(0);setStatus('กำลังอ่านไฟล์...');
  const XLSX=await loadXlsx();const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw Error('ไม่พบ Sheet ในไฟล์');const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});const rows=buildRows(matrix);const a=analyze(rows);parsedRows=rows;parsedFile=file.name;renderStats(a);renderPreview(rows);const name=document.getElementById('ciFileName');if(name)name.textContent=file.name+' • '+rows.length.toLocaleString('th-TH')+' แถว';
  if(a.ok)setStatus('ตรวจสอบผ่าน พร้อมนำเข้าฐานข้อมูลเดิม', 'ok');else setStatus('ต้องแก้ข้อมูลก่อนนำเข้า: PEA No. ว่าง '+a.missingPea+' / ซ้ำ '+a.duplicatePea+' / พิกัดไม่ถูกต้อง '+a.invalidCoord, 'bad');
}
async function runImport(){
  const a=analyze(parsedRows);if(!a.ok)return;const btn=document.getElementById('ciImport');if(btn)btn.disabled=true;setProgress(1);setStatus('กำลังเตรียมพื้นที่นำเข้า...');
  try{
    await api('clear_stage');const chunk=500;let sent=0;
    for(let i=0;i<parsedRows.length;i+=chunk){const rows=parsedRows.slice(i,i+chunk);await api('append_rows',{rows});sent+=rows.length;setProgress(5+Math.round((sent/parsedRows.length)*80));setStatus('กำลังอัปโหลด '+sent.toLocaleString('th-TH')+' / '+parsedRows.length.toLocaleString('th-TH')+' แถว')}
    setStatus('กำลังอัปเดตตาราง customers เดิม...');setProgress(90);const out=await api('apply');setProgress(100);setStatus('นำเข้าข้อมูลสำเร็จ','ok');const r=document.getElementById('ciResult');if(r)r.innerHTML=`<b>ผลการนำเข้า ${esc(parsedFile)}</b><br>ข้อมูลนำเข้า: ${(out.import_rows||0).toLocaleString('th-TH')} แถว<br>เพิ่มใหม่: ${(out.new_rows||0).toLocaleString('th-TH')} ราย<br>อัปเดตเดิม: ${(out.update_rows||0).toLocaleString('th-TH')} ราย<br>customers ทั้งหมด: ${(out.total_customers||0).toLocaleString('th-TH')} ราย`;
    await refreshStatus();
  }catch(e){try{await api('clear_stage')}catch(_){}setProgress(0);setStatus('นำเข้าไม่สำเร็จ: '+(e?.message||e),'bad');if(btn)btn.disabled=false}
}
async function refreshStatus(){try{const d=await api('status');const el=document.getElementById('ciDbStatus');if(el)el.textContent='ฐาน customers ปัจจุบัน '+Number(d.total_customers||0).toLocaleString('th-TH')+' ราย'}catch(e){const el=document.getElementById('ciDbStatus');if(el)el.textContent='ไม่สามารถอ่านสถานะฐานข้อมูลได้'}}
function openImport(){
  style();document.getElementById('customerImportV1')?.remove();parsedRows=[];parsedFile='';
  const root=document.createElement('div');root.id='customerImportV1';root.innerHTML=`<div class="ci-shell"><div class="ci-top"><div><h1>นำเข้าข้อมูลลูกค้า</h1><div class="ci-note" id="ciDbStatus">กำลังตรวจสอบฐานข้อมูล...</div></div><button class="ci-btn secondary" id="ciClose">← กลับ</button></div><div class="ci-card"><div class="ci-head">1. เลือกไฟล์ Excel</div><div class="ci-body"><div class="ci-upload"><input class="ci-file" id="ciFile" type="file" accept=".xlsx,.xls,.csv"><span id="ciFileName">ยังไม่ได้เลือกไฟล์</span></div><div class="ci-note">ใช้ตารางเดิม: customers_import → apply_customer_import → customers • ไม่สร้างตารางลูกค้าใหม่ • ไม่มีเมนูจัดการผู้ใช้งานในหน้านี้</div></div></div><div class="ci-card"><div class="ci-head">2. ตรวจสอบข้อมูลก่อนนำเข้า</div><div class="ci-body"><div class="ci-stats"><div class="ci-stat" data-stat="rows"><b>0</b><span>จำนวนทั้งหมด</span></div><div class="ci-stat" data-stat="missingPea"><b>0</b><span>PEA No. ว่าง</span></div><div class="ci-stat" data-stat="duplicatePea"><b>0</b><span>PEA No. ซ้ำ</span></div><div class="ci-stat" data-stat="withCoord"><b>0</b><span>มีพิกัด</span></div><div class="ci-stat" data-stat="withoutCoord"><b>0</b><span>ไม่มีพิกัด</span></div><div class="ci-stat" data-stat="invalidCoord"><b>0</b><span>พิกัดผิดรูปแบบ</span></div></div><div class="ci-status" id="ciStatus">เลือกไฟล์ Excel เพื่อเริ่มตรวจสอบ</div><div class="ci-progress" id="ciProgress"><i></i></div></div></div><div class="ci-card"><div class="ci-head">3. ตัวอย่างข้อมูล</div><div class="ci-body"><div class="ci-table-wrap"><table class="ci-table"><thead><tr><th>#</th>${EXPECTED.map(k=>'<th>'+k+'</th>').join('')}</tr></thead><tbody id="ciPreviewBody"><tr><td colspan="10">ยังไม่มีข้อมูล</td></tr></tbody></table></div></div></div><div class="ci-card"><div class="ci-head">4. นำเข้าฐานข้อมูล</div><div class="ci-body"><div class="ci-actions"><button class="ci-btn" id="ciImport" disabled>นำเข้าฐานข้อมูล</button><button class="ci-btn secondary" id="ciReset">ล้างไฟล์</button></div><div class="ci-result" id="ciResult"></div></div></div></div>`;
  document.body.appendChild(root);root.querySelector('#ciClose').onclick=()=>root.remove();root.querySelector('#ciReset').onclick=()=>openImport();root.querySelector('#ciImport').onclick=runImport;root.querySelector('#ciFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)parseFile(f).catch(err=>{setStatus('อ่านไฟล์ไม่สำเร็จ: '+(err?.message||err),'bad');renderStats(analyze([]))})});refreshStatus();
}
window.openCustomerImport=openImport;

async function ensureMenu(){
  let allowed=false;try{await api('status');allowed=true}catch(_){}
  const side=document.querySelector('.side-nav');if(!side)return;
  let nav=document.getElementById('navCustomerImport');if(!nav){nav=document.createElement('div');nav.className='nav-item';nav.id='navCustomerImport';nav.innerHTML='<span class="nav-ico">⇧</span><span>นำเข้าข้อมูลลูกค้า</span>';nav.onclick=openImport;const anchor=document.getElementById('navPnL')||document.getElementById('navLocation');anchor?.insertAdjacentElement('afterend',nav);if(!anchor)side.appendChild(nav)}
  nav.style.display=allowed?'':'none';
}
function boot(){ensureMenu();[600,1800,4200].forEach(ms=>setTimeout(ensureMenu,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
