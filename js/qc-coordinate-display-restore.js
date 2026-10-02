(function(){
'use strict';

let originalLoadDistance=null;

function validCoord(lat,lng){
  lat=Number(lat);lng=Number(lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&!(lat===0&&lng===0)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
}
function coordText(lat,lng){return Number(lat).toFixed(6)+', '+Number(lng).toFixed(6)}
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

async function fixedLoadDistanceCard(img){
  const box=document.getElementById('distance-'+img.slotId);
  if(!box)return;
  const d=window._qcBatchCoordinateMap?.get(String(img.ca||''))||null;
  // Keep the legacy single-CA fallback whenever the batch response is missing
  // OR the batch row exists but has no notice/work coordinate yet.
  // The legacy loader merges fetchDualCoordinate() and can recover a valid
  // notice coordinate before calculating the meter distance.
  if(!d || !d?.notice){
    if(originalLoadDistance)return originalLoadDistance(img);
    return;
  }

  try{
    const n=d.notice||null,m=d.meter||null;
    const nlat=Number(n?.actual_latitude),nlng=Number(n?.actual_longitude);
    let mlat=Number(m?.latitude),mlng=Number(m?.longitude);
    const nok=validCoord(nlat,nlng);
    let mok=validCoord(mlat,mlng);
    const meterUsesWorkFallback=!mok&&nok;
    if(meterUsesWorkFallback){mlat=nlat;mlng=nlng;mok=true}

    let html='<div class="batch-distance-title">📍 พิกัดใบแจ้งเตือน ↔ มิเตอร์จดหน่วย</div>'+ 
      '<div class="batch-distance-coord"><span class="coord-label">🏠 พิกัดใบแจ้งเตือน / งานจริง</span><span class="coord-value">'+(nok?coordText(nlat,nlng):'ยังไม่มีข้อมูลพิกัดงานในระบบ')+'</span></div>'+ 
      '<div class="batch-distance-coord"><span class="coord-label">📟 พิกัดมิเตอร์จดหน่วย'+(meterUsesWorkFallback?' (ยังไม่มีพิกัดมิเตอร์จริง)':'')+'</span><span class="coord-value">'+(mok?coordText(mlat,mlng):'ยังไม่มีข้อมูลพิกัดมิเตอร์ในฐานลูกค้า')+'</span></div>';

    if(nok&&mok&&!meterUsesWorkFallback){
      let dist=Number(d?.route?.distance_m);
      let mode='ระยะทางขับรถ';
      if(!Number.isFinite(dist))dist=await drivingDistance({lat:nlat,lng:nlng},{lat:mlat,lng:mlng});
      if(!Number.isFinite(dist)){dist=haversine({lat:nlat,lng:nlng},{lat:mlat,lng:mlng});mode='ระยะเส้นตรง'}
      html+='<div class="batch-distance-value">'+formatDistance(dist)+'</div><div class="batch-distance-note">'+mode+' · ใบแจ้งเตือน ↔ มิเตอร์จดหน่วย</div>';
    }else if(meterUsesWorkFallback){
      html+='<div class="batch-distance-note">⚠️ พิกัดใบแจ้งเตือนมีแล้ว แต่ยังไม่มีพิกัดมิเตอร์จริง จึงยังไม่คำนวณระยะ</div>';
    }else if(!nok&&mok){
      html+='<div class="batch-distance-note">⚠️ พบพิกัดมิเตอร์แล้ว แต่ยังไม่มีพิกัดใบแจ้งเตือน/งานจริง จึงยังไม่คำนวณระยะ</div>';
    }else{
      html+='<div class="batch-distance-note">⚠️ ยังไม่มีพิกัดครบ 2 จุด จึงยังไม่คำนวณระยะ</div>';
    }
    box.innerHTML=html;
  }catch(e){
    console.warn('QC coordinate display restore',e);
    if(originalLoadDistance)return originalLoadDistance(img);
  }
}

function patch(){
  const current=window.loadDistanceCardV167;
  if(typeof current!=='function')return false;
  if(current.__qcCoordinateRestore)return true;
  originalLoadDistance=current;
  fixedLoadDistanceCard.__qcCoordinateRestore=true;
  window.loadDistanceCardV167=fixedLoadDistanceCard;
  return true;
}

function boot(){
  if(patch())return;
  let tries=0;
  const timer=setInterval(()=>{tries++;if(patch()||tries>80)clearInterval(timer)},100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();