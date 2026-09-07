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

# The real document already has deterministic classes in index.html:
#   .invoice-signatures = the 3 signature columns
#   .invoice-foot-img    = the complete blue-rule/company/address footer image
# Use those exact elements instead of trying to detect the footer from text.
helper = r"""function markInvoiceBottomBlocks(){
  const p=byId('invoicePaper');
  if(!p)return;
  p.style.position='relative';
  p.style.height='1123px';
  p.style.minHeight='1123px';
  p.style.overflow='hidden';

  const sig=p.querySelector('.invoice-signatures');
  const foot=p.querySelector('.invoice-foot-img');

  if(sig){
    if(sig.parentElement!==p)p.appendChild(sig);
    sig.classList.add('invoice-signatures-fixed');
    Object.assign(sig.style,{
      position:'absolute',left:'42px',right:'42px',width:'auto',
      top:'auto',bottom:'176px',margin:'0',zIndex:'5',
      background:'#fff',transform:'none'
    });
  }

  if(foot){
    if(foot.parentElement!==p)p.appendChild(foot);
    foot.classList.add('invoice-company-footer-fixed');
    Object.assign(foot.style,{
      position:'absolute',left:'34px',right:'auto',width:'calc(100% - 68px)',
      height:'100px',objectFit:'cover',objectPosition:'center bottom',
      top:'auto',bottom:'30px',margin:'0',zIndex:'6',
      background:'#fff',transform:'none',display:'block'
    });
  }
}
"""

pattern = r"function markInvoiceBottomBlocks\(\)\{.*?\}\n(?=function patchPreview\(\)\{)"
if re.search(pattern, s, flags=re.S):
    s = re.sub(pattern, lambda _m: helper, s, flags=re.S)
else:
    s = s.replace('function patchPreview(){', helper + 'function patchPreview(){')

# Re-layout after each render and before print/PDF/LINE capture.
s = s.replace(
    "syncPreviewCustomer();requestAnimationFrame(fitInvoicePreview);return r",
    "syncPreviewCustomer();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});return r"
)
s = s.replace(
    "syncPreviewCustomer();markInvoiceBottomBlocks();requestAnimationFrame(fitInvoicePreview);return r",
    "syncPreviewCustomer();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});return r"
)

# Add a final high-specificity override. This deliberately targets the actual footer image,
# so the company footer cannot remain in normal document flow above the signatures.
override_css = "#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:42px!important;right:42px!important;width:auto!important;top:auto!important;bottom:176px!important;margin:0!important;z-index:5!important;background:#fff!important;transform:none!important}#invoicePaper .invoice-foot-img,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:34px!important;right:auto!important;width:calc(100% - 68px)!important;height:100px!important;object-fit:cover!important;object-position:center bottom!important;top:auto!important;bottom:30px!important;margin:0!important;z-index:6!important;background:#fff!important;transform:none!important;display:block!important}@media print{#invoicePaper{position:relative!important;width:210mm!important;height:297mm!important;min-height:297mm!important;overflow:hidden!important}#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:46mm!important;margin:0!important}#invoicePaper .invoice-foot-img,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:9mm!important;right:auto!important;width:192mm!important;height:26mm!important;bottom:8mm!important;margin:0!important;object-fit:cover!important;object-position:center bottom!important}}"

# Remove older exact-layout overrides inserted by previous hotfix runs, then append the authoritative one.
s = re.sub(r"#invoicePaper \.invoice-signatures,#invoicePaper \.invoice-signatures-fixed\{[^}]*\}#invoicePaper \.invoice-company-footer,#invoicePaper \.invoice-company-footer-fixed\{[^}]*\}", "", s)
s = re.sub(r"@media print\{#invoicePaper\{position:relative!important;width:210mm!important;height:297mm!important;min-height:297mm!important;overflow:hidden!important\}#invoicePaper \.invoice-signatures,#invoicePaper \.invoice-signatures-fixed\{[^}]*\}#invoicePaper \.invoice-company-footer,#invoicePaper \.invoice-company-footer-fixed\{[^}]*\}\}", "", s)

marker='`;document.head.appendChild(s)}'
if override_css not in s and marker in s:
    s=s.replace(marker, override_css+marker)

p.write_text(s, encoding='utf-8')
print('invoice A4 pinned to Excel reference using .invoice-signatures + .invoice-foot-img')
