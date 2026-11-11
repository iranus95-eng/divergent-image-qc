/* ค้นหาพิกัดตำแหน่ง: อ่าน CA จากรูปหน้าจอที่พนักงานส่งมา (OCR ในเบราว์เซอร์ด้วย Tesseract.js)
   วางรูป (Ctrl+V) หรือเลือกรูป → แสดงรายการ CA ในรูป → กดรายการเพื่อค้นหาพิกัดทันที
   รายการที่พนักงานติ๊กไว้ในรูปจะถูกเลือกและค้นหาให้อัตโนมัติ */
(function(root){
'use strict';

/* ---------- แยกข้อความ OCR เป็นรายการลูกค้า (pure, ใช้ใน test ได้) ---------- */
function digitsAfter(line,re,min,max){
  const m=line.match(re);if(!m)return'';
  const d=m[1].replace(/[\s.\-]/g,'');
  const run=d.match(new RegExp('\\d{'+min+','+max+'}'));return run?run[0]:'';
}
function textAfterColon(line){const i=line.search(/[:：]/);return(i>=0?line.slice(i+1):'').trim()}

function parseCaItems(lines){
  /* lines: [{text, y0, y1}] ตามลำดับบนลงล่าง */
  const items=[];let cur=null,addrOpen=false;
  for(const ln of lines){
    const t=String(ln.text||'').replace(/\s+/g,' ').trim();if(!t)continue;
    if(/M\s*R\s*U/i.test(t)){
      const n=t.match(/\(\s*(\d{1,3})\s*\)/);
      cur={no:n?Number(n[1]):items.length+1,mru:(t.split(/[:：]/)[1]||'').trim(),ca:'',pea_no:'',name:'',address:'',y0:ln.y0,y1:ln.y1};
      items.push(cur);addrOpen=false;continue;
    }
    if(!cur)continue;
    cur.y1=Math.max(cur.y1,ln.y1);
    if(!cur.ca&&/C\s*A\b/.test(t)){cur.ca=digitsAfter(t,/C\s*A\s*[:：.;]?\s*([0-9][0-9 ]{9,16})/,12,12);addrOpen=false;continue}
    if(!cur.pea_no&&/PEA/i.test(t)){cur.pea_no=digitsAfter(t,/PEA\s*N[o0]\.?\s*[:：.;]?\s*([0-9][0-9 ]{4,14})/i,6,12);addrOpen=false;continue}
    if(!cur.name&&/ชื่อ/.test(t)){cur.name=textAfterColon(t);addrOpen=false;continue}
    if(!cur.address&&/ที่อยู่/.test(t)){cur.address=textAfterColon(t);addrOpen=true;continue}
    if(/Tel|บิลเดือน|วันครบ/i.test(t)){addrOpen=false;continue}
    if(!cur.address&&cur.name&&/[:：]/.test(t)&&/(ต\.|อ\.|จ\.)\S/.test(t)){cur.address=textAfterColon(t);addrOpen=true;continue}
    if(addrOpen&&/^[\sOo0]*\d{5}$/.test(t)){cur.address+=' '+t.replace(/^[\sOo0]*(?=\d{5}$)/,'');addrOpen=false}
  }
  let out=items.filter(x=>/^\d{12}$/.test(x.ca));
  if(!out.length){
    /* รูปแบบอื่น: เก็บเลข 12 หลักขึ้นต้น 020 */
    const seen=new Set();
    lines.forEach(ln=>(String(ln.text||'').replace(/(\d)\s+(?=\d)/g,'$1').match(/\b020\d{9}\b/g)||[]).forEach(ca=>{
      if(seen.has(ca))return;seen.add(ca);out.push({no:out.length+1,mru:'',ca,pea_no:'',name:'',address:'',y0:ln.y0,y1:ln.y1});
    }));
  }
  return out;
}

/* หาเครื่องหมายติ๊กสีเขียวทางซ้ายของรูป → คืนช่วง y ของแต่ละเครื่องหมาย */
function findGreenChecks(px,w,h){
  const x1=Math.max(4,Math.round(w*0.11)),rows=[];
  for(let y=0;y<h;y++){
    let c=0;
    for(let x=0;x<x1;x++){const i=(y*w+x)*4,r=px[i],g=px[i+1],b=px[i+2];if(g>90&&g-r>45&&g-b>15)c++}
    rows.push(c>=Math.max(3,x1*0.15));
  }
  const marks=[];let s=-1;
  for(let y=0;y<=h;y++){
    if(y<h&&rows[y]){if(s<0)s=y}
    else if(s>=0){
      const last=marks[marks.length-1];
      if(last&&s-last.y1<=Math.max(6,h*0.006)){last.y1=y;last.yc=(last.y0+y)/2}else marks.push({y0:s,y1:y,yc:(s+y)/2});
      s=-1;
    }
  }
  return marks.filter(m=>m.y1-m.y0>=Math.max(10,h*0.008));
}
function markChecked(items,marks){
  items.forEach((it,i)=>{
    const next=items[i+1];const top=it.y0,bot=next?next.y0:Infinity;
    it.checked=marks.some(m=>m.yc>=top&&m.yc<bot);
  });
  return items;
}

const api={parseCaItems,findGreenChecks,markChecked};
if(typeof module==='object'&&module.exports){module.exports=api;return}
root.LocationScreenshotCa=api;

/* ---------- UI ---------- */
const TESS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let tessLoading=null,workerPromise=null,busy=false;
const doc=root.document;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function loadTess(){
  if(root.Tesseract)return Promise.resolve(root.Tesseract);if(tessLoading)return tessLoading;
  tessLoading=new Promise((res,rej)=>{const s=doc.createElement('script');s.src=TESS;s.async=true;s.onload=()=>root.Tesseract?res(root.Tesseract):rej(Error('โหลดตัวอ่านรูปไม่สำเร็จ'));s.onerror=()=>{tessLoading=null;rej(Error('โหลดตัวอ่านรูปไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต'))};doc.head.appendChild(s)});
  return tessLoading;
}
function getWorker(){
  if(!workerPromise)workerPromise=loadTess().then(T=>T.createWorker(['tha','eng'])).catch(e=>{workerPromise=null;throw e});
  return workerPromise;
}
function injectCss(){
  if(doc.getElementById('lscaCss'))return;
  const st=doc.createElement('style');st.id='lscaCss';
  st.textContent=`.lsca-drop{margin-top:12px;border:2px dashed #cdb8ee;border-radius:14px;background:#fff;padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;cursor:pointer;transition:.15s}
.lsca-drop:hover,.lsca-drop.drag{border-color:#7b45ca;background:#faf6ff}
.lsca-drop b{color:#4b2a86}.lsca-drop span{color:#6b6480;font-size:14px}
.lsca-drop .lsca-pick{margin:0 0 0 auto;height:40px;padding:0 16px;border-radius:10px;border:1px solid #7b45ca;background:#7b45ca;color:#fff;font-weight:700;cursor:pointer}
.lsca-status{margin-top:10px;font-size:14px;color:#4b2a86}.lsca-status.err{color:#c62828}
.lsca-list{margin-top:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.lsca-list .lsca-item{text-align:left;border:1px solid #e3dbf1;border-radius:12px;background:#fff;padding:10px 12px;cursor:pointer;font:inherit;line-height:1.45;margin:0;color:#222}
.lsca-list .lsca-item:hover{border-color:#7b45ca;box-shadow:0 2px 8px rgba(123,69,202,.12)}
.lsca-list .lsca-item.active{border:2px solid #7b45ca;background:#f4ecff}
.lsca-item .ca{font-size:17px;font-weight:800;letter-spacing:.5px;color:#4b2a86}
.lsca-item .sub{font-size:13px;color:#555}
.lsca-tag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#e6f4ea;color:#1e7e34;font-size:12px;font-weight:700}
.lsca-thumb{max-height:64px;border-radius:8px;border:1px solid #e3dbf1}
#locationWorkspace .ca-search-row.lsca-has-clear{grid-template-columns:minmax(220px,1fr) 170px 120px}
#locationWorkspace .lsca-clear{height:48px;margin:0;border-radius:12px;border:1px solid #ddd2ee;background:#fff;color:#4b2a86;font-weight:700;cursor:pointer}
#locationWorkspace .lsca-clear:hover{background:#faf6ff;border-color:#7b45ca}
@media(max-width:620px){#locationWorkspace .ca-search-row.lsca-has-clear{grid-template-columns:1fr 1fr}#locationWorkspace .ca-search-row.lsca-has-clear input{grid-column:1/-1}}`;
  doc.head.appendChild(st);
}
function setStatus(msg,err){const el=doc.getElementById('lscaStatus');if(!el)return;el.textContent=msg||'';el.classList.toggle('err',!!err);el.style.display=msg?'block':'none'}

async function readImage(file){
  if(busy)return;busy=true;
  const list=doc.getElementById('lscaList');list.innerHTML='';
  const url=URL.createObjectURL(file);
  try{
    doc.getElementById('lscaThumb').innerHTML=`<img class="lsca-thumb" src="${url}" alt="รูปที่วาง">`;
    setStatus('กำลังอ่านตัวเลขในรูป... (ครั้งแรกอาจใช้เวลา 10–20 วินาที)');
    const img=new Image();img.src=url;await img.decode();
    const w=img.naturalWidth,h=img.naturalHeight,cv=doc.createElement('canvas');cv.width=w;cv.height=h;
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
    const marks=findGreenChecks(ctx.getImageData(0,0,w,h).data,w,h);
    const worker=await getWorker();
    const {data}=await worker.recognize(cv);
    const lines=(data.lines||[]).map(l=>({text:l.text,y0:l.bbox.y0,y1:l.bbox.y1}));
    if(!lines.length&&data.text)String(data.text).split('\n').forEach((t,i)=>lines.push({text:t,y0:i,y1:i}));
    const items=markChecked(parseCaItems(lines),marks);
    if(!items.length){setStatus('ไม่พบหมายเลข CA ในรูปนี้ ลองใช้รูปที่ชัดขึ้น หรือพิมพ์ CA เอง',true);return}
    list.innerHTML=items.map((it,i)=>`<div role="button" tabindex="0" class="lsca-item${it.checked?' active':''}" data-i="${i}">
      <div class="ca">(${esc(it.no)}) CA ${esc(it.ca)}${it.checked?'<span class="lsca-tag">✓ พนักงานติ๊กไว้</span>':''}</div>
      ${it.pea_no?`<div class="sub">PEA No. ${esc(it.pea_no)}${it.mru?' · MRU '+esc(it.mru):''}</div>`:''}
      ${it.name?`<div class="sub"><b>${esc(it.name)}</b></div>`:''}
      ${it.address?`<div class="sub">${esc(it.address)}</div>`:''}</div>`).join('');
    list.querySelectorAll('.lsca-item').forEach(b=>{
      const go=()=>{list.querySelectorAll('.lsca-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');search(items[Number(b.dataset.i)].ca)};
      b.addEventListener('click',go);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
    });
    const checked=items.filter(x=>x.checked);
    const auto=checked.length===1?checked[0]:(items.length===1?items[0]:null);
    if(auto){setStatus(`พบ ${items.length} รายการในรูป · ค้นหา CA ${auto.ca} ให้แล้ว (กดรายการอื่นเพื่อค้นหาแทน)`);search(auto.ca)}
    else setStatus(`พบ ${items.length} รายการในรูป · กดรายการที่ต้องการเพื่อค้นหาพิกัด`);
  }catch(e){setStatus('อ่านรูปไม่สำเร็จ: '+(e?.message||e),true)}
  finally{busy=false;URL.revokeObjectURL(url)}
}
function search(ca){
  const input=doc.getElementById('locationCaInput');if(!input)return;
  input.value=ca;
  if(typeof root.searchWorkLocation==='function')root.searchWorkLocation();
}
function clearAll(){
  const set=(id,fn)=>{const el=doc.getElementById(id);if(el)fn(el)};
  set('locationCaInput',el=>{el.value=''});
  set('locationStatus',el=>{el.textContent='';el.style.display='none';el.classList.remove('status-error')});
  set('locationResults',el=>{el.innerHTML=''});
  set('locationDistance',el=>{el.innerHTML=''});
  set('lscaList',el=>{el.innerHTML=''});
  set('lscaThumb',el=>{el.innerHTML=''});
  setStatus('');
  root._compareLocations=null;
  set('locationCaInput',el=>el.focus());
}
root.clearWorkLocationSearch=clearAll;
function firstImage(items){for(const it of items||[]){if(it.kind==='file'&&/^image\//.test(it.type))return it.getAsFile()}return null}

function mount(){
  const panel=doc.querySelector('#locationWorkspace .ca-search-panel');
  if(!panel||doc.getElementById('lscaDrop'))return;
  injectCss();
  const row=panel.querySelector('.ca-search-row');
  if(row&&!row.querySelector('.lsca-clear')){
    row.classList.add('lsca-has-clear');
    row.insertAdjacentHTML('beforeend','<div role="button" tabindex="0" class="lsca-clear" id="lscaClear" title="ล้างการค้นหา" style="display:flex;align-items:center;justify-content:center">ล้างการค้นหา</div>');
    const c=row.querySelector('.lsca-clear');
    c.addEventListener('click',clearAll);c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();clearAll()}});
  }
  panel.insertAdjacentHTML('beforeend',`<div class="lsca-drop" id="lscaDrop" tabindex="0" title="วางรูปหรือเลือกรูป">
    <div id="lscaThumb"></div>
    <div><b>📷 ค้นหาจากรูปที่พนักงานส่งมา</b><br><span>คัดลอกรูปจาก LINE แล้วกด Ctrl+V ที่หน้านี้ ลากรูปมาวาง หรือกดเลือกรูป · ระบบอ่าน CA ให้เอง</span></div>
    <button type="button" class="lsca-pick" id="lscaPick">เลือกรูป</button>
    <input type="file" id="lscaFile" accept="image/*" hidden></div>
    <div class="lsca-status" id="lscaStatus" style="display:none"></div><div class="lsca-list" id="lscaList"></div>`);
  const drop=doc.getElementById('lscaDrop'),file=doc.getElementById('lscaFile');
  drop.addEventListener('click',e=>{if(e.target!==file)file.click()});
  file.addEventListener('change',()=>{if(file.files[0])readImage(file.files[0]);file.value=''});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');const f=[...(e.dataTransfer?.files||[])].find(x=>/^image\//.test(x.type));if(f)readImage(f)});
  doc.addEventListener('paste',e=>{
    const ws=doc.getElementById('locationWorkspace');
    if(!ws||ws.style.display==='none'||!ws.offsetParent)return;
    const f=firstImage(e.clipboardData?.items);if(f){e.preventDefault();readImage(f)}
  });
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window!=='undefined'?window:globalThis);
