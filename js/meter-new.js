/* เมนูค้นหามิเตอร์ใหม่: ลูกค้าที่ยังไม่มีพิกัดรูปงาน
   ใช้ meter-locate-api: พิกัดมิเตอร์ (customers) → บ้านข้างเคียงในสาย MRU → Longdo จากที่อยู่
   แล้วเลือกจุดที่น่าเชื่อที่สุดพร้อมคำเตือนเมื่อแหล่งข้อมูลขัดกัน */
(function(root){
'use strict';

/* ---------- เลือกจุดแนะนำ + คำเตือน (pure, ใช้ใน test ได้) ---------- */
function dist(a,b){const R=6371000,r=Math.PI/180,x=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return Math.round(2*R*Math.asin(Math.sqrt(x)))}
function km(m){return m>=1000?(m/1000).toFixed(1)+' กม.':Math.round(m)+' ม.'}
function recommend(r){
  const far=r.far_m||1000,c=r.checks||{},warns=[];
  const cust=r.customer&&r.customer.lat!=null?r.customer:null;
  const est=r.neighbours&&r.neighbours.estimate;
  const geo=r.longdo&&r.longdo.lat!=null?r.longdo:null;
  let pick=null;
  if(cust&&(!est||c.customer_vs_neighbours_m==null||c.customer_vs_neighbours_m<=far))pick={kind:'customer',label:'พิกัดมิเตอร์ในฐานข้อมูลลูกค้า',lat:cust.lat,lng:cust.lng};
  else if(est){
    pick={kind:'neighbours',label:'ประมาณจากบ้านข้างเคียงในสายจด',lat:est.lat,lng:est.lng};
    if(cust)warns.push(`พิกัดมิเตอร์ในฐานข้อมูลห่างจากบ้านข้างเคียง ${km(c.customer_vs_neighbours_m)} อาจลงพิกัดผิด จึงใช้ตำแหน่งบ้านข้างเคียงแทน`);
  }else if(geo){
    pick={kind:'longdo',label:'ประมาณจากที่อยู่ (Longdo)',lat:geo.lat,lng:geo.lng};
    warns.push('ไม่มีพิกัดมิเตอร์และไม่มีบ้านข้างเคียงที่มีพิกัด ตำแหน่งนี้มาจากที่อยู่อย่างเดียว ความแม่นยำต่ำ');
  }
  if(!cust)warns.unshift('ไม่พบ CA นี้ในฐานข้อมูลลูกค้า (ข้อมูลล่าสุด 1 ต.ค. 69) น่าจะเป็นผู้ใช้ไฟรายใหม่');
  if(est&&r.neighbours.spread_m!=null&&r.neighbours.spread_m>far)warns.push(`บ้านก่อนและหลังในสายจดอยู่ห่างกัน ${km(r.neighbours.spread_m)} ตำแหน่งที่ประมาณอาจคลาดเคลื่อน`);
  if(geo&&c.longdo_vs_neighbours_m!=null&&c.longdo_vs_neighbours_m>far)warns.push(`ที่อยู่ห่างจากบ้านข้างเคียง ${km(c.longdo_vs_neighbours_m)} ที่อยู่อาจเป็นที่อยู่ตามทะเบียน ไม่ใช่ที่ตั้งมิเตอร์`);
  else if(geo&&!est&&cust&&c.longdo_vs_customer_m!=null&&c.longdo_vs_customer_m>far)warns.push(`ที่อยู่ห่างจากพิกัดมิเตอร์ ${km(c.longdo_vs_customer_m)} ที่อยู่อาจไม่ใช่ที่ตั้งมิเตอร์`);
  if(geo&&!geo.has_moo)warns.push('ที่อยู่ไม่มีเลขหมู่ (ม.) ตำแหน่งจาก Longdo อาจไปตกหมู่อื่นได้หลายกิโลเมตร');
  if(r.longdo&&r.longdo.error==='LONGDO_FAILED')warns.push('เรียก Longdo ไม่สำเร็จ (ตรวจสอบ LONGDO_API_KEY)');
  if(!pick)warns.push('ไม่พบข้อมูลที่ใช้ระบุตำแหน่งได้ ลองโทรหาลูกค้าหรือสอบถามการไฟฟ้า');
  return {pick,warns};
}
const api={recommend,km,dist};
if(typeof module==='object'&&module.exports){module.exports=api;return}
root.MeterNew=api;

/* ---------- UI ---------- */
const doc=root.document;
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/meter-locate-api';
let lastItems=[],busy=false;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const $=id=>doc.getElementById(id);
const gmap=(lat,lng)=>`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
async function token(){
  try{if(typeof root.getBestDataToken==='function'){const t=await root.getBestDataToken();if(t)return t}}catch(_){}
  try{return localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token')||''}catch(_){return''}
}
function css(){
  if($('mnCss'))return;
  const st=doc.createElement('style');st.id='mnCss';
  st.textContent=`#meterNewWorkspace .mn-row{grid-template-columns:minmax(220px,1fr) 170px 120px}
#meterNewWorkspace .mn-clear{height:48px;margin:0;border-radius:12px;border:1px solid #ddd2ee;background:#fff;color:#4b2a86;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
#meterNewWorkspace .mn-clear:hover{background:#faf6ff;border-color:#7b45ca}
.mn-status{margin:14px 0 0;padding:12px 14px;border-radius:12px;background:#f4ecff;color:#4b2a86;font-weight:600}.mn-status.err{background:#fdecea;color:#b42318}
.mn-card{margin-top:14px;border:1px solid #e3dbf1;border-radius:16px;background:#fff;overflow:hidden}
.mn-head{padding:14px 16px;border-bottom:1px solid #eee7f8;display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.mn-head h3{margin:0;font-size:18px;color:#2a1f35}.mn-head .sub{font-size:13px;color:#666;margin-top:4px}
.mn-pick{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:0}
.mn-pick-info{padding:14px 16px}.mn-pick-info .big{font-size:20px;font-weight:800;color:#4b2a86;margin:4px 0}
.mn-tag{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#e6f4ea;color:#1e7e34}
.mn-tag.est{background:#fff4e5;color:#8a5a00}.mn-tag.geo{background:#e8f0fe;color:#1a56b0}
.mn-map{min-height:260px;background:#f3f0f8}.mn-map iframe{width:100%;height:100%;min-height:260px;border:0;display:block}
.mn-warn{margin:10px 0 0;padding:0;list-style:none}.mn-warn li{margin-top:6px;padding:8px 10px;border-radius:10px;background:#fff8e6;color:#7a4b00;font-size:13px;line-height:1.45}
.mn-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.mn-btn{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:10px;border:1px solid #e0d8e8;background:#fff;color:#2a1f35;font-weight:700;text-decoration:none;cursor:pointer;font-size:14px}
.mn-btn.line{background:#06c755;border-color:#06c755;color:#fff}
.mn-src{padding:12px 16px;border-top:1px solid #eee7f8}.mn-src h4{margin:0 0 6px;font-size:15px;color:#2a1f35}
.mn-src .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:#444;padding:4px 0}
.mn-src .mn-dist{display:inline-block;min-width:74px;padding:1px 8px;border-radius:999px;background:#eef6ff;color:#1a56b0;font-weight:700;text-align:center}
.mn-src .row a{color:#5b2a86;font-weight:700}.mn-src .muted{color:#888}
@media(max-width:720px){.mn-pick{grid-template-columns:1fr}#meterNewWorkspace .mn-row{grid-template-columns:1fr 1fr}#meterNewWorkspace .mn-row input{grid-column:1/-1}}`;
  doc.head.appendChild(st);
}
function status(msg,err){const r=$('mnResult');if(!r)return;let s=$('mnStatus');if(!s){s=doc.createElement('div');s.id='mnStatus';r.prepend(s)}s.className='mn-status'+(err?' err':'');s.textContent=msg;s.style.display=msg?'block':'none'}
function shareText(lines){
  const text=lines.filter(Boolean).join('\n');
  if(typeof root.shareTextLocation==='function')return root.shareTextLocation(text);
  try{navigator.clipboard.writeText(text);alert('คัดลอกแล้ว')}catch(_){}
}

async function search(input){
  if(busy)return;
  const ca=String(input.ca||'').replace(/\D/g,'');
  const out=$('mnResult');out.innerHTML='';
  if(!/^\d{9,12}$/.test(ca)){status('กรุณากรอกหมายเลข CA ให้ครบ',true);return}
  $('mnCaInput').value=ca;busy=true;
  status('กำลังค้นหาพิกัดมิเตอร์ บ้านข้างเคียง และที่อยู่ของ CA '+ca+' ...');
  try{
    const t=await token();if(!t)throw Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({ca,mru:input.mru||'',address:input.address||''})});
    const d=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(d.error||('HTTP '+res.status));
    render(d.result,input);
  }catch(e){status('ค้นหาไม่สำเร็จ: '+(e?.message||e),true)}
  finally{busy=false}
}

function render(r,input){
  const {pick,warns}=recommend(r);
  const out=$('mnResult');
  const tagCls={customer:'',neighbours:'est',longdo:'geo'};
  const tagTxt={customer:'พิกัดมิเตอร์',neighbours:'ประมาณจากบ้านข้างเคียง',longdo:'ประมาณจากที่อยู่'};
  const name=input.name?` · ${esc(input.name)}`:'';
  const nb=r.neighbours,geo=r.longdo&&r.longdo.lat!=null?r.longdo:null,cust=r.customer;
  /* ระยะห่างของบ้านข้างเคียงแต่ละหลังจากตำแหน่งที่แนะนำของรายนี้ */
  const ref=pick?{lat:pick.lat,lng:pick.lng}:null;
  const nbRow=x=>`<div class="row"><b>${esc(x.mru)}</b>${ref?`<span class="mn-dist">ห่าง ${km(dist(ref,x))}</span>`:''}<span>CA ${esc(x.ca)}</span><span class="muted">${esc(x.address||'-')}</span><a href="${gmap(x.lat,x.lng)}" target="_blank" rel="noopener">แผนที่</a></div>`;
  const shareLines=pick?[`CA ${r.ca}${r.mru?' · MRU '+r.mru:''}`,input.name||'',r.address||'',`${pick.label}: ${pick.lat.toFixed(6)}, ${pick.lng.toFixed(6)}`,`https://www.google.com/maps?q=${pick.lat},${pick.lng}`]:[];
  out.innerHTML=`<div id="mnStatus" class="mn-status" style="display:none"></div>
  <div class="mn-card">
    <div class="mn-head"><div><h3>CA ${esc(r.ca)}${name}</h3><div class="sub">${r.mru?'MRU '+esc(r.mru)+' · ':''}${esc(r.address||'ไม่มีที่อยู่')}</div></div>${pick?`<span class="mn-tag ${tagCls[pick.kind]}">${tagTxt[pick.kind]}</span>`:''}</div>
    <div class="mn-pick">
      <div class="mn-pick-info">${pick?`<div class="sub">ตำแหน่งที่แนะนำ: ${esc(pick.label)}</div><div class="big">${pick.lat.toFixed(6)}, ${pick.lng.toFixed(6)}</div>
        <div class="mn-actions"><a class="mn-btn" href="${gmap(pick.lat,pick.lng)}" target="_blank" rel="noopener">📍 นำทาง Google Maps</a><button type="button" class="mn-btn line" id="mnShare">แชร์ LINE</button></div>`:'<div class="big">ไม่พบตำแหน่ง</div>'}
        ${warns.length?`<ul class="mn-warn">${warns.map(w=>`<li>⚠ ${esc(w)}</li>`).join('')}</ul>`:''}</div>
      <div class="mn-map">${pick?`<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="แผนที่ตำแหน่งที่แนะนำ" src="https://maps.google.com/maps?q=${pick.lat},${pick.lng}&z=17&output=embed"></iframe>`:''}</div>
    </div>
    <div class="mn-src"><h4>1. พิกัดมิเตอร์ในฐานข้อมูลลูกค้า</h4>${cust&&cust.lat!=null?`<div class="row"><b>${cust.lat.toFixed(6)}, ${cust.lng.toFixed(6)}</b>${r.checks.customer_vs_neighbours_m!=null?`<span class="muted">ห่างจากบ้านข้างเคียง ${km(r.checks.customer_vs_neighbours_m)}</span>`:''}<a href="${gmap(cust.lat,cust.lng)}" target="_blank" rel="noopener">แผนที่</a></div>`:`<div class="row muted">${cust?'มี CA แต่ไม่มีพิกัด':'ไม่พบ CA นี้ในฐานข้อมูล'}</div>`}</div>
    <div class="mn-src"><h4>2. บ้านข้างเคียงในสายจด${r.mru?' ('+esc(r.mru.split('-')[0])+')':''}</h4>${nb&&(nb.before.length||nb.after.length)?`${nb.before.slice().reverse().map(nbRow).join('')}<div class="row"><b>▶ ${esc(r.mru)}</b><span>รายนี้</span>${ref?`<span class="muted">ระยะห่างวัดจาก${pick.kind==='customer'?'พิกัดมิเตอร์':'ตำแหน่งที่แนะนำ'} ${ref.lat.toFixed(6)}, ${ref.lng.toFixed(6)}</span>`:''}</div>${nb.after.map(nbRow).join('')}`:`<div class="row muted">${r.mru?'ไม่มีบ้านในสายเดียวกันที่มีพิกัด':'ไม่ทราบเลข MRU (วางรูปหน้าจอเพื่อให้ระบบอ่าน MRU)'}</div>`}</div>
    <div class="mn-src"><h4>3. ตำแหน่งจากที่อยู่ (Longdo)</h4>${geo?`<div class="row"><b>${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}</b><span class="muted">${geo.has_moo?'มีเลขหมู่':'ไม่มีเลขหมู่'}${r.checks.longdo_vs_neighbours_m!=null?' · ห่างจากบ้านข้างเคียง '+km(r.checks.longdo_vs_neighbours_m):''}${r.checks.longdo_vs_customer_m!=null?' · ห่างจากพิกัดมิเตอร์ '+km(r.checks.longdo_vs_customer_m):''}</span><a href="${gmap(geo.lat,geo.lng)}" target="_blank" rel="noopener">แผนที่</a></div>`:`<div class="row muted">${r.longdo&&r.longdo.error?'Longdo ไม่พบตำแหน่งจากที่อยู่นี้':'ไม่มีที่อยู่ให้ค้น'}</div>`}</div>
  </div>`;
  const sb=$('mnShare');if(sb)sb.onclick=()=>shareText(shareLines);
}

function clearAll(){
  $('mnCaInput').value='';$('mnResult').innerHTML='';
  const l=$('mnList');if(l)l.innerHTML='';const th=$('mnThumb');if(th)th.innerHTML='';
  const s=$('mnOcrStatus');if(s){s.textContent='';s.style.display='none'}
  lastItems=[];$('mnCaInput').focus();
}
function ocrStatus(msg,err){const s=$('mnOcrStatus');if(!s)return;s.textContent=msg||'';s.className='lsca-status'+(err?' err':'');s.style.display=msg?'block':'none'}
async function readImage(file){
  const L=root.LocationScreenshotCa;if(!L||!L.ocrItems){ocrStatus('ตัวอ่านรูปยังไม่พร้อม ลองรีเฟรชหน้า',true);return}
  const url=URL.createObjectURL(file);const list=$('mnList');list.innerHTML='';
  $('mnThumb').innerHTML=`<img class="lsca-thumb" src="${url}" alt="รูปที่วาง">`;
  ocrStatus('กำลังอ่านตัวเลขในรูป... (ครั้งแรกอาจใช้เวลา 10–20 วินาที)');
  try{
    const items=await L.ocrItems(url);lastItems=items;
    if(!items.length){ocrStatus('ไม่พบหมายเลข CA ในรูปนี้ ลองใช้รูปที่ชัดขึ้น หรือพิมพ์ CA เอง',true);return}
    list.innerHTML=items.map((it,i)=>`<div role="button" tabindex="0" class="lsca-item${it.checked?' active':''}" data-i="${i}">
      <div class="ca">(${esc(it.no)}) CA ${esc(it.ca)}${it.checked?'<span class="lsca-tag">✓ พนักงานติ๊กไว้</span>':''}</div>
      ${it.mru?`<div class="sub">MRU ${esc(it.mru)}${it.pea_no?' · PEA No. '+esc(it.pea_no):''}</div>`:''}
      ${it.name?`<div class="sub"><b>${esc(it.name)}</b></div>`:''}${it.address?`<div class="sub">${esc(it.address)}</div>`:''}</div>`).join('');
    list.querySelectorAll('.lsca-item').forEach(b=>{
      const go=()=>{list.querySelectorAll('.lsca-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');search(items[Number(b.dataset.i)])};
      b.addEventListener('click',go);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
    });
    const checked=items.filter(x=>x.checked);const auto=checked.length===1?checked[0]:(items.length===1?items[0]:null);
    if(auto){ocrStatus(`พบ ${items.length} รายการในรูป · ค้นหา CA ${auto.ca} ให้แล้ว (กดรายการอื่นเพื่อค้นหาแทน)`);search(auto)}
    else ocrStatus(`พบ ${items.length} รายการในรูป · กดรายการที่ต้องการเพื่อค้นหา`);
  }catch(e){ocrStatus('อ่านรูปไม่สำเร็จ: '+(e?.message||e),true)}
  finally{URL.revokeObjectURL(url)}
}

function mount(){
  const panel=$('mnPanel');if(!panel||$('mnDrop'))return;
  css();
  const row=panel.querySelector('.mn-row');
  row.insertAdjacentHTML('beforeend','<div role="button" tabindex="0" class="mn-clear" id="mnClear">ล้างการค้นหา</div>');
  panel.insertAdjacentHTML('beforeend',`<div class="lsca-drop" id="mnDrop" tabindex="0"><div id="mnThumb"></div>
    <div><b>📷 ค้นหาจากรูปที่พนักงานส่งมา</b><br><span>คัดลอกรูปจาก LINE แล้วกด Ctrl+V ที่หน้านี้ ลากรูปมาวาง หรือกดเลือกรูป · ระบบอ่าน CA, MRU และที่อยู่ให้เอง</span></div>
    <button type="button" class="lsca-pick">เลือกรูป</button><input type="file" id="mnFile" accept="image/*" hidden></div>
    <div class="lsca-status" id="mnOcrStatus" style="display:none"></div><div class="lsca-list" id="mnList"></div>`);
  const input=$('mnCaInput'),file=$('mnFile'),drop=$('mnDrop'),clear=$('mnClear');
  const manual=()=>{const ca=input.value.replace(/\D/g,'');const it=lastItems.find(x=>x.ca===ca);search(it||{ca})};
  $('mnSearchBtn').addEventListener('click',manual);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')manual()});
  clear.addEventListener('click',clearAll);clear.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();clearAll()}});
  drop.addEventListener('click',e=>{if(e.target!==file)file.click()});
  file.addEventListener('change',()=>{if(file.files[0])readImage(file.files[0]);file.value=''});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');const f=[...(e.dataTransfer?.files||[])].find(x=>/^image\//.test(x.type));if(f)readImage(f)});
  doc.addEventListener('paste',e=>{
    const ws=$('meterNewWorkspace');if(!ws||ws.style.display==='none'||!ws.offsetParent)return;
    for(const it of e.clipboardData?.items||[]){if(it.kind==='file'&&/^image\//.test(it.type)){e.preventDefault();readImage(it.getAsFile());return}}
  });
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window!=='undefined'?window:globalThis);
