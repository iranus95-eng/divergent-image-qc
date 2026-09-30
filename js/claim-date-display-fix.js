(function(){
'use strict';
function pad(n){return String(n).padStart(2,'0');}
function normalizeYear(y){
  y=Number(y);
  if(!Number.isFinite(y))return null;
  if(y>=2400&&y<=2700)return y;
  if(y>=2000&&y<=2200)return y+543;
  if(y>=1900&&y<=1999)return 2500+(y%100);
  if(y>=500&&y<=999)return 2000+y;
  if(y>=0&&y<=99)return 2500+y;
  return y;
}
function fromExcelSerial(n){
  if(!Number.isFinite(n)||n<=0)return null;
  const ms=Date.UTC(1899,11,30)+Math.round(n)*86400000;
  const d=new Date(ms);if(!Number.isFinite(d.getTime()))return null;
  let y=d.getUTCFullYear();
  if(y>=1900&&y<=1999)y=2500+(y%100);else if(y>=2000&&y<=2200)y+=543;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${y}`;
}
function thaiDate(v){
  if(v===null||v===undefined||v==='')return '-';
  if(typeof v==='number'||/^\d{5,6}(?:\.\d+)?$/.test(String(v).trim())){
    const n=Number(v),x=fromExcelSerial(n);if(x)return x;
  }
  const s=String(v).trim();
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if(m){const y=normalizeYear(m[1]);return y?`${pad(m[3])}/${pad(m[2])}/${y}`:s;}
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
  if(m){const y=normalizeYear(m[3]);return y?`${pad(m[1])}/${pad(m[2])}/${y}`:s;}
  return s;
}
window.formatClaimThaiDate=thaiDate;
let legacyPatched=false;
function patchLegacy(){
  if(typeof window.claimDisplayDate==='function'&&window.claimDisplayDate!==thaiDate){
    window.claimDisplayDate=thaiDate;
    if(!legacyPatched){legacyPatched=true;setTimeout(()=>{try{if(typeof window.renderClaimWorkspace==='function')window.renderClaimWorkspace();}catch(_){}},0);}
  }
  const input=document.getElementById('clReceivedDate');
  if(input&&input.value){const x=thaiDate(input.value);if(x&&x!=='-'&&x!==input.value)input.value=x;}
}
function replaceDatesIn(el){
  if(!el)return;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  const nodes=[];let n;while((n=walker.nextNode()))nodes.push(n);
  for(const node of nodes){
    const p=node.parentElement;if(!p||/^(INPUT|TEXTAREA|PRE|CODE|BUTTON)$/.test(p.tagName))continue;
    const before=node.nodeValue||'';
    const after=before.replace(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,x=>thaiDate(x));
    if(after!==before)node.nodeValue=after;
  }
}
let shadowObserved=false;
function patchShadow(){
  const root=document.getElementById('claimWorkspace')?.shadowRoot;if(!root)return false;
  const apply=()=>{root.querySelectorAll('.payments li').forEach(replaceDatesIn);root.querySelectorAll('#modalBody p').forEach(p=>{if((p.textContent||'').includes('วันที่'))replaceDatesIn(p);});};
  apply();
  if(!shadowObserved){shadowObserved=true;new MutationObserver(apply).observe(root,{childList:true,subtree:true});}
  return true;
}
function boot(){
  patchLegacy();patchShadow();
  new MutationObserver(()=>{patchLegacy();patchShadow();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  let tries=0;const t=setInterval(()=>{patchLegacy();patchShadow();if(++tries>80)clearInterval(t);},250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
