(function(){
'use strict';
const stack=['home'];let current='home';
const PAGE_ACCESS={claim:'claim',payroll:'payroll',advance:'claim_pending',expenses:'staff_expenses',qc:'qc',search:'search',users:'user_management',invoice:'invoice',billing:'billing'};
function buttons(){return Array.from(document.querySelectorAll('[data-page]'))}
function show(page,push){const target=document.querySelector('.workspace[data-workspace="'+page+'"]');if(!target)return;document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));target.classList.add('active');buttons().forEach(b=>b.classList.toggle('active',b.dataset.page===page));const title=document.getElementById('pageTitle');if(title)title.textContent=target.dataset.title||'Divergent Corporation';if(push!==false&&page!==current){stack.push(page);if(stack.length>30)stack.splice(1,1)}current=page;window.scrollTo({top:0,behavior:'auto'})}
function back(){if(stack.length>1){stack.pop();show(stack[stack.length-1],false)}else show('home',false)}
function home(){stack.length=1;stack[0]='home';show('home',false)}
function bind(){buttons().forEach(b=>b.addEventListener('click',()=>show(b.dataset.page,true)));document.querySelectorAll('[data-open]').forEach(c=>c.addEventListener('click',()=>show(c.dataset.open,true)));document.getElementById('btnBack').addEventListener('click',back);document.getElementById('btnHome').addEventListener('click',home);show('home',false)}
function applyPermissions(s){if(!s||!s.confirmed)return;document.querySelectorAll('[data-page],[data-open]').forEach(el=>{const page=el.dataset.page||el.dataset.open;if(!page||page==='home')return;const key=PAGE_ACCESS[page];if(!key)return;const allowed=!!s.access[key];el.hidden=!allowed});if(current!=='home'){const key=PAGE_ACCESS[current];if(key&&!s.access[key])home()}}
async function refreshAuth(){const box=document.getElementById('authStatus');try{if(!window.DivergentV2Auth){if(box)box.textContent='UI V2 · ยังไม่เชื่อมสิทธิ์';return}const s=await window.DivergentV2Auth.refresh();if(s&&s.confirmed){applyPermissions(s);const u=s.user||{};if(box)box.textContent=(u.display_name||u.name||u.username||'ผู้ใช้งาน')+' · สิทธิ์จริงเชื่อมแล้ว';document.body.dataset.auth='ready'}else{if(box)box.textContent='ยังไม่ได้เข้าสู่ระบบ · ใช้หน้าเดิมล็อกอินก่อน';document.body.dataset.auth='required'}}catch(_){if(box)box.textContent='ตรวจสอบสิทธิ์ไม่สำเร็จ';document.body.dataset.auth='error'}}
function boot(){bind();refreshAuth()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();