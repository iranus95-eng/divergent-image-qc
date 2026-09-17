(function(){
'use strict';

const API='https://neauzvqroaszvqffahkv.functions.supabase.co/customer-import-api';
const SHEETJS='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const EXPECTED=['mru','pea_no','ca','installation','name','address','latitude','longitude','google_map'];

/* ใช้หลักการเดียวกับ CustomerCSVConverter เดิม */
const COLUMN_MAP={
  'mru-หมายเลข_6_หลัก':'mru',
  'pea_มิเตอร์':'pea_no',
  'ca':'ca',
  'การติดตั้ง':'installation',
  'ชื่อ':'name',
  'ที่อยู่':'address',
  'latitude':'latitude',
  'longitude':'longitude',
  'google_map':'google_map',
  /* รองรับไฟล์ที่แปลงมาแล้วด้วย */
  'mru':'mru','pea_no':'pea_no','installation':'installation','name':'name','address':'address'
};
const SOURCE_LABELS={
  mru:'mru-หมายเลข_6_หลัก',pea_no:'pea_มิเตอร์',ca:'ca',installation:'การติดตั้ง',name:'ชื่อ',address:'ที่อยู่',latitude:'latitude',longitude:'longitude',google_map:'google_map'
};

let selectedFile=null;
let convertedRows=[];
let convertedFile='';
let convertedCsv='';
let xlsxLoading=null;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalizeSourceHeader(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,'_')}
function toText(v){if(v===null||v===undefined)return'';return String(v).trim()}
function toCoord(v){const s=toText(v);if(!s)return'';const n=Number(s.replace(/,/g,''));return Number.isFinite(n)?n:s}
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
  xlsxLoading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=SHEETJS;s.async=true;s.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('โหลดตัวอ่าน Excel ไม่สำเร็จ'));s.onerror=()=>reject(Error('โหลดตัวอ่าน Excel ไม่สำเร็จ'));document.head.appendChild(s)});
  return xlsxLoading;
}

function convertMatrix(matrix){
  if(!Array.isArray(matrix)||!matrix.length)throw Error('ไม่พบข้อมูลในไฟล์');
  const sourceHeaders=(matrix[0]||[]).map(normalizeSourceHeader);
  const mapped={};
  sourceHeaders.forEach((h,i)=>{const key=COLUMN_MAP[h];if(key&&!Object.prototype.hasOwnProperty.call(mapped,key))mapped[key]=i});
  const missing=EXPECTED.filter(k=>mapped[k]===undefined);
  if(missing.length)throw Error('ไม่พบคอลัมน์ต้นฉบับ: '+missing.map(k=>SOURCE_LABELS[k]||k).join(', '));
  return matrix.slice(1)
    .filter(row=>Array.isArray(row)&&row.some(v=>toText(v)!==''))
    .map(row=>({
      mru:toText(row[mapped.mru]),
      pea_no:toText(row[mapped.pea_no]),
      ca:toText(row[mapped.ca]),
      installation:toText(row[mapped.installation]),
      name:toText(row[mapped.name]),
      address:toText(row[mapped.address]),
      latitude:toCoord(row[mapped.latitude]),
      longitude:toCoord(row[mapped.longitude]),
      google_map:toText(row[mapped.google_map])
    }));
}
function analyze(rows){
  const count=new Map();let missingPea=0,withCoord=0,withoutCoord=0,invalidCoord=0;
  rows.forEach(r=>{
    const p=toText(r.pea_no);if(!p)missingPea++;else count.set(p,(count.get(p)||0)+1);
    const lat=r.latitude,lng=r.longitude,hasLat=lat!==''&&lat!==null,hasLng=lng!==''&&lng!==null;
    if(!hasLat&&!hasLng)withoutCoord++;
    else if(typeof lat==='number'&&typeof lng==='number'&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180)withCoord++;
    else invalidCoord++;
  });
  let duplicatePea=0;for(const n of count.values())if(n>1)duplicatePea+=n; // เหมือน pandas duplicated(keep=False).sum()
  return {rows:rows.length,missingPea,duplicatePea,withCoord,withoutCoord,invalidCoord,ok:rows.length>0&&missingPea===0&&duplicatePea===0&&invalidCoord===0};
}
function csvCell(v){const s=v===null||v===undefined?'':String(v);return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function makeCsv(rows){return '\ufeff'+EXPECTED.join(',')+'\r\n'+rows.map(r=>EXPECTED.map(k=>csvCell(r[k])).join(',')).join('\r\n')}
function downloadConvertedCsv(){
  if(!convertedCsv||!convertedRows.length)return;
  const blob=new Blob([convertedCsv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=convertedFile||'customers_supabase.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

function style(){if(document.getElementById('customer-import-style-v2'))return;const s=document.createElement('style');s.id='customer-import-style-v2';s.textContent=`
#customerImportV1{position:fixed;inset:0;z-index:11150;background:#f5f7fb;overflow:auto;font-family:Arial,Tahoma,sans-serif;color:#25183d}#customerImportV1 *{box-sizing:border-box}.ci-shell{max-width:1400px;margin:auto;padding:20px}.ci-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.ci-top h1{margin:0;color:#3d1978;font-size:25px}.ci-card{background:#fff;border:1px solid #e8e2f1;border-radius:16px;box-shadow:0 6px 22px rgba(60,30,105,.06);margin-bottom:14px;overflow:hidden}.ci-head{padding:13px 16px;background:#f5f0ff;color:#5630a0;font-weight:900}.ci-body{padding:16px}.ci-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ci-btn{border:0;border-radius:10px;padding:10px 14px;background:#6d35d4;color:#fff;font-weight:800;cursor:pointer}.ci-btn.secondary{background:#fff;color:#5a36a2;border:1px solid #d9cbf4}.ci-btn.green{background:#16794d}.ci-btn:disabled{opacity:.45;cursor:not-allowed}.ci-upload{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ci-file{padding:10px;border:1px dashed #b9a9d8;border-radius:10px;background:#fcfbff;min-width:280px}.ci-step{display:flex;align-items:flex-start;gap:12px}.ci-step-num{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;background:#6d35d4;color:#fff;font-weight:900}.ci-step-copy{flex:1}.ci-stats{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:10px}.ci-stat{border:1px solid #e5deef;border-radius:12px;padding:12px;background:#faf8ff}.ci-stat b{display:block;font-size:22px;color:#4d2b88}.ci-stat span{font-size:12px;color:#756987}.ci-stat.bad b{color:#b4233c}.ci-status{margin-top:12px;padding:10px 12px;border-radius:10px;background:#f2f4f7}.ci-status.ok{background:#ecfdf3;color:#067647}.ci-status.bad{background:#fff1f3;color:#b4233c}.ci-status.wait{background:#fff8e6;color:#8a5b00}.ci-progress{height:10px;background:#eee8f7;border-radius:999px;overflow:hidden;margin-top:10px}.ci-progress>i{display:block;height:100%;width:0;background:#6d35d4;transition:width .2s}.ci-table-wrap{overflow:auto;max-height:420px;border:1px solid #e4dced;border-radius:12px}.ci-table{width:100%;border-collapse:collapse;font-size:12px;min-width:1100px}.ci-table th,.ci-table td{padding:7px 8px;border-bottom:1px solid #eee8f5;text-align:left;white-space:nowrap}.ci-table th{position:sticky;top:0;background:#f5f0ff;z-index:1}.ci-note{font-size:12px;color:#6d627d;margin-top:8px}.ci-result{font-size:14px;line-height:1.65;margin-top:10px}.ci-map{margin-top:10px;padding:10px 12px;background:#f8f6fc;border:1px solid #e6dff0;border-radius:10px;font-size:12px;line-height:1.6}.ci-map code{font-family:Consolas,monospace;color:#4b2b7c}@media(max-width:900px){.ci-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ci-top{align-items:flex-start;flex-direction:column}}`;
  document.head.appendChild(s)}
function setStatus(msg,type=''){const el=document.getElementById('ciStatus');if(!el)return;el.className='ci-status'+(type?' '+type:'');el.textContent=msg}
function setProgress(p){const i=document.querySelector('#ciProgress i');if(i)i.style.width=Math.max(0,Math.min(100,p))+'%'}
function renderStats(a){
  const root=document.getElementById('customerImportV1');if(!root)return;
  const vals={rows:a.rows,missingPea:a.missingPea,duplicatePea:a.duplicatePea,withCoord:a.withCoord,withoutCoord:a.withoutCoord,invalidCoord:a.invalidCoord};
  Object.entries(vals).forEach(([k,v])=>{const el=root.querySelector(`[data-stat="${k}"] b`);if(el)el.textContent=Number(v).toLocaleString('th-TH');const box=root.querySelector(`[data-stat="${k}"]`);if(box)box.classList.toggle('bad',['missingPea','duplicatePea','invalidCoord'].includes(k)&&v>0)});
  const btn=document.getElementById('ciImport');if(btn)btn.disabled=!(convertedRows.length&&a.ok);
}
function renderPreview(rows){const tb=document.getElementById('ciPreviewBody');if(!tb)return;tb.innerHTML=rows.slice(0,20).map((r,i)=>`<tr><td>${i+1}</td>${EXPECTED.map(k=>`<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10">ยังไม่มีข้อมูลที่แปลงแล้ว</td></tr>'}
function resetConverted(){
  convertedRows=[];convertedFile='';convertedCsv='';renderStats(analyze([]));renderPreview([]);setProgress(0);
  const dl=document.getElementById('ciDownloadCsv'),imp=document.getElementById('ciImport');if(dl)dl.disabled=true;if(imp)imp.disabled=true;
}
function selectFile(file){
  selectedFile=file||null;resetConverted();
  const name=document.getElementById('ciFileName'),convert=document.getElementById('ciConvert');
  if(name)name.textContent=file?file.name:'ยังไม่ได้เลือกไฟล์';if(convert)convert.disabled=!file;
  setStatus(file?'เลือกไฟล์แล้ว กรุณากด “แปลงเป็น CSV” ก่อนนำเข้าฐานข้อมูล':'เลือกไฟล์ Excel เพื่อเริ่มต้น',file?'wait':'');
  const r=document.getElementById('ciResult');if(r)r.innerHTML='';
}
async function convertSelectedFile(){
  if(!selectedFile)return;
  const btn=document.getElementById('ciConvert');if(btn)btn.disabled=true;resetConverted();setStatus('กำลังแปลง Excel เป็นรูปแบบ CSV ของฐานข้อมูล...','wait');
  try{
    const XLSX=await loadXlsx();const buf=await selectedFile.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:false});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw Error('ไม่พบ Sheet ในไฟล์');
    const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    const rows=convertMatrix(matrix),a=analyze(rows);
    convertedRows=rows;convertedFile=selectedFile.name.replace(/\.[^.]+$/,'')+'_supabase.csv';convertedCsv=makeCsv(rows);
    renderStats(a);renderPreview(rows);
    const dl=document.getElementById('ciDownloadCsv');if(dl)dl.disabled=false;
    const convertedName=document.getElementById('ciConvertedName');if(convertedName)convertedName.textContent='แปลงแล้ว: '+convertedFile+' • '+rows.length.toLocaleString('th-TH')+' แถว';
    if(a.ok)setStatus('✓ แปลง CSV สำเร็จ และตรวจสอบผ่าน • พร้อมนำเข้าฐานข้อมูลเดิม','ok');
    else setStatus('แปลง CSV สำเร็จ แต่ต้องตรวจสอบก่อนอัปโหลด: PEA No. ว่าง '+a.missingPea+' / PEA No. ซ้ำ '+a.duplicatePea+' / พิกัดผิดรูปแบบ '+a.invalidCoord,'bad');
  }catch(e){resetConverted();setStatus('แปลงไฟล์ไม่สำเร็จ: '+(e?.message||e),'bad')}
  finally{if(btn)btn.disabled=!selectedFile}
}
async function runImport(){
  if(!convertedRows.length){setStatus('กรุณากด “แปลงเป็น CSV” ก่อนอัปโหลด','bad');return}
  const a=analyze(convertedRows);if(!a.ok){setStatus('ข้อมูลที่แปลงแล้วยังไม่ผ่านการตรวจสอบ จึงยังอัปโหลดไม่ได้','bad');return}
  if(!confirm('ยืนยันอัปโหลดข้อมูล '+convertedRows.length.toLocaleString('th-TH')+' รายการเข้า Supabase หรือไม่?'))return;
  const btn=document.getElementById('ciImport');if(btn)btn.disabled=true;setProgress(1);setStatus('กำลังเตรียมพื้นที่นำเข้า...','wait');
  try{
    await api('clear_stage');const chunk=500;let sent=0;
    for(let i=0;i<convertedRows.length;i+=chunk){
      const rows=convertedRows.slice(i,i+chunk).map(r=>({...r,latitude:r.latitude===''?null:Number(r.latitude),longitude:r.longitude===''?null:Number(r.longitude)}));
      await api('append_rows',{rows});sent+=rows.length;setProgress(5+Math.round((sent/convertedRows.length)*80));setStatus('กำลังอัปโหลด '+sent.toLocaleString('th-TH')+' / '+convertedRows.length.toLocaleString('th-TH')+' แถว','wait');
    }
    setStatus('กำลังอัปเดตตาราง customers เดิม...','wait');setProgress(90);const out=await api('apply');setProgress(100);setStatus('✓ นำเข้าข้อมูลสำเร็จ','ok');
    const r=document.getElementById('ciResult');if(r)r.innerHTML=`<b>ผลการนำเข้า ${esc(convertedFile)}</b><br>ข้อมูลนำเข้า: ${(out.import_rows||0).toLocaleString('th-TH')} แถว<br>เพิ่มใหม่: ${(out.new_rows||0).toLocaleString('th-TH')} ราย<br>อัปเดตเดิม: ${(out.update_rows||0).toLocaleString('th-TH')} ราย<br>customers ทั้งหมด: ${(out.total_customers||0).toLocaleString('th-TH')} ราย`;
    await refreshStatus();
  }catch(e){try{await api('clear_stage')}catch(_){}setProgress(0);setStatus('นำเข้าไม่สำเร็จ: '+(e?.message||e),'bad');if(btn)btn.disabled=false}
}
async function refreshStatus(){try{const d=await api('status');const el=document.getElementById('ciDbStatus');if(el)el.textContent='ฐาน customers ปัจจุบัน '+Number(d.total_customers||0).toLocaleString('th-TH')+' ราย'}catch(e){const el=document.getElementById('ciDbStatus');if(el)el.textContent='ไม่สามารถอ่านสถานะฐานข้อมูลได้'}}

function openImport(){
  style();document.getElementById('customerImportV1')?.remove();selectedFile=null;convertedRows=[];convertedFile='';convertedCsv='';
  const root=document.createElement('div');root.id='customerImportV1';root.innerHTML=`<div class="ci-shell">
    <div class="ci-top"><div><h1>นำเข้าข้อมูลลูกค้า</h1><div class="ci-note" id="ciDbStatus">กำลังตรวจสอบฐานข้อมูล...</div></div><button class="ci-btn secondary" id="ciClose">← กลับ</button></div>
    <div class="ci-card"><div class="ci-head">1. เลือกไฟล์ Excel ต้นฉบับ</div><div class="ci-body"><div class="ci-upload"><input class="ci-file" id="ciFile" type="file" accept=".xlsx,.xls"><span id="ciFileName">ยังไม่ได้เลือกไฟล์</span></div><div class="ci-map"><b>คอลัมน์ต้นฉบับที่โปรแกรม Converter ใช้:</b><br><code>mru-หมายเลข_6_หลัก → mru</code> • <code>pea_มิเตอร์ → pea_no</code> • <code>ca → ca</code> • <code>การติดตั้ง → installation</code> • <code>ชื่อ → name</code> • <code>ที่อยู่ → address</code> • <code>latitude</code> • <code>longitude</code> • <code>google_map</code></div></div></div>
    <div class="ci-card"><div class="ci-head">2. แปลงไฟล์ก่อนอัปโหลด</div><div class="ci-body"><div class="ci-actions"><button class="ci-btn" id="ciConvert" disabled>แปลงเป็น CSV</button><button class="ci-btn secondary" id="ciDownloadCsv" disabled>ดาวน์โหลด CSV ที่แปลงแล้ว</button><span id="ciConvertedName" class="ci-note"></span></div><div class="ci-note">ทำงานเหมือนโปรแกรม CustomerCSVConverter เดิม: เปลี่ยนชื่อคอลัมน์ต้นฉบับ → เลือกเฉพาะ 9 คอลัมน์ → ตัดแถวว่าง → ตรวจ PEA No. แล้วจึงเปิดให้อัปโหลด</div></div></div>
    <div class="ci-card"><div class="ci-head">3. ตรวจสอบไฟล์ที่แปลงแล้ว</div><div class="ci-body"><div class="ci-stats"><div class="ci-stat" data-stat="rows"><b>0</b><span>จำนวนทั้งหมด</span></div><div class="ci-stat" data-stat="missingPea"><b>0</b><span>PEA No. ว่าง</span></div><div class="ci-stat" data-stat="duplicatePea"><b>0</b><span>PEA No. ซ้ำ</span></div><div class="ci-stat" data-stat="withCoord"><b>0</b><span>มีพิกัด</span></div><div class="ci-stat" data-stat="withoutCoord"><b>0</b><span>ไม่มีพิกัด</span></div><div class="ci-stat" data-stat="invalidCoord"><b>0</b><span>พิกัดผิดรูปแบบ</span></div></div><div class="ci-status" id="ciStatus">เลือกไฟล์ Excel เพื่อเริ่มต้น</div><div class="ci-progress" id="ciProgress"><i></i></div></div></div>
    <div class="ci-card"><div class="ci-head">4. ตัวอย่าง CSV หลัง Convert</div><div class="ci-body"><div class="ci-table-wrap"><table class="ci-table"><thead><tr><th>#</th>${EXPECTED.map(k=>'<th>'+k+'</th>').join('')}</tr></thead><tbody id="ciPreviewBody"><tr><td colspan="10">ยังไม่มีข้อมูลที่แปลงแล้ว</td></tr></tbody></table></div></div></div>
    <div class="ci-card"><div class="ci-head">5. อัปโหลดเข้าฐานข้อมูลเดิม</div><div class="ci-body"><div class="ci-actions"><button class="ci-btn green" id="ciImport" disabled>อัปโหลดเข้าฐานข้อมูล</button><button class="ci-btn secondary" id="ciReset">ล้างไฟล์</button></div><div class="ci-note">customers_import → apply_customer_import → customers • ใช้ตารางเดิมทั้งหมด • ไม่มีส่วนจัดการผู้ใช้งาน</div><div class="ci-result" id="ciResult"></div></div></div>
  </div>`;
  document.body.appendChild(root);
  root.querySelector('#ciClose').onclick=()=>root.remove();
  root.querySelector('#ciReset').onclick=openImport;
  root.querySelector('#ciConvert').onclick=convertSelectedFile;
  root.querySelector('#ciDownloadCsv').onclick=downloadConvertedCsv;
  root.querySelector('#ciImport').onclick=runImport;
  root.querySelector('#ciFile').addEventListener('change',e=>selectFile(e.target.files?.[0]||null));
  refreshStatus();
}
window.openCustomerImport=openImport;

async function ensureMenu(){
  let allowed=false;try{await api('status');allowed=true}catch(_){}
  const side=document.querySelector('.side-nav');if(!side)return;
  let nav=document.getElementById('navCustomerImport');
  if(!nav){nav=document.createElement('div');nav.className='nav-item';nav.id='navCustomerImport';nav.innerHTML='<span class="nav-ico">⇧</span><span>นำเข้าข้อมูลลูกค้า</span>';nav.onclick=openImport;const anchor=document.getElementById('navPnL')||document.getElementById('navLocation');anchor?.insertAdjacentElement('afterend',nav);if(!anchor)side.appendChild(nav)}
  else nav.onclick=openImport;
  nav.style.display=allowed?'':'none';
}
function boot(){ensureMenu();[600,1800,4200].forEach(ms=>setTimeout(ensureMenu,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
