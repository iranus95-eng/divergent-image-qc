(function(){
  'use strict';
  if(document.querySelector('script[data-billing-logo-direct]'))return;
  const s=document.createElement('script');
  s.src='./js/billing-logo-direct.js?v=20260914-actual';
  s.async=false;
  s.setAttribute('data-billing-logo-direct','1');
  document.head.appendChild(s);
})();