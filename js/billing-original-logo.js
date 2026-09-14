(function(){
'use strict';
const LOGO_URL=location.origin+'/images/divergent-logo-original.jpg?v=20260914-2015';
const STYLE_ID='billing-original-logo-style-v4';
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#billingPaper>.bi-logo,#billingPaper>.bi-logo-svg,#billingPaper>.bi-logo-fallback{display:none!important}
#billingPaper>.bi-logo-original{position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;max-width:none!important;max-height:none!important;object-fit:contain!important;display:block!important;z-index:50!important}
`;
  document.head.appendChild(s);
}
function apply(scope=document){
  installStyle();
  const paper=scope.querySelector?.('#billingPaper');
  if(!paper)return;
  paper.querySelectorAll(':scope > .bi-logo,:scope > .bi-logo-svg,:scope > .bi-logo-fallback').forEach(el=>el.remove());
  let img=paper.querySelector(':scope > .bi-logo-original');
  if(!img){
    img=document.createElement('img');
    img.className='bi-logo-original';
    img.alt='';
    paper.prepend(img);
  }
  if(img.getAttribute('src')!==LOGO_URL)img.setAttribute('src',LOGO_URL);
  img.style.cssText='position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;max-width:none!important;max-height:none!important;object-fit:contain!important;display:block!important;z-index:50!important;';
}
let queued=false;
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply(document)})}
installStyle();apply(document);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',()=>apply(document));
})();