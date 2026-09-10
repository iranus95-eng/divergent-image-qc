(function(window){
'use strict';
const SESSION_KEY='divergent_fallback_session_token';
const API='https://neauzvqroaszvqffahkv.functions.supabase.co/menu-access-api';
const EMPTY={qc:false,claim:false,claim_pending:false,search:false,payroll:false,staff_expenses:false,user_management:false,invoice:false,billing:false,pnl:false};
let state={status:'idle',user:null,access:{...EMPTY},confirmed:false,error:''};
function token(){try{return localStorage.getItem(SESSION_KEY)||''}catch(_){return''}}
function normalize(raw){raw=raw||{};return{qc:!!raw.qc,claim:!!raw.claim,claim_pending:!!raw.claim_pending,search:!!raw.search,payroll:!!raw.payroll,staff_expenses:!!raw.staff_expenses,user_management:!!raw.user_management,invoice:!!raw.invoice,billing:!!raw.billing,pnl:!!raw.pnl}}
function getState(){return{status:state.status,user:state.user?{...state.user}:null,access:{...state.access},confirmed:state.confirmed,error:state.error}}
async function refresh(){const t=token();if(!t){state={status:'idle',user:null,access:{...EMPTY},confirmed:false,error:'AUTH_REQUIRED'};return getState()}state.status='loading';try{const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),8000);let r;try{r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:'{}',signal:ctl.signal})}finally{clearTimeout(timer)}const j=await r.json().catch(()=>({}));if(!r.ok||!j.access){state={status:'error',user:null,access:{...EMPTY},confirmed:false,error:j.error||'ACCESS_FAILED'};return getState()}state={status:'ready',user:j.user||null,access:normalize(j.access),confirmed:true,error:''};return getState()}catch(e){state={status:'error',user:null,access:{...EMPTY},confirmed:false,error:e&&e.name==='AbortError'?'TIMEOUT':'ACCESS_FAILED'};return getState()}}
window.DivergentV2Auth=Object.freeze({refresh,getState,can:function(k){return!!(state.confirmed&&state.access[k])}});
})(window);