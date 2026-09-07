from pathlib import Path
import re

p = Path('js/invoice-master-dropdowns.js')
s = p.read_text(encoding='utf-8')

# Keep preview at the original fit-to-column size.
s = re.sub(
    r"const usable=Math\.max\(100,w\.clientWidth-28\),(?:baseScale=Math\.min\(1,usable/794\),scale=baseScale(?:\*(?:0\.82|0\.88|1(?:\.0)?))?|scale=Math\.min\(1,usable/794\))",
    "const usable=Math.max(100,w.clientWidth-28),scale=Math.min(1,usable/794)",
    s,
)

helper = r"""function markInvoiceBottomBlocks(){
  const p=byId('invoicePaper');
  if(!p)return;
  const paperRect=p.getBoundingClientRect();
  const pw=paperRect.width||794;
  const ph=paperRect.height||1123;
  const all=[...p.querySelectorAll('*')];
  const textOf=el=>(el.innerText||'').replace(/\s+/g,' ').trim();

  const resetFixed=el=>{
    if(!el)return;
    el.classList.remove('invoice-signatures-fixed','invoice-company-footer-fixed');
    ['position','left','right','top','bottom','margin','zIndex','background','transform'].forEach(k=>el.style[k]='');
  };
  p.querySelectorAll('.invoice-signatures-fixed,.invoice-company-footer-fixed').forEach(resetFixed);

  const promoteBlock=(seed,maxH)=>{
    let cur=seed,best=seed;
    while(cur&&cur.parentElement&&cur.parentElement!==p){
      const parent=cur.parentElement;
      const r=parent.getBoundingClientRect();
      const t=textOf(parent);
      if(r.width>=pw*0.52 && r.height>=12 && r.height<=maxH && t.length<1500){
        best=parent;
        cur=parent;
      }else break;
    }
    return best;
  };

  const sigSeeds=all.filter(el=>{
    const t=textOf(el);
    if(!t || t.length>1000)return false;
    return (t.includes('Received By')&&t.includes('Sent By')) ||
           (t.includes('ผู้รับ')&&t.includes('ผู้ส่ง')) ||
           (t.includes('ลงชื่อ')&&t.includes('Manager'));
  });
  if(sigSeeds.length){
    const seed=sigSeeds.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0];
    const sig=promoteBlock(seed,220);
    if(sig.parentElement!==p)p.appendChild(sig);
    sig.classList.add('invoice-signatures-fixed');
    Object.assign(sig.style,{position:'absolute',left:'42px',right:'42px',top:'auto',bottom:'112px',margin:'0',zIndex:'3',background:'#fff',transform:'none'});
  }

  const footerSeeds=all.filter(el=>{
    const t=textOf(el).toUpperCase();
    if(!t || t.length>900)return false;
    const r=el.getBoundingClientRect();
    const belowHeader=r.top > paperRect.top + ph*0.28;
    const company=t.includes('DIVERGENT CORPORATION') || t.includes('ไดเวอร์เจนท์ คอร์ปอเรชั่น');
    const notInvoiceTitle=!t.includes('ใบแจ้งหนี้/ใบวางบิล');
    const notSignature=!t.includes('RECEIVED BY')&&!t.includes('SENT BY')&&!t.includes('MANAGER');
    return belowHeader && company && notInvoiceTitle && notSignature;
  });
  if(footerSeeds.length){
    const seed=footerSeeds.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0];
    const foot=promoteBlock(seed,180);
    if(foot.parentElement!==p)p.appendChild(foot);
    foot.classList.add('invoice-company-footer-fixed');
    Object.assign(foot.style,{position:'absolute',left:'42px',right:'42px',top:'auto',bottom:'16px',margin:'0',zIndex:'4',background:'#fff',transform:'none'});
  }
}
"""

pattern = r"function markInvoiceBottomBlocks\(\)\{.*?\}\n(?=function patchPreview\(\)\{)"
if re.search(pattern, s, flags=re.S):
    s = re.sub(pattern, lambda _m: helper, s, flags=re.S)
else:
    s = s.replace('function patchPreview(){', helper + 'function patchPreview(){')

# Force re-layout after every preview render and after opening/loading invoice data.
s = s.replace(
    "syncPreviewCustomer();requestAnimationFrame(fitInvoicePreview);return r",
    "syncPreviewCustomer();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});return r"
)
s = s.replace(
    "syncPreviewCustomer();markInvoiceBottomBlocks();requestAnimationFrame(fitInvoicePreview);return r",
    "syncPreviewCustomer();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});return r"
)

# CSS fallback for screen + print/PDF.
s = re.sub(
    r"#invoicePaper \.invoice-signatures,#invoicePaper \.invoice-signatures-fixed\{[^}]*\}",
    "#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:42px!important;right:42px!important;top:auto!important;bottom:112px!important;margin:0!important;z-index:3!important;background:#fff!important;transform:none!important}",
    s,
)
s = re.sub(
    r"#invoicePaper \.invoice-company-footer,#invoicePaper \.invoice-company-footer-fixed\{[^}]*\}",
    "#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:42px!important;right:42px!important;top:auto!important;bottom:16px!important;margin:0!important;z-index:4!important;background:#fff!important;transform:none!important}",
    s,
)

p.write_text(s, encoding='utf-8')
print('invoice footer/signatures reparented and anchored to A4 bottom')
