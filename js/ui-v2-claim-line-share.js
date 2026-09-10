(function(){
'use strict';
const PDF_LIB='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
const LIFF_ID='2011407195-ZXPgFEKe';
const LIFF_SDK_URL='https://static.line-scdn.net/liff/edge/2/sdk.js';
// The LIFF endpoint already includes /ui-v2-preview; only append query data.
const LIFF_V2_URL='https://liff.line.me/'+LIFF_ID+'?claim_line=1';
function loginReturnUrl(){const url=new URL('/ui-v2-preview',location.origin);url.searchParams.set('claim_line','1');const month=el('claimv2Month');if(month)url.searchParams.set('claim_month',month.value);return url.href}
let liffSdkPromise=null,liffReadyPromise=null;
function el(id){return document.getElementById(id)}
function loadPdfLib(){return new Promise((resolve,reject)=>{if(window.html2pdf)return resolve(window.html2pdf);const existing=document.querySelector('script[data-claim-pdf-lib]');if(existing){existing.addEventListener('load',()=>resolve(window.html2pdf),{once:true});existing.addEventListener('error',()=>reject(new Error('โหลดระบบสร้าง PDF ไม่สำเร็จ')),{once:true});return}const s=document.createElement('script');s.src=PDF_LIB;s.async=true;s.dataset.claimPdfLib='1';s.onload=()=>window.html2pdf?resolve(window.html2pdf):reject(new Error('ไม่พบระบบสร้าง PDF'));s.onerror=()=>reject(new Error('โหลดระบบสร้าง PDF ไม่สำเร็จ'));document.head.appendChild(s)})}
function loadLiffSdk(){if(window.liff)return Promise.resolve(window.liff);if(liffSdkPromise)return liffSdkPromise;liffSdkPromise=new Promise((resolve,reject)=>{const old=document.querySelector('script[data-claim-liff-sdk]');if(old){old.addEventListener('load',()=>window.liff?resolve(window.liff):reject(new Error('ไม่พบ LINE LIFF')),{once:true});old.addEventListener('error',()=>reject(new Error('โหลด LINE LIFF ไม่สำเร็จ')),{once:true});return}const s=document.createElement('script');s.src=LIFF_SDK_URL;s.async=true;s.dataset.claimLiffSdk='1';s.onload=()=>window.liff?resolve(window.liff):reject(new Error('ไม่พบ LINE LIFF'));s.onerror=()=>reject(new Error('โหลด LINE LIFF ไม่สำเร็จ'));document.head.appendChild(s)}).catch(e=>{liffSdkPromise=null;throw e});return liffSdkPromise}
async function ensureLiffReady(){await loadLiffSdk();if(!liffReadyPromise)liffReadyPromise=window.liff.init({liffId:LIFF_ID}).catch(e=>{liffReadyPromise=null;throw e});await liffReadyPromise;return window.liff}
function selectedLabel(){const s=el('claimv2Month');if(!s)return'รายงาน';const o=s.options[s.selectedIndex];return o?o.textContent.trim():'รายงาน'}
function makeReport(){const root=document.querySelector('.workspace[data-workspace="claim"] .claimv2');const tableWrap=root&&root.querySelector('.claimv2-tablewrap');if(!root||!tableWrap)throw new Error('ยังไม่พบรายงานสำหรับสร้าง PDF');const report=document.createElement('div');report.style.cssText='width:100%;background:#fff;color:#111;font-family:Tahoma,"Noto Sans Thai",Arial,sans-serif;font-size:14px;padding:12mm;box-sizing:border-box;';const title=document.createElement('h1');title.textContent='รายงานตั้งเบิกค่าตอบแทน';title.style.cssText='font-size:22px;margin:0 0 4px;text-align:left;';const sub=document.createElement('div');sub.textContent='ช่วงข้อมูล: '+selectedLabel();sub.style.cssText='font-size:14px;margin:0 0 12px;text-align:left;';const total=document.createElement('div');total.textContent='ยอดค้างรวม: '+((el('claimv2Outstanding')&&el('claimv2Outstanding').textContent)||'0.00')+' บาท';total.style.cssText='font-size:16px;font-weight:700;margin:0 0 12px;text-align:left;';const table=tableWrap.querySelector('table').cloneNode(true);table.style.cssText='width:100%;border-collapse:collapse;table-layout:auto;min-width:0;';table.querySelectorAll('th,td').forEach(cell=>{cell.style.textAlign='left';cell.style.border='1px solid #9aa4b2';cell.style.padding='6px 7px';cell.style.fontSize='12px';cell.style.lineHeight='1.35';cell.style.background=cell.tagName==='TH'?'#eef2f7':'#fff';cell.style.color='#111';cell.style.verticalAlign='top'});table.querySelectorAll('.claimv2-site-total td').forEach(cell=>{cell.style.fontWeight='700';cell.style.background='#f4f7fb'});table.querySelectorAll('.claimv2-all-grand td').forEach(cell=>{cell.style.fontWeight='700';cell.style.background='#f7f7f7';cell.style.borderTop='2px solid #333'});report.append(title,sub,total,table);return report}
function fallbackSave(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
const PDF_API='https://neauzvqroaszvqffahkv.functions.supabase.co/report-pdf-share';
const PENDING_KEY='claimv2_pending_pdf';
function pendingStore(action,value){return new Promise((resolve,reject)=>{
 const open=indexedDB.open('divergent-claim-pdf',1);
 open.onupgradeneeded=()=>open.result.createObjectStore('pending');
 open.onerror=()=>reject(new Error('บันทึก PDF ระหว่างเข้า LINE ไม่สำเร็จ'));
 open.onsuccess=()=>{const db=open.result,tx=db.transaction('pending',action==='get'?'readonly':'readwrite'),store=tx.objectStore('pending');
 const request=action==='get'?store.get(PENDING_KEY):action==='put'?store.put(value,PENDING_KEY):store.delete(PENDING_KEY);
 tx.oncomplete=()=>{db.close();resolve(request.result)};tx.onerror=()=>{db.close();reject(tx.error)};
 };
})}
function pdfBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('อ่าน PDF ไม่สำเร็จ'));reader.readAsDataURL(blob)})}
async function preparePdfLine(out,status){
 const sdk=await ensureLiffReady();
 if(!sdk.isLoggedIn()){
  await pendingStore('put',out);
  sessionStorage.setItem(PENDING_KEY,'1');
  status.textContent='กำลังเข้าสู่ระบบ LINE...';
  if(sdk.isInClient())location.assign(LIFF_V2_URL);else sdk.login({redirectUri:loginReturnUrl()});
  return null;
 }
 if(!sdk.isApiAvailable('shareTargetPicker'))throw new Error('LINE นี้ยังเปิดรายชื่อผู้รับไม่ได้ กรุณาตรวจว่าเปิด Share Target Picker ใน LINE Developers แล้ว');
 if(!out.url){
  status.textContent='กำลังอัปโหลด PDF...';
  const token=sdk.getAccessToken();if(!token)throw new Error('กรุณาเชื่อม LINE ใหม่');
  const response=await fetch(PDF_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({report_type:'claim',file_name:out.name,pdf_base64:await pdfBase64(out.blob)})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok){const errors={LINE_NOT_LINKED:'บัญชี LINE นี้ยังไม่ได้ผูกกับผู้ใช้ Divergent',ACCESS_DENIED:'บัญชีนี้ไม่มีสิทธิ์แชร์รายงาน',LINE_AUTH_FAILED:'LINE หมดอายุ กรุณาเชื่อมต่อใหม่'};throw new Error(errors[data.error]||data.detail||data.error||('อัปโหลด PDF ไม่สำเร็จ HTTP '+response.status))}
  const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='neauzvqroaszvqffahkv.supabase.co'||!url.pathname.startsWith('/storage/v1/object/sign/report-pdfs/'))throw new Error('ลิงก์ PDF ไม่ถูกต้อง');
  out.url=url.href;
 }
 return sdk;
}
function showPdfActions(out){
 const previous=el('claimv2PdfDialog');if(previous)previous.remove();
 const dialog=document.createElement('dialog');dialog.id='claimv2PdfDialog';
 dialog.style.cssText='max-width:460px;width:calc(100% - 48px);border:0;border-radius:12px;padding:24px;font-family:Tahoma,Arial,sans-serif;';
 const title=document.createElement('h2');title.textContent='PDF พร้อมแล้ว';
 const name=document.createElement('p');name.textContent=out.name;name.style.overflowWrap='anywhere';
 const status=document.createElement('p');status.setAttribute('role','status');
 const share=document.createElement('button');share.type='button';share.textContent='กำลังเชื่อม LINE...';share.disabled=true;
 const download=document.createElement('button');download.type='button';download.textContent='ดาวน์โหลด PDF';
 const close=document.createElement('button');close.type='button';close.textContent='ปิด';
 [share,download,close].forEach(b=>{b.className='claimv2-btn';b.style.margin='4px'});
 let sdk=null;
 async function prepare(){share.disabled=true;try{sdk=await preparePdfLine(out,status);if(sdk){share.textContent='เลือกเพื่อนหรือกลุ่มใน LINE';status.textContent='ส่งเป็นข้อความพร้อมลิงก์เปิด / ดาวน์โหลด PDF อายุ 7 วัน'}}catch(e){status.textContent=e.message;share.textContent='ลองเชื่อม LINE อีกครั้ง'}finally{share.disabled=false}}
 share.addEventListener('click',async()=>{
  if(!sdk){await prepare();return}
  share.disabled=true;
  try{
   // Invoke directly from a fresh click: external browsers need user activation.
   const result=await sdk.shareTargetPicker([{type:'text',text:['รายงานตั้งเบิกค่าตอบแทน','ช่วงข้อมูล: '+out.label,'เปิด / ดาวน์โหลด PDF: '+out.url,'ลิงก์ไฟล์มีอายุ 7 วัน'].join('\n')}],{isMultiple:true});
   status.textContent=result?'ส่ง PDF ไป LINE สำเร็จ':'ยกเลิกการแชร์แล้ว กดเลือกผู้รับใหม่ได้';
   if(result){sessionStorage.removeItem(PENDING_KEY);await pendingStore('delete')}
  }catch(e){status.textContent='เปิดรายชื่อ LINE ไม่สำเร็จ: '+(e.message||e)}finally{share.disabled=false}
 });
 download.addEventListener('click',()=>fallbackSave(out.blob,out.name));
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.append(title,name,status,share,download,close);document.body.appendChild(dialog);dialog.showModal();
 void prepare();
}
async function sharePdf(){
 const btn=el('claimv2LinePdf');if(!btn)return;
 const old=btn.textContent;btn.disabled=true;let report=null;
 try{
  const month=el('claimv2Month');
  if(!month||!month.options.length)throw new Error('กรุณารอให้ข้อมูลรายงานโหลดเสร็จก่อน');
  btn.textContent='กำลังสร้าง PDF...';
  await loadPdfLib();
  report=makeReport();
  const label=selectedLabel().replace(/[\\\\/:*?"<>|]/g,'-');
  const name='รายงานยอดค้าง-'+label+'.pdf';
  const opt={margin:0,filename:name,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'},pagebreak:{mode:['css','legacy']}};
  const blob=await window.html2pdf().set(opt).from(report).outputPdf('blob');
  if(!blob||!blob.size)throw new Error('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่');
  if(blob.size>8*1024*1024)throw new Error('PDF ใหญ่เกิน 8 MB กรุณาเลือกช่วงข้อมูลให้น้อยลง');
  showPdfActions({blob,name,label:selectedLabel(),createdAt:Date.now()});
 }catch(e){console.error(e);alert('สร้าง PDF ไม่สำเร็จ: '+((e&&e.message)||e))}
 finally{if(report&&report.parentNode)report.parentNode.removeChild(report);btn.disabled=false;btn.textContent=old}
}
function install(){const bar=document.querySelector('.workspace[data-workspace="claim"] .claimv2-commandbar');if(!bar||el('claimv2LinePdf'))return false;const b=document.createElement('button');b.id='claimv2LinePdf';b.type='button';b.className='claimv2-btn';b.textContent='สร้าง PDF และแชร์ไป LINE';b.style.cssText='background:#06c755;color:#fff;border-color:#06c755;';b.addEventListener('click',sharePdf);bar.appendChild(b);return true}
function prepareLineReturn(){
 const params=new URLSearchParams(location.search);
 if(!params.has('claim_line')&&!params.has('liff.state')&&!params.has('code'))return;
 // Initialize on both primary and secondary LIFF redirects, before changing the URL.
 ensureLiffReady().then(async()=>{
  if(new URLSearchParams(location.search).get('claim_line')!=='1')return;
  if(sessionStorage.getItem(PENDING_KEY)){
   const pending=await pendingStore('get');
   if(pending&&Date.now()-pending.createdAt<60*60*1000)showPdfActions(pending);
   else{sessionStorage.removeItem(PENDING_KEY);await pendingStore('delete')}
  }
  const restore=()=>{
   const month=el('claimv2Month'),wanted=params.get('claim_month');
   const nav=document.querySelector('[data-page="claim"]');
   if(!month||!month.options.length||!el('claimv2LinePdf')||!nav||nav.hidden)return false;
   if(wanted&&Array.from(month.options).some(o=>o.value===wanted)){month.value=wanted;month.dispatchEvent(new Event('change',{bubbles:true}))}
   nav.click();
   el('claimv2LinePdf').textContent='สร้าง PDF และแชร์ไป LINE';
   return true;
  };
  if(!restore()){const observer=new MutationObserver(()=>{if(restore())observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});setTimeout(()=>observer.disconnect(),15000)}
  // Opening the picker stays on a user click so external browsers can open its popup.
 }).catch(e=>{console.error('LINE initialization failed',e)});
}
function boot(){prepareLineReturn();if(install())return;const ob=new MutationObserver(()=>{if(install())ob.disconnect()});ob.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>ob.disconnect(),15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

