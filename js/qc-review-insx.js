// QC image review (after clicking a photo): INSX-style layout.
// Left: customer info, Google Map + Street View for the PTC (meter) and INSx (notice) points.
// Right: the photo with zoom in/out and rotate controls, plus the LINE "not passed" button.
(function(){
'use strict';

const state={scale:1,rotate:0,token:0};

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(x){return String(Number(Number(x).toFixed(8)))}
function coordText(p){return p?num(p.lat)+','+num(p.lng):''}
function mapSrc(p){return 'https://maps.google.com/maps?q='+p.lat+','+p.lng+'&z=17&hl=th&output=embed'}
function streetSrc(p){return 'https://maps.google.com/maps?layer=c&cbll='+p.lat+','+p.lng+'&cbp=11,0,0,0,0&hl=th&output=svembed'}
function streetLink(p){return 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint='+p.lat+','+p.lng}
function mapLink(p){return 'https://www.google.com/maps?q='+p.lat+','+p.lng}

function installStyle(){
  if(document.getElementById('qc-review-insx-style'))return;
  const s=document.createElement('style');s.id='qc-review-insx-style';s.textContent=`
  #qcInsxReview{display:none;position:fixed;inset:0;z-index:10000;background:#fff;flex-direction:column;font-family:inherit}
  #qcInsxReview.open{display:flex}
  .qir-bar{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#7b0f7e;color:#fff;font-weight:800;font-size:16px}
  .qir-bar .qir-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qir-bar button{width:auto!important;height:auto!important;margin:0!important;padding:6px 14px!important;border-radius:8px!important;background:#fff!important;color:#7b0f7e!important;font-weight:800;box-shadow:none!important;font-size:14px}
  .qir-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:10px;overflow:hidden}
  .qir-left{overflow:auto;min-height:0;padding-right:4px}
  .qir-info{background:#f1f0f2;border:1px solid #d6d2da;border-radius:10px;padding:10px 16px;font-size:14.5px;line-height:1.95;color:#222}
  .qir-info b{font-weight:600}
  .qir-info .v{text-decoration:underline;text-underline-offset:3px}
  .qir-info .qir-row-inline span{margin-right:14px}
  .qir-cap{text-align:center;font-size:13px;color:#333;margin:10px 0 4px}
  .qir-cap a{color:#5b2bb5;font-size:12px;margin-left:6px}
  .qir-frame{width:100%;height:230px;border:1px solid #cfc9d6;border-radius:6px;display:block;background:#eee}
  .qir-missing{height:70px;display:flex;align-items:center;justify-content:center;border:1px dashed #cfc9d6;border-radius:6px;color:#8a7f96;font-size:13px;background:#faf9fb}
  .qir-right{min-height:0;display:flex;flex-direction:column;background:#f1f0f2;border:1px solid #d6d2da;border-radius:10px;overflow:hidden}
  .qir-tools{display:flex;justify-content:center;gap:6px;padding:10px}
  .qir-tools button{width:42px!important;height:34px!important;margin:0!important;padding:0!important;border-radius:6px!important;background:#fff!important;color:#222!important;border:1px solid #bbb!important;box-shadow:none!important;font-size:17px;font-weight:700}
  .qir-stage{flex:1;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;padding:8px}
  .qir-stage img{max-width:100%;max-height:100%;border-radius:10px;transition:transform .15s ease;transform-origin:center center;cursor:grab}
  .qir-file{color:#d00;font-size:12px;font-weight:700;text-align:center;padding:4px 8px;overflow-wrap:anywhere}
  .qir-actions{padding:10px}
  .qir-actions .line-share-button{margin:0!important;width:100%}
  @media(max-width:900px){.qir-body{grid-template-columns:1fr;overflow:auto}.qir-right{min-height:70vh}.qir-left{overflow:visible}}
  `;document.head.appendChild(s);
}

function ensureModal(){
  let m=document.getElementById('qcInsxReview');
  if(m)return m;
  m=document.createElement('div');m.id='qcInsxReview';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
  m.innerHTML=`
    <div class="qir-bar"><span aria-hidden="true">📣</span><span class="qir-title">ตรวจรูป</span><button type="button" data-qir="close">ปิด</button></div>
    <div class="qir-body">
      <div class="qir-left"><div class="qir-info"></div><div class="qir-maps"></div></div>
      <div class="qir-right">
        <div class="qir-tools">
          <button type="button" data-qir="zin" title="ขยาย">＋</button>
          <button type="button" data-qir="zout" title="ย่อ">－</button>
          <button type="button" data-qir="rr" title="หมุนขวา">↻</button>
          <button type="button" data-qir="rl" title="หมุนซ้าย">↺</button>
        </div>
        <div class="qir-stage"><img alt="ภาพสำหรับตรวจงาน"></div>
        <div class="qir-file"></div>
        <div class="qir-actions"><button type="button" class="line-share-button" data-qir="line">❌ ยืนยันรูปไม่ผ่าน · ส่งเข้า LINE</button></div>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{
    const b=e.target.closest('[data-qir]');if(!b)return;
    const a=b.dataset.qir;
    if(a==='close')return close();
    if(a==='zin')state.scale=Math.min(5,state.scale+0.25);
    if(a==='zout')state.scale=Math.max(0.25,state.scale-0.25);
    if(a==='rr')state.rotate+=90;
    if(a==='rl')state.rotate-=90;
    if(a==='line'){const d=m._data;if(d&&typeof window.shareToLine==='function')window.shareToLine(d.ca,d.name);return}
    applyTransform();
  });
  m.querySelector('.qir-stage').addEventListener('wheel',e=>{
    if(!e.ctrlKey)return;e.preventDefault();
    state.scale=Math.min(5,Math.max(0.25,state.scale+(e.deltaY<0?0.15:-0.15)));applyTransform();
  },{passive:false});
  return m;
}
function applyTransform(){
  const img=document.querySelector('#qcInsxReview .qir-stage img');
  if(img)img.style.transform='scale('+state.scale+') rotate('+state.rotate+'deg)';
}
function close(){
  const m=document.getElementById('qcInsxReview');if(!m)return;
  m.classList.remove('open');
  m.querySelector('.qir-stage img').removeAttribute('src');
  m.querySelector('.qir-maps').innerHTML='';
  document.body.style.overflow=m._prevOverflow||'';
}

function infoHtml(ca,info){
  const v=(x)=>x?'<span class="v">'+esc(x)+'</span>':'<span style="color:#8a7f96">-</span>';
  const dist=info?.distanceText||(info?(!info.notice&&!info.meter?'ไม่มีพิกัดแจ้งเตือนและพิกัดจดหน่วย':!info.notice?'ไม่มีพิกัดแจ้งเตือน':'ไม่มีพิกัดจดหน่วย'):'กำลังโหลด...');
  return `<div class="qir-row-inline"><span><b>CA :</b> ${v(ca)}</span><span><b>PEA No :</b> ${v(info?.peaNo)}</span><span><b>สายการจดหน่วย :</b> ${v(info?.mru)}</span></div>
    <div><b>ชื่อผู้ใช้ไฟ :</b> ${v(info?.name)}</div>
    <div><b>ที่อยู่ :</b> ${info?v(info.address):'กำลังโหลด...'}</div>
    <div><b>ระยะห่าง PTC กับ INSx :</b> ${info&&info.distanceText?v(dist):esc(dist)}</div>`;
}
function mapBlock(label,p,kind){
  if(!p)return `<div class="qir-cap">${esc(label)}</div><div class="qir-missing">ไม่มี${esc(label)}</div>`;
  const isStreet=kind==='street';
  return `<div class="qir-cap">${esc(label)} (${esc(coordText(p))})<a href="${isStreet?streetLink(p):mapLink(p)}" target="_blank" rel="noopener">เปิดใน Google Maps</a></div>
    <iframe class="qir-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen src="${isStreet?streetSrc(p):mapSrc(p)}" title="${esc(label)}"></iframe>`;
}
function mapsHtml(info){
  return mapBlock('พิกัด PTC',info.meter,'map')+mapBlock('พิกัด INSx',info.notice,'map')+
    mapBlock('พิกัด PTC',info.meter,'street')+mapBlock('พิกัด INSx',info.notice,'street');
}

async function openReview(imgElement){
  let data;
  try{data=JSON.parse(decodeURIComponent(imgElement.dataset.review||''))}catch(_){alert('เปิดภาพสำหรับตรวจไม่ได้');return}
  installStyle();
  const m=ensureModal();m._data=data;
  state.scale=1;state.rotate=0;const token=++state.token;
  m.querySelector('.qir-title').textContent='ระบบตรวจรูป · CA '+data.ca;
  const img=m.querySelector('.qir-stage img');img.src=data.src;applyTransform();
  m.querySelector('.qir-file').textContent=data.name||'';
  m.querySelector('.qir-info').innerHTML=infoHtml(data.ca,null);
  m.querySelector('.qir-maps').innerHTML='';
  m._prevOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  m.classList.add('open');
  let info=null;
  try{
    if(typeof window.qcCoordinateLookup==='function')info=await window.qcCoordinateLookup(data.ca);
  }catch(e){console.warn('QC review info',e)}
  if(token!==state.token||!m.classList.contains('open'))return;
  info=info||{notice:null,meter:null,address:'',distanceText:''};
  m.querySelector('.qir-info').innerHTML=infoHtml(data.ca,info);
  m.querySelector('.qir-maps').innerHTML=mapsHtml(info);
}

window.openImageReview=openReview;
window.closeQcInsxReview=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
