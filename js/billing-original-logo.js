(function(){
'use strict';
const LOGO_URL=new URL('images/divergent-logo-original-v2.jpg?v=20260914-actual',document.baseURI).href;
const STYLE_ID='billing-original-logo-style-v2';
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#billingPaper>.bi-logo-svg,#billingPaper>.bi-logo:not(.bi-logo-original){display:none!important}
#billingPaper>.bi-logo-original{position:absolute!important;left:24px!important;top:24px!important;width:183px!important;height:61px!important;max-width:none!important;max-height:none!important;object-fit:contain!important;display:block!important;z-index:20!important}
`;
  document.head.appendChild(s);
}
function apply(scope=document){
  installStyle();
  const paper=scope.querySelector?.('#billingPaper');
  if(!paper)return;
  paper.querySelectorAll(':scope > .bi-logo-svg,:scope > .bi-logo:not(.bi-logo-original)').forEach(el=>{
    el.style.setProperty('display','none','important');
  });
  let img=paper.querySelector(':scope > .bi-logo-original');
  if(!img){
    img=document.createElement('img');
    img.className='bi-logo-original';
    img.alt='Divergent Corporation Co., Ltd.';
    paper.prepend(img);
  }
  if(img.src!==LOGO_URL)img.src=LOGO_URL;
  img.width=183;
  img.height=61;
  img.style.setProperty('position','absolute','important');
  img.style.setProperty('left','24px','important');
  img.style.setProperty('top','24px','important');
  img.style.setProperty('width','183px','important');
  img.style.setProperty('height','61px','important');
  img.style.setProperty('max-width','none','important');
  img.style.setProperty('max-height','none','important');
  img.style.setProperty('object-fit','contain','important');
  img.style.setProperty('display','block','important');
  img.style.setProperty('z-index','20','important');
}
let queued=false;
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply(document)})}
installStyle();apply(document);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',()=>apply(document));
})();