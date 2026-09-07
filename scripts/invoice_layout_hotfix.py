from pathlib import Path
import re

p = Path('js/invoice-master-dropdowns.js')
s = p.read_text(encoding='utf-8')

# Keep preview at the normal fit-to-column size. Print/PDF remain full A4.
s = re.sub(
    r"const usable=Math\.max\(100,w\.clientWidth-28\),(?:baseScale=Math\.min\(1,usable/794\),scale=baseScale(?:\*(?:0\.82|0\.88|1(?:\.0)?))?|scale=Math\.min\(1,usable/794\))",
    "const usable=Math.max(100,w.clientWidth-28),scale=Math.min(1,usable/794)",
    s,
)

helper = r"""function markInvoiceBottomBlocks(){
  const p=byId('invoicePaper');
  if(!p)return;
  p.style.position='relative';
  p.style.height='1123px';
  p.style.minHeight='1123px';
  p.style.overflow='hidden';

  const all=[...p.querySelectorAll('*')];
  const textOf=el=>(el?.innerText||'').replace(/\s+/g,' ').trim();
  const upper=el=>textOf(el).toUpperCase();

  // Remove only our previous fixed-state classes/styles before locating the real blocks again.
  p.querySelectorAll('.invoice-signatures-fixed,.invoice-company-footer-fixed').forEach(el=>{
    el.classList.remove('invoice-signatures-fixed','invoice-company-footer-fixed');
    ['position','left','right','top','bottom','margin','zIndex','background','transform','width'].forEach(k=>el.style[k]='');
  });

  const commonAncestor=(nodes)=>{
    if(!nodes.length)return null;
    let a=nodes[0];
    while(a&&a!==p){
      if(nodes.every(n=>a===n||a.contains(n)))return a;
      a=a.parentElement;
    }
    return null;
  };

  const promote=(seed,maxHeight=220)=>{
    if(!seed)return null;
    let best=seed,cur=seed;
    while(cur&&cur.parentElement&&cur.parentElement!==p){
      const par=cur.parentElement;
      const r=par.getBoundingClientRect();
      const t=upper(par);
      if(r.height>maxHeight || t.includes('ใบแจ้งหนี้/ใบวางบิล') || t.length>1800)break;
      best=par;
      cur=par;
    }
    return best;
  };

  // Signature block: locate the three signature captions separately, then use their common row/container.
  const received=all.filter(el=>/RECEIVED BY|ผู้รับสินค้า|ผู้รับ\s*สินค้า/i.test(textOf(el)));
  const sent=all.filter(el=>/SENT BY|ผู้ส่งสินค้า|ผู้ส่ง\s*สินค้า/i.test(textOf(el)));
  const manager=all.filter(el=>/MANAGER|ผู้มีอำนาจอนุมัติ|ผู้มีอำนาจ/i.test(textOf(el)));
  let sig=null;
  if(received.length&&sent.length&&manager.length){
    const seeds=[received[received.length-1],sent[sent.length-1],manager[manager.length-1]];
    sig=commonAncestor(seeds);
    if(!sig||sig===p)sig=promote(seeds[0],230);
  }
  if(!sig){
    const seed=all.filter(el=>{
      const t=upper(el);
      return (t.includes('RECEIVED BY')&&t.includes('SENT BY')) ||
             (t.includes('ผู้รับ')&&t.includes('ผู้ส่ง')&&t.includes('ผู้มีอำนาจ'));
    }).pop();
    sig=promote(seed,230);
  }
  if(sig&&sig!==p){
    if(sig.parentElement!==p)p.appendChild(sig);
    sig.classList.add('invoice-signatures-fixed');
    Object.assign(sig.style,{position:'absolute',left:'42px',right:'42px',width:'auto',top:'auto',bottom:'150px',margin:'0',zIndex:'5',background:'#fff',transform:'none'});
  }

  // Company footer: require company name + footer-like address/branch detail so the header logo is never selected.
  let footerCandidates=all.filter(el=>{
    const t=upper(el);
    const company=t.includes('DIVERGENT CORPORATION CO., LTD') || t.includes('DIVERGENT CORPORATION') || t.includes('ไดเวอร์เจนท์ คอร์ปอเรชั่น');
    const address=/เลขที่|กรุงเทพ|10510|ซอย|ถนน|แขวง|เขต/.test(textOf(el));
    const noSignature=!t.includes('RECEIVED BY')&&!t.includes('SENT BY')&&!t.includes('MANAGER');
    const noTitle=!t.includes('ใบแจ้งหนี้/ใบวางบิล');
    return company&&address&&noSignature&&noTitle;
  });
  let foot=null;
  if(footerCandidates.length){
    // Prefer the deepest/smallest footer container, then promote only enough to include its blue rule.
    footerCandidates.sort((a,b)=>{
      const ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
      return (ra.height-rb.height)||(rb.top-ra.top);
    });
    foot=promote(footerCandidates[0],150);
  }
  if(foot&&foot!==p){
    if(foot.parentElement!==p)p.appendChild(foot);
    foot.classList.add('invoice-company-footer-fixed');
    Object.assign(foot.style,{position:'absolute',left:'42px',right:'42px',width:'auto',top:'auto',bottom:'54px',margin:'0',zIndex:'6',background:'#fff',transform:'none'});
  }
}
"""

pattern = r"function markInvoiceBottomBlocks\(\)\{.*?\}\n(?=function patchPreview\(\)\{)"
if re.search(pattern, s, flags=re.S):
    s = re.sub(pattern, lambda _m: helper, s, flags=re.S)
else:
    s = s.replace('function patchPreview(){', helper + 'function patchPreview(){')

# Re-layout after any preview change and before print/PDF/LINE capture.
s = s.replace(
    "syncPreviewCustomer();requestAnimationFrame(fitInvoicePreview);return r",
    "syncPreviewCustomer();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});return r"
)
s = s.replace(
    "syncPreviewCustomer();markInvoiceBottomBlocks();requestAnimationFrame(fitInvoicePreview);return r",
    "syncPreviewCustomer();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});return r"
)

# Exact A4 bottom zones based on the Excel print reference supplied by the user.
s = re.sub(
    r"#invoicePaper \.invoice-signatures,#invoicePaper \.invoice-signatures-fixed\{[^}]*\}",
    "#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:42px!important;right:42px!important;width:auto!important;top:auto!important;bottom:150px!important;margin:0!important;z-index:5!important;background:#fff!important;transform:none!important}",
    s,
)
s = re.sub(
    r"#invoicePaper \.invoice-company-footer,#invoicePaper \.invoice-company-footer-fixed\{[^}]*\}",
    "#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:42px!important;right:42px!important;width:auto!important;top:auto!important;bottom:54px!important;margin:0!important;z-index:6!important;background:#fff!important;transform:none!important}",
    s,
)

# Strong print/PDF fallback: A4 is always 210x297 mm and bottom blocks keep Excel-like spacing.
print_css = "@media print{#invoicePaper{position:relative!important;width:210mm!important;height:297mm!important;min-height:297mm!important;overflow:hidden!important}#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:39mm!important;margin:0!important}#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:14mm!important;margin:0!important}}"
if print_css not in s:
    s=s.replace('`;document.head.appendChild(s)}', print_css+'`;document.head.appendChild(s)}')

p.write_text(s, encoding='utf-8')
print('invoice A4 layout aligned to Excel reference: signatures above fixed company footer')
