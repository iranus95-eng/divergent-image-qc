(function(){
'use strict';
/* Force-load the latest embedded-logo/A4 fix with a fresh cache key.
   This stays observer-free to avoid the freeze caused by earlier logo loops. */
if(document.querySelector('script[data-billing-a4-inline-v6]'))return;
const s=document.createElement('script');
s.src='./js/billing-a4-fix.js?v=20260914-2057';
s.async=false;
s.setAttribute('data-billing-a4-inline-v6','1');
document.head.appendChild(s);
})();