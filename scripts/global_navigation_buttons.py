from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='</body>'
if 'id="divergentGlobalNav"' in s:
    print('global nav already installed')
    raise SystemExit(0)
patch=r'''
<style id="divergent-global-nav-style">
#divergentGlobalNav{position:fixed;left:18px;bottom:18px;z-index:2147483000;display:flex;gap:10px;align-items:center;font-family:Arial,Tahoma,sans-serif}
#divergentGlobalNav button{appearance:none;border:1px solid #d9ccf5;border-radius:12px;padding:11px 16px;min-height:44px;background:#fff;color:#5426a8;font-size:15px;font-weight:800;box-shadow:0 5px 18px rgba(63,31,115,.18);cursor:pointer;white-space:nowrap}
#divergentGlobalNav .global-home-btn{background:#6c35cf;color:#fff;border-color:#6c35cf}
#divergentGlobalNav button:hover{transform:translateY(-1px);box-shadow:0 7px 22px rgba(63,31,115,.25)}
@media(max-width:640px){#divergentGlobalNav{left:10px;right:10px;bottom:10px}#divergentGlobalNav button{flex:1;padding:10px 8px;font-size:14px}body{padding-bottom:68px!important}}
</style>
<div id="divergentGlobalNav" role="navigation" aria-label="การนำทางหลัก">
  <button type="button" id="divergentBackBtn">← ย้อนกลับ</button>
  <button type="button" id="divergentHomeBtn" class="global-home-btn">⌂ กลับสู่เมนูหลัก</button>
</div>
<script id="divergent-global-nav-script">
(function(){
  function visible(el){return !!(el && el.offsetParent!==null);}
  function closeOverlay(){
    const selectors=['.review-modal.open','.modal.show','.modal.open','[role="dialog"].open'];
    for(const q of selectors){const el=document.querySelector(q);if(visible(el)){const close=el.querySelector('.review-close,.close,[data-dismiss="modal"],[data-close]');if(close){close.click();return true;}}}
    return false;
  }
  function back(){
    if(closeOverlay()) return;
    const detail=document.querySelector('.detail-area');
    if(detail && getComputedStyle(detail).display!=='none'){
      const local=[...detail.querySelectorAll('button,a')].find(x=>/ย้อนกลับ|กลับไป|back/i.test((x.textContent||'').trim()));
      if(local){local.click();return;}
      detail.style.display='none';
      const batch=document.querySelector('.batch-area');if(batch) batch.style.display='block';
      window.scrollTo({top:0,behavior:'smooth'});return;
    }
    if(history.length>1){history.back();return;}
    home();
  }
  function home(){
    if(typeof window.showHome==='function'){window.showHome();return;}
    const candidates=['#home','#homePage','#mainMenu','#main-menu','.home-page','.main-menu','.menu-grid'];
    for(const q of candidates){const el=document.querySelector(q);if(el){document.querySelectorAll('.detail-area').forEach(x=>x.style.display='none');el.style.display='';window.scrollTo({top:0,behavior:'smooth'});return;}}
    const url=new URL(location.href);url.hash='';url.search='';location.href=url.toString();
  }
  document.getElementById('divergentBackBtn').addEventListener('click',back);
  document.getElementById('divergentHomeBtn').addEventListener('click',home);
})();
</script>
'''
if marker not in s: raise SystemExit('missing </body>')
s=s.replace(marker,patch+'\n'+marker,1)
p.write_text(s,encoding='utf-8')
print('installed global navigation')
