(function(){
  'use strict';

  function hasQcAccess(state){
    try{
      if(state && state.access && window.DivergentPermissions){
        return !!window.DivergentPermissions.has(state.access,'qc',state.user||null);
      }
      if(window.DivergentAuthV3 && typeof window.DivergentAuthV3.can==='function'){
        return !!window.DivergentAuthV3.can('qc');
      }
    }catch(_){ }
    return false;
  }

  function apply(state){
    const allowed=hasQcAccess(state);
    const site=document.getElementById('siteSelect');
    const load=document.getElementById('loadButton');
    if(site) site.disabled=!allowed;
    if(load) load.disabled=!allowed;
    window.qcAccessAllowed=allowed;
    document.documentElement.dataset.qcAccess=allowed?'allowed':'denied';
    return allowed;
  }

  function sync(){
    try{
      const state=window.DivergentAuthV3&&typeof window.DivergentAuthV3.getState==='function'
        ? window.DivergentAuthV3.getState()
        : null;
      return apply(state);
    }catch(_){ return false; }
  }

  window.addEventListener('divergent:v3:auth',function(e){ apply(e&&e.detail||null); });
  if(window.DivergentEvents&&typeof window.DivergentEvents.on==='function'){
    window.DivergentEvents.on('auth:changed',apply);
  }

  // Legacy LIFF initialization can disable QC controls after a valid web session.
  // Reconcile again after startup without making LINE the authority for QC access.
  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(sync,0);
    setTimeout(sync,500);
    setTimeout(sync,1500);
  },{once:true});

  window.DivergentQcAccessV3={apply,sync};
})();
