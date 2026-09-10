(function(){
'use strict';

const API='https://neauzvqroaszvqffahkv.functions.supabase.co/qc-api';
const BATCH_API='https://neauzvqroaszvqffahkv.functions.supabase.co/qc-batch-data';
const SITES=[
  ['PHUTTHAISONG','การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง'],
  ['NONGSONGHONG','การไฟฟ้าส่วนภูมิภาคสาขาหนองสองห้อง'],
  ['BUAYAI','การไฟฟ้าส่วนภูมิภาคอำเภอบัวใหญ่'],
  ['PRATHAI','การไฟฟ้าส่วนภูมิภาคอำเภอประทาย'],
  ['CHUMPHUANG','การไฟฟ้าส่วนภูมิภาคสาขาชุมพวง'],
  ['CHATTURAT','การไฟฟ้าส่วนภูมิภาคสาขาจัตุรัส'],
  ['BANFANG','การไฟฟ้าส่วนภูมิภาคอำเภอบ้านฝาง'],
  ['KANTHARALAK','การไฟฟ้าส่วนภูมิภาคสาขากันทรลักษ์'],
  ['KAENGKHRO','การไฟฟ้าส่วนภูมิภาคสาขาแก้งคร้อ'],
  ['KOSUM','การไฟฟ้าส่วนภูมิภาคอำเภอโกสุมพิสัย']
];

let currentBatch=null;
let detailData=null;
let imageLimit=30;
let activeFilter='all';
let currentModalIndex=-1;
let modalRequestSeq=0;
const signedUrlCache=new Map();

function token(){
  return window.DivergentV2Auth&&window.DivergentV2Auth.token?window.DivergentV2Auth.token():'';
}

async function post(url,body){
  const t=token();
  if(!t)throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const r=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},
    body:JSON.stringify(body)
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.detail||j.error||('HTTP '+r.status));
  return j;
}

function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmtDate(v){if(!v)return'-';const s=String(v);if(/^\d{8}$/.test(s))return s.slice(0,2)+'/'+s.slice(2,4)+'/'+s.slice(4);return s}
function fmtCoord(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(6):'-'}

function mount(){
  const ws=document.querySelector('.workspace[data-workspace="qc"]');
  if(!ws||ws.dataset.qcv2Mounted==='1')return;
  ws.dataset.qcv2Mounted='1';
  ws.innerHTML=`<div class="qcv2">
    <div class="qcv2-head">
      <div><h2>ตรวจสอบงาน QC</h2><div id="qcv2State" class="qcv2-state">เลือกไซด์งานเพื่อดูชุดภาพล่าสุด</div></div>
      <div class="qcv2-tools">
        <label>ไซด์งาน<select id="qcv2Site"><option value="">-- เลือกไซด์งาน --</option>${SITES.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select></label>
        <button id="qcv2Load" type="button">โหลดรายการ</button>
      </div>
    </div>
    <div id="qcv2Batches" class="qcv2-grid"><div class="qcv2-empty">ยังไม่ได้เลือกไซด์งาน</div></div>
    <div id="qcv2Detail" class="qcv2-detail">
      <div class="qcv2-detail-nav"><button id="qcv2BackBatches" type="button">← กลับไปรายการ Batch</button></div>
      <div class="qcv2-detail-head">
        <div><h3 id="qcv2Title">รายละเอียดชุดภาพ</h3><div id="qcv2Meta" class="qcv2-state"></div></div>
        <div id="qcv2Summary" class="qcv2-summary"></div>
      </div>
      <div id="qcv2Filter" class="qcv2-filter"></div>
      <div id="qcv2Images" class="qcv2-images"></div>
      <button id="qcv2More" class="qcv2-more" type="button" hidden>แสดงเพิ่ม</button>
    </div>
  </div>`;

  el('qcv2Load').addEventListener('click',loadBatches);
  el('qcv2Site').addEventListener('change',()=>{if(el('qcv2Site').value)loadBatches()});
  el('qcv2More').addEventListener('click',()=>{imageLimit+=30;renderImages()});
  el('qcv2BackBatches').addEventListener('click',showBatchList);
  el('qcv2Images').addEventListener('click',handleImageGridClick,true);
  ensureModal();
}

function handleImageGridClick(e){
  const card=e.target&&e.target.closest?e.target.closest('.qcv2-img'):null;
  if(!card||!el('qcv2Images').contains(card))return;
  e.preventDefault();
  e.stopPropagation();
  const i=Number(card.dataset.img);
  openImageAt(i);
}

function visibleImages(){
  return filteredImages().slice(0,imageLimit);
}

function openImageAt(index){
  const imgs=visibleImages();
  if(!imgs.length)return;
  const safeIndex=Math.max(0,Math.min(index,imgs.length-1));
  const x=imgs[safeIndex];
  const map=coordMap();
  currentModalIndex=safeIndex;
  openImageDetail(x,map[String(x.ca||'')]||{},safeIndex,imgs.length);
}

function moveModal(step){
  const imgs=visibleImages();
  if(!imgs.length)return;
  const next=currentModalIndex+step;
  if(next<0||next>=imgs.length)return;
  openImageAt(next);
}

function closeModal(){
  const m=el('qcv2Modal');
  if(m)m.classList.remove('open');
  currentModalIndex=-1;
  modalRequestSeq++;
}

function showBatchList(){
  closeModal();
  currentBatch=null;
  detailData=null;
  el('qcv2Detail').classList.remove('open');
  el('qcv2Batches').classList.remove('qcv2-hidden');
  el('qcv2State').scrollIntoView({behavior:'smooth',block:'start'});
}

function ensureModal(){
  if(el('qcv2Modal'))return;
  const m=document.createElement('div');
  m.id='qcv2Modal';
  m.className='qcv2-modal';
  m.setAttribute('role','dialog');
  m.setAttribute('aria-modal','true');
  m.innerHTML='<div class="qcv2-modal-card"><button id="qcv2ModalClose" class="qcv2-modal-close" type="button" aria-label="ปิด">×</button><div id="qcv2ModalBody"></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)closeModal()});
  el('qcv2ModalClose').addEventListener('click',closeModal);
  document.addEventListener('keydown',e=>{
    if(!m.classList.contains('open'))return;
    if(e.key==='Escape'){e.preventDefault();closeModal()}
    else if(e.key==='ArrowLeft'){e.preventDefault();moveModal(-1)}
    else if(e.key==='ArrowRight'){e.preventDefault();moveModal(1)}
  });
}

async function loadBatches(){
  const siteCode=el('qcv2Site').value;
  if(!siteCode)return;
  closeModal();
  currentBatch=null;
  detailData=null;
  el('qcv2State').textContent='กำลังโหลดรายการ...';
  el('qcv2Batches').classList.remove('qcv2-hidden');
  el('qcv2Batches').innerHTML='<div class="qcv2-empty">กำลังโหลด...</div>';
  el('qcv2Detail').classList.remove('open');
  try{
    const j=await post(API,{action:'batches',siteCode});
    const rows=j.batches||[];
    const totalImages=rows.reduce((s,r)=>s+Number(r.image_count||0),0);
    const totalCa=rows.reduce((s,r)=>s+Number(r.ca_count||0),0);
    el('qcv2State').textContent='พบ '+rows.length+' ชุดภาพ · '+totalImages.toLocaleString()+' รูป · '+totalCa.toLocaleString()+' CA';
    if(!rows.length){el('qcv2Batches').innerHTML='<div class="qcv2-empty">ไม่พบชุดภาพของไซด์นี้</div>';return}
    el('qcv2Batches').innerHTML=rows.map((r,i)=>`<button class="qcv2-batch" type="button" data-i="${i}"><b>${esc(r.site_name||r.site_code)}</b><span>วันที่งาน: ${esc(fmtDate(r.raw_date))}</span><span>ภาพ: ${Number(r.image_count||0).toLocaleString()} รูป · CA: ${Number(r.ca_count||0).toLocaleString()} ราย</span><span>สถานะ: ${esc(r.status||'-')}</span><strong class="qcv2-openhint">กดเพื่อเปิดตรวจสอบ →</strong></button>`).join('');
    el('qcv2Batches').querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{
      el('qcv2Batches').querySelectorAll('.qcv2-batch').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      openBatch(rows[Number(b.dataset.i)]);
    }));
  }catch(e){
    el('qcv2State').textContent='โหลดไม่สำเร็จ';
    el('qcv2Batches').innerHTML='<div class="qcv2-error">'+esc(e.message)+'</div>';
  }
}

async function openBatch(row){
  closeModal();
  currentBatch=row;
  detailData=null;
  imageLimit=30;
  activeFilter='all';
  el('qcv2Batches').classList.add('qcv2-hidden');
  el('qcv2Detail').classList.add('open');
  el('qcv2Title').textContent=(row.site_name||row.site_code)+' · '+fmtDate(row.raw_date);
  el('qcv2Meta').textContent='Batch: '+row.batch_id;
  el('qcv2Summary').innerHTML='<span class="qcv2-pill">กำลังโหลดรายละเอียด...</span>';
  el('qcv2Filter').innerHTML='';
  el('qcv2Images').innerHTML='<div class="qcv2-empty">กำลังโหลดรูปและพิกัด...</div>';
  el('qcv2More').hidden=true;
  requestAnimationFrame(()=>el('qcv2Detail').scrollIntoView({behavior:'smooth',block:'start'}));
  try{
    detailData=await post(BATCH_API,{siteCode:row.site_code,rawDate:row.raw_date,batchId:row.batch_id});
    renderSummary();
    renderFilter();
    renderImages();
  }catch(e){
    el('qcv2Summary').innerHTML='';
    el('qcv2Images').innerHTML='<div class="qcv2-error">'+esc(e.message)+'</div>';
  }
}

function analyze(){
  const coords=detailData&&detailData.coordinates||[];
  let notice=0,meter=0,route=0,good=0,watch=0,risk=0,missing=0;
  for(const x of coords){
    const n=!!(x.notice&&x.notice.actual_latitude!=null&&x.notice.actual_longitude!=null);
    const m=!!(x.meter&&x.meter.latitude!=null&&x.meter.longitude!=null);
    if(n)notice++;
    if(m)meter++;
    const d=x.route&&Number.isFinite(Number(x.route.distance_m))?Number(x.route.distance_m):null;
    if(d!=null){route++;if(d<=200)good++;else if(d<=500)watch++;else risk++}
    else if(!n||!m)missing++;
  }
  return{total:(detailData.images||[]).length,notice,meter,route,good,watch,risk,missing};
}

function renderSummary(){
  const a=analyze();
  el('qcv2Summary').innerHTML=`<span class="qcv2-pill">ภาพ ${a.total.toLocaleString()}</span><span class="qcv2-pill">ใบเตือน ${a.notice}</span><span class="qcv2-pill">มิเตอร์ ${a.meter}</span><span class="qcv2-pill qcv2-ok">≤200 ม. ${a.good}</span><span class="qcv2-pill qcv2-watch">201–500 ม. ${a.watch}</span><span class="qcv2-pill qcv2-risk">>500 ม. ${a.risk}</span><span class="qcv2-pill">พิกัดไม่ครบ ${a.missing}</span>`;
}

function renderFilter(){
  const a=analyze();
  const filters=[['all','ทั้งหมด',a.total],['good','≤200 ม.',a.good],['watch','201–500 ม.',a.watch],['risk','>500 ม.',a.risk],['missing','พิกัดไม่ครบ',a.missing]];
  el('qcv2Filter').innerHTML=filters.map(x=>`<button type="button" data-filter="${x[0]}" class="${activeFilter===x[0]?'active':''}">${x[1]} <b>${x[2]}</b></button>`).join('');
  el('qcv2Filter').querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
    closeModal();
    activeFilter=b.dataset.filter;
    imageLimit=30;
    renderFilter();
    renderImages();
  }));
}

async function signed(objectPath){
  if(!objectPath)return'';
  if(signedUrlCache.has(objectPath))return signedUrlCache.get(objectPath);
  try{
    const j=await post(API,{action:'signed-url',objectPath});
    const url=j.signedUrl||'';
    if(url)signedUrlCache.set(objectPath,url);
    return url;
  }catch(_){return''}
}

async function shareImageToLine(x,c,btn){
  const oldText=btn?btn.textContent:'';
  try{
    if(btn){btn.disabled=true;btn.textContent='กำลังเตรียม LINE...'}
    const url=await signed(x.objectPath);
    if(!url)throw new Error('โหลดลิงก์รูปไม่สำเร็จ');
    const d=c.route&&Number.isFinite(Number(c.route.distance_m))?Number(c.route.distance_m):null;
    const siteName=currentBatch?(currentBatch.site_name||currentBatch.site_code||'-'):'-';
    const workDate=currentBatch?fmtDate(currentBatch.raw_date):'-';
    const batchId=currentBatch&&currentBatch.batch_id?currentBatch.batch_id:'-';
    const text=[
      '❌ ตรวจงาน QC: รูปไม่ผ่าน',
      'Site: '+siteName,
      'วันที่งาน: '+workDate,
      'CA: '+(x.ca||'-'),
      'ไฟล์: '+(x.name||'-'),
      'ระยะทางถนน: '+(d==null?'-':Math.round(d).toLocaleString()+' เมตร'),
      'Batch: '+batchId
    ].join('\n');
    if(window.liff&&liff.isLoggedIn&&liff.isLoggedIn()&&liff.isApiAvailable&&liff.isApiAvailable('shareTargetPicker')){
      if(btn)btn.textContent='เลือกรายชื่อใน LINE...';
      await liff.shareTargetPicker([
        {type:'text',text},
        {type:'image',originalContentUrl:url,previewImageUrl:url}
      ],{isMultiple:true});
      return;
    }
    const copyText=text+'\nรูป: '+url;
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(copyText);
      alert('อุปกรณ์นี้ยังเปิดหน้ารายชื่อ LINE ไม่ได้ ระบบคัดลอกข้อมูลและลิงก์รูปให้แล้ว');
      return;
    }
    throw new Error('กรุณาเปิดผ่าน LINE/LIFF และเข้าสู่ระบบ LINE ก่อน');
  }catch(e){
    if(String(e&&e.name||'')==='AbortError')return;
    alert('แจ้งทาง LINE ไม่สำเร็จ: '+(e&&e.message?e.message:e));
  }finally{
    if(btn){btn.disabled=false;btn.textContent=oldText||'❌ ยืนยันรูปไม่ผ่าน · ส่งเข้า LINE'}
  }
}

function coordMap(){
  const m={};
  for(const x of (detailData&&detailData.coordinates||[]))m[String(x.ca||'')]=x;
  return m;
}

function classification(c){
  const n=!!(c.notice&&c.notice.actual_latitude!=null&&c.notice.actual_longitude!=null);
  const m=!!(c.meter&&c.meter.latitude!=null&&c.meter.longitude!=null);
  const d=c.route&&Number.isFinite(Number(c.route.distance_m))?Number(c.route.distance_m):null;
  if(!n||!m||d==null)return'missing';
  if(d<=200)return'good';
  if(d<=500)return'watch';
  return'risk';
}

function filteredImages(){
  if(!detailData)return[];
  const map=coordMap();
  const imgs=detailData.images||[];
  if(activeFilter==='all')return imgs;
  return imgs.filter(x=>classification(map[String(x.ca||'')]||{})===activeFilter);
}

function renderImages(){
  if(!detailData)return;
  const imgs=filteredImages();
  const shown=imgs.slice(0,imageLimit);
  const map=coordMap();
  if(!shown.length){
    el('qcv2Images').innerHTML='<div class="qcv2-empty">ไม่พบรายการตามตัวกรองนี้</div>';
    el('qcv2More').hidden=true;
    return;
  }
  el('qcv2Images').innerHTML=shown.map((x,i)=>{
    const c=map[String(x.ca||'')]||{};
    const d=c.route&&Number.isFinite(Number(c.route.distance_m))?Number(c.route.distance_m):null;
    const cl=classification(c);
    const label=cl==='good'?'ปกติ':cl==='watch'?'เฝ้าระวัง':cl==='risk'?'ตรวจสอบด่วน':'พิกัดไม่ครบ';
    return `<button class="qcv2-img qcv2-${cl}" type="button" data-img="${i}" aria-label="เปิดรายละเอียด CA ${esc(x.ca||'-')}"><div class="qcv2-empty">กำลังโหลดรูป...</div><b>CA ${esc(x.ca||'-')}</b><small>${esc(x.name)}</small><small>${d==null?'ระยะทาง: -':'ระยะทางถนน: '+Math.round(d).toLocaleString()+' ม.'}</small><span class="qcv2-badge">${label}</span></button>`;
  }).join('');
  shown.forEach((x,i)=>{
    const box=el('qcv2Images').querySelector('[data-img="'+i+'"]');
    signed(x.objectPath).then(url=>{
      if(!box||!box.isConnected)return;
      const holder=box.firstElementChild;
      if(url){
        const im=document.createElement('img');
        im.loading='lazy';
        im.src=url;
        im.alt=x.name;
        im.dataset.full=url;
        holder.replaceWith(im);
      }else holder.textContent='โหลดรูปไม่ได้';
    });
  });
  el('qcv2More').hidden=imgs.length<=imageLimit;
}

async function openImageDetail(x,c,index,total){
  ensureModal();
  const requestId=++modalRequestSeq;
  const d=c.route&&Number.isFinite(Number(c.route.distance_m))?Number(c.route.distance_m):null;
  const n=c.notice||{};
  const m=c.meter||{};
  const body=el('qcv2ModalBody');
  const hasPrev=index>0;
  const hasNext=index<total-1;
  body.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-right:44px;margin-bottom:12px;flex-wrap:wrap">
      <strong>รูป ${index+1} / ${total}</strong>
      <div style="display:flex;gap:8px">
        <button id="qcv2Prev" type="button" ${hasPrev?'':'disabled'}>← ก่อนหน้า</button>
        <button id="qcv2Next" type="button" ${hasNext?'':'disabled'}>ถัดไป →</button>
      </div>
    </div>
    <div class="qcv2-modal-grid">
      <div id="qcv2ModalImage" class="qcv2-modal-image qcv2-empty">กำลังโหลดรูป...</div>
      <div class="qcv2-modal-info">
        <h3>CA ${esc(x.ca||'-')}</h3>
        <p><b>ไฟล์:</b> ${esc(x.name)}</p>
        <p><b>ระยะทางถนน:</b> ${d==null?'-':Math.round(d).toLocaleString()+' เมตร'}</p>
        <div class="qcv2-coord"><strong>พิกัดใบแจ้งเตือน</strong><span>${fmtCoord(n.actual_latitude)}, ${fmtCoord(n.actual_longitude)}</span>${n.actual_latitude!=null&&n.actual_longitude!=null?`<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(n.actual_latitude+','+n.actual_longitude)}">เปิดแผนที่</a>`:''}</div>
        <div class="qcv2-coord"><strong>พิกัดมิเตอร์</strong><span>${fmtCoord(m.latitude)}, ${fmtCoord(m.longitude)}</span>${m.latitude!=null&&m.longitude!=null?`<a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(m.latitude+','+m.longitude)}">เปิดแผนที่</a>`:''}</div>
        <button id="qcv2LineShare" type="button" style="width:100%;margin-top:14px;padding:12px 14px;border:0;border-radius:10px;background:#06c755;color:#fff;font-size:15px;font-weight:800;cursor:pointer">❌ ยืนยันรูปไม่ผ่าน · ส่งเข้า LINE</button>
      </div>
    </div>`;
  el('qcv2Modal').classList.add('open');
  const prev=el('qcv2Prev');
  const next=el('qcv2Next');
  const lineBtn=el('qcv2LineShare');
  if(prev)prev.addEventListener('click',()=>moveModal(-1));
  if(next)next.addEventListener('click',()=>moveModal(1));
  if(lineBtn)lineBtn.addEventListener('click',()=>shareImageToLine(x,c,lineBtn));

  const url=await signed(x.objectPath);
  if(requestId!==modalRequestSeq)return;
  const holder=el('qcv2ModalImage');
  if(!holder)return;
  if(url){
    const im=document.createElement('img');
    im.src=url;
    im.alt=x.name;
    holder.replaceWith(im);
  }else holder.textContent='โหลดรูปไม่ได้';
}

function boot(){
  mount();
  window.addEventListener('divergent:v2-auth',()=>{if(document.body.dataset.auth==='ready')mount()});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();