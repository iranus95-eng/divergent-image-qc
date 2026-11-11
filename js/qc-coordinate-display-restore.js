(function(){
'use strict';

const SEARCH_API='https://neauzvqroaszvqffahkv.functions.supabase.co/image-location-search';
const cache=new Map();
const pending=new Map();
let originalLoadDistance=null;
let originalLoadAllDistance=null;

function validCoord(lat,lng){
  lat=Number(lat);lng=Number(lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&!(lat===0&&lng===0)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
}
function formatDistance(m){
  m=Number(m);if(!Number.isFinite(m))return '-';
  return m<1000?Math.round(m).toLocaleString('th-TH')+' เมตร':(m/1000).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' กม.';
}
function haversine(a,b){
  const R=6371000,toRad=x=>x*Math.PI/180;
  const p1=toRad(a.lat),p2=toRad(b.lat),dp=toRad(b.lat-a.lat),dl=toRad(b.lng-a.lng);
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
async function drivingDistance(a,b){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6500);
  try{
    const url='https://router.project-osrm.org/route/v1/driving/'+a.lng+','+a.lat+';'+b.lng+','+b.lat+'?overview=false&alternatives=false&steps=false';
    const r=await fetch(url,{signal:ctl.signal});
    const d=await r.json().catch(()=>null);
    if(r.ok&&d?.routes?.[0]&&Number.isFinite(Number(d.routes[0].distance)))return Number(d.routes[0].distance);
  }catch(_){ }
  finally{clearTimeout(timer)}
  return null;
}
async function bestToken(){
  try{if(typeof window.getBestDataToken==='function'){const t=await window.getBestDataToken();if(t)return t}}catch(_){}
  try{
    const t=localStorage.getItem('divergent_web_session_token_v1')||localStorage.getItem('divergent_fallback_session_token');
    if(t)return t;
  }catch(_){}
  try{if(window.liff?.isLoggedIn?.()&&window.liff?.getAccessToken)return window.liff.getAccessToken()||''}catch(_){}
  return '';
}
async function fetchByCa(ca,force=false){
  ca=String(ca||'').replace(/\D/g,'');
  if(ca.length!==12)return null;
  const hit=cache.get(ca);
  if(!force&&hit&&Date.now()-hit.at<15000)return hit.data;
  if(!force&&pending.has(ca))return pending.get(ca);
  const p=(async()=>{
    const token=await bestToken();
    if(!token)throw new Error('AUTH_REQUIRED');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
    try{
      const r=await fetch(SEARCH_API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({ca}),signal:ctl.signal});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(String(d?.error||('HTTP '+r.status)));
      const out={notice:d?.notice||null,meter:d?.meter||null};
      cache.set(ca,{at:Date.now(),data:out});
      return out;
    }finally{clearTimeout(timer)}
  })();
  pending.set(ca,p);
  try{return await p}finally{pending.delete(ca)}
}
function mergeCoordinateData(batch,fallback){
  return {
    notice:batch?.notice||fallback?.notice||null,
    meter:batch?.meter||fallback?.meter||null,
    route:batch?.route||null
  };
}
function missingNoticeText(){return 'ยังไม่มีพิกัดใบแจ้งเตือนจากเครื่องต้นทาง'}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function areaText(n){
  if(!n)return '';
  const parts=[];
  if(n.subdistrict)parts.push('ต.'+String(n.subdistrict).replace(/^(ต\.|ตำบล)\s*/,''));
  if(n.district)parts.push('อ.'+String(n.district).replace(/^(อ\.|อำเภอ)\s*/,''));
  if(n.province)parts.push('จ.'+String(n.province).replace(/^(จ\.|จังหวัด)\s*/,''));
  return parts.join(' ');
}
// Reverse geocode (OpenStreetMap Nominatim): one request per second, cached per device.
const GEO_KEY='qc_geo_addr_v1';
let geoStore=null,geoChain=Promise.resolve(),geoLast=0;
const geoPending=new Map();
function geoCache(){
  if(geoStore)return geoStore;
  try{geoStore=JSON.parse(localStorage.getItem(GEO_KEY)||'{}')||{}}catch(_){geoStore={}}
  return geoStore;
}
function geoSave(){
  try{
    const keys=Object.keys(geoStore||{});
    if(keys.length>3000)keys.slice(0,keys.length-3000).forEach(k=>delete geoStore[k]);
    localStorage.setItem(GEO_KEY,JSON.stringify(geoStore));
  }catch(_){}
}
function cleanGeoName(d){
  const parts=String(d?.display_name||'').split(',').map(x=>x.trim()).filter(Boolean)
    .filter(x=>x!=='ประเทศไทย'&&x!=='Thailand'&&!/^\d{5}$/.test(x));
  return parts.join(' ');
}
function reverseGeocode(lat,lng){
  const key=Number(lat).toFixed(5)+','+Number(lng).toFixed(5);
  const store=geoCache();
  if(store[key])return Promise.resolve(store[key]);
  if(geoPending.has(key))return geoPending.get(key);
  const p=(geoChain=geoChain.catch(()=>{}).then(async()=>{
    const wait=1100-(Date.now()-geoLast);
    if(wait>0)await new Promise(r=>setTimeout(r,wait));
    geoLast=Date.now();
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
    try{
      const url='https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=th&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lng);
      const r=await fetch(url,{signal:ctl.signal,headers:{Accept:'application/json'}});
      const d=await r.json().catch(()=>null);
      const text=r.ok?cleanGeoName(d):'';
      if(text){geoCache()[key]=text;geoSave()}
      return text;
    }catch(_){return ''}
    finally{clearTimeout(timer)}
  }));
  geoPending.set(key,p);
  p.finally(()=>geoPending.delete(key));
  return p;
}
function addressText(n,m){
  const a=String(m?.address||'').replace(/\s+/g,' ').trim();
  return a||areaText(n);
}
function retryButton(img){
  const slot=String(img?.slotId||'').replace(/'/g,'');
  const ca=String(img?.ca||'').replace(/\D/g,'');
  return '<button type="button" class="qc-coordinate-retry" onclick="window.qcRetryCoordinate(\''+slot+'\',\''+ca+'\')">↻ ลองดึงพิกัดใหม่</button>';
}
function installStyle(){
  if(document.getElementById('qc-coordinate-restore-style'))return;
  const s=document.createElement('style');s.id='qc-coordinate-restore-style';s.textContent=`
    .qc-coordinate-retry{margin-top:9px;padding:7px 11px;border:1px solid #cbb9ef;border-radius:9px;background:#fff;color:#5121a8;font-size:12px;font-weight:700;cursor:pointer}
    .qc-coordinate-retry:hover{background:#f5f0ff}
    .batch-distance-coord.qc-address .coord-label{display:block;color:#6b5a78;font-size:10.5px;font-weight:800;margin-bottom:2px}
    .batch-distance-coord.qc-address .coord-value{display:block;color:#3f3150;font-size:11.5px;font-weight:700;line-height:1.45;overflow-wrap:anywhere}
    .qc-coordinate-source-warn{margin-top:7px;color:#9a6700;font-size:12px;line-height:1.45}
  `;document.head.appendChild(s);
}
async function renderDistanceCard(img,force=false){
  const box=document.getElementById('distance-'+img.slotId);
  if(!box)return;
  const ca=String(img.ca||'').replace(/\D/g,'');
  let batch=window._qcBatchCoordinateMap?.get(ca)||null;
  let fallback=null;
  if(force||!batch?.notice||!batch?.meter||!batch?.meter?.address){
    try{fallback=await fetchByCa(ca,force)}catch(e){console.warn('QC direct coordinate fallback',ca,e)}
  }
  const d=mergeCoordinateData(batch,fallback);
  const n=d.notice||null,m=d.meter||null;
  const nlat=Number(n?.actual_latitude),nlng=Number(n?.actual_longitude);
  const mlat=Number(m?.latitude),mlng=Number(m?.longitude);
  const nok=validCoord(nlat,nlng),mok=validCoord(mlat,mlng);

  let addr=addressText(n,m);
  const customerAddr=String(m?.address||'').trim();
  if(!customerAddr&&(nok||mok)){
    const geo=await reverseGeocode(nok?nlat:mlat,nok?nlng:mlng);
    if(geo)addr=geo;
  }
  let html='<div class="batch-distance-title">📍 ที่อยู่ / ระยะห่าง</div>'+
    '<div class="batch-distance-coord qc-address"><span class="coord-label">🏠 ที่อยู่</span><span class="coord-value">'+(addr?esc(addr):'ยังไม่มีข้อมูลที่อยู่ในระบบ')+'</span></div>';

  if(nok&&mok){
    let dist=Number(d?.route?.distance_m),mode='ระยะทางขับรถ';
    if(!Number.isFinite(dist))dist=await drivingDistance({lat:nlat,lng:nlng},{lat:mlat,lng:mlng});
    if(!Number.isFinite(dist)){dist=haversine({lat:nlat,lng:nlng},{lat:mlat,lng:mlng});mode='ระยะเส้นตรง'}
    html+='<div class="batch-distance-value">'+formatDistance(dist)+'</div><div class="batch-distance-note">'+mode+' · ใบแจ้งเตือน ↔ มิเตอร์จดหน่วย</div>';
  }else if(!nok&&mok){
    html+='<div class="batch-distance-note">⚠️ '+missingNoticeText()+' จึงยังคำนวณระยะไม่ได้</div>'+
      '<div class="qc-coordinate-source-warn">ระบบจะไม่ใช้พิกัดมิเตอร์แทนพิกัดใบแจ้งเตือน เพื่อป้องกันระยะทางผิด</div>'+retryButton(img);
  }else if(nok&&!mok){
    html+='<div class="batch-distance-note">⚠️ พบพิกัดใบแจ้งเตือนแล้ว แต่ยังไม่มีพิกัดมิเตอร์ จึงยังคำนวณระยะไม่ได้</div>'+retryButton(img);
  }else{
    html+='<div class="batch-distance-note">⚠️ ยังไม่มีพิกัดครบ 2 จุด จึงยังคำนวณระยะไม่ได้</div>'+retryButton(img);
  }
  box.innerHTML=html;
}
async function fixedLoadDistanceCard(img){
  try{return await renderDistanceCard(img,false)}catch(e){
    console.warn('QC coordinate display restore',e);
    if(originalLoadDistance)return originalLoadDistance(img);
  }
}
async function fixedLoadAllDistanceCards(images){
  // Let the original loader/batch request run first, then do a guaranteed second pass.
  try{if(originalLoadAllDistance)await originalLoadAllDistance(images)}catch(e){console.warn('QC original distance batch',e)}
  const rows=Array.isArray(images)?images:[];
  for(const img of rows){
    try{await renderDistanceCard(img,false)}catch(e){console.warn('QC coordinate second pass',e)}
  }
}
window.qcRetryCoordinate=async function(slotId,ca){
  const box=document.getElementById('distance-'+slotId);
  if(box)box.insertAdjacentHTML('beforeend','<div class="batch-distance-note">กำลังดึงพิกัดล่าสุด...</div>');
  const img={slotId,ca};
  try{await renderDistanceCard(img,true)}catch(e){
    console.warn('QC coordinate retry',e);
    if(box)box.insertAdjacentHTML('beforeend','<div class="batch-distance-note">ดึงพิกัดใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง</div>');
  }
};
function patch(){
  let ok=false;
  const current=window.loadDistanceCardV167;
  if(typeof current==='function'){
    if(!current.__qcCoordinateRestore){originalLoadDistance=current;fixedLoadDistanceCard.__qcCoordinateRestore=true;window.loadDistanceCardV167=fixedLoadDistanceCard}
    ok=true;
  }
  const currentAll=window.loadAllDistanceCardsV167;
  if(typeof currentAll==='function'){
    if(!currentAll.__qcCoordinateRestoreAll){originalLoadAllDistance=currentAll;fixedLoadAllDistanceCards.__qcCoordinateRestoreAll=true;window.loadAllDistanceCardsV167=fixedLoadAllDistanceCards}
    ok=true;
  }
  return ok;
}
function boot(){
  installStyle();patch();
  let tries=0;const timer=setInterval(()=>{tries++;patch();if(tries>100)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();