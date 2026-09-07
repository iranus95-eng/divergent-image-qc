from pathlib import Path
import re

p = Path('js/invoice-master-dropdowns.js')
s = p.read_text(encoding='utf-8')

# Restore preview to the original fit-to-column size (no extra shrink factor).
s = re.sub(
    r"const usable=Math\.max\(100,w\.clientWidth-28\),baseScale=Math\.min\(1,usable/794\),scale=baseScale\*(?:0\.82|0\.88|1(?:\.0)?)",
    "const usable=Math.max(100,w.clientWidth-28),baseScale=Math.min(1,usable/794),scale=baseScale",
    s,
)

helper = r"""function markInvoiceBottomBlocks(){
  const p=byId('invoicePaper');
  if(!p)return;
  const pw=p.getBoundingClientRect().width||794;
  const nodes=[...p.querySelectorAll('div,section,table,tbody,tr,footer')];
  const textOf=el=>(el.innerText||'').replace(/\s+/g,' ').trim();
  const promote=(el,maxH=190)=>{
    let cur=el,best=el;
    while(cur&&cur!==p){
      const r=cur.getBoundingClientRect();
      if(r.width>=pw*0.58&&r.height>12&&r.height<=maxH)best=cur;
      cur=cur.parentElement;
    }
    return best;
  };
  const sigSeed=nodes.filter(el=>{
    const t=textOf(el);
    return t.length<1100&&(
      (t.includes('Received By')&&t.includes('Sent By'))||
      (t.includes('ผู้รับ')&&t.includes('ผู้ส่ง'))||
      (t.includes('ลงชื่อ')&&t.includes('Manager'))
    );
  }).sort((a,b)=>(a.getBoundingClientRect().height||999)-(b.getBoundingClientRect().height||999))[0];
  if(sigSeed){
    const sig=promote(sigSeed,210);
    sig.classList.add('invoice-signatures-fixed');
    Object.assign(sig.style,{position:'absolute',left:'42px',right:'42px',bottom:'108px',margin:'0',zIndex:'3',background:'#fff'});
  }
  const footerSeeds=nodes.filter(el=>{
    const t=textOf(el).toUpperCase();
    return t.length<1200&&t.includes('DIVERGENT CORPORATION')&&!t.includes('ใบแจ้งหนี้/ใบวางบิล');
  });
  if(footerSeeds.length){
    const seed=footerSeeds.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0];
    const foot=promote(seed,190);
    foot.classList.add('invoice-company-footer-fixed');
    Object.assign(foot.style,{position:'absolute',left:'42px',right:'42px',bottom:'18px',margin:'0',zIndex:'4',background:'#fff'});
  }
}
"""

pattern = r"function markInvoiceBottomBlocks\(\)\{.*?\}\n(?=function patchPreview\(\)\{)"
if re.search(pattern, s, flags=re.S):
    s = re.sub(pattern, lambda _m: helper, s, flags=re.S)
else:
    s = s.replace('function patchPreview(){', helper + 'function patchPreview(){')

s = re.sub(
    r"#invoicePaper \.invoice-signatures,#invoicePaper \.invoice-signatures-fixed\{[^}]*\}",
    "#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:42px!important;right:42px!important;bottom:108px!important;margin:0!important;z-index:3!important;background:#fff!important}",
    s,
)
s = re.sub(
    r"#invoicePaper \.invoice-company-footer,#invoicePaper \.invoice-company-footer-fixed\{[^}]*\}",
    "#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:42px!important;right:42px!important;bottom:18px!important;margin:0!important;z-index:4!important;background:#fff!important}",
    s,
)
s = re.sub(
    r"#invoicePaper \.invoice-signatures,#invoicePaper \.invoice-signatures-fixed\{position:absolute!important;left:12mm!important;right:12mm!important;bottom:[^}]+\}",
    "#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:29mm!important}",
    s,
)
s = re.sub(
    r"#invoicePaper \.invoice-company-footer,#invoicePaper \.invoice-company-footer-fixed\{position:absolute!important;left:12mm!important;right:12mm!important;bottom:[^}]+\}",
    "#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:5mm!important}",
    s,
)

p.write_text(s, encoding='utf-8')
print('invoice footer anchored and preview restored')
