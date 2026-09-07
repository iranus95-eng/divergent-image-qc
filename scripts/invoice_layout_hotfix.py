from pathlib import Path

p = Path('js/invoice-master-dropdowns.js')
s = p.read_text(encoding='utf-8')

s = s.replace('scale=baseScale*0.82', 'scale=baseScale*0.88')

helper = """function markInvoiceBottomBlocks(){const p=byId('invoicePaper');if(!p)return;const all=[...p.querySelectorAll('div,section,table,tbody,tr')];const sig=all.filter(el=>{const t=(el.innerText||'').replace(/\\s+/g,' ').trim();return t.length<900&&t.includes('Received By')&&t.includes('Sent By')&&(t.includes('Manager')||t.includes('ผู้มีอำนาจลงนาม'))}).sort((a,b)=>(a.innerText||'').length-(b.innerText||'').length)[0];if(sig)sig.classList.add('invoice-signatures-fixed');const foot=all.filter(el=>{const t=(el.innerText||'').replace(/\\s+/g,' ').trim();return t.length<900&&t.includes('DIVERGENT CORPORATION CO., LTD.')&&(t.includes('โทร')||t.includes('เลขที่ 30')||t.includes('กรุงเทพมหานคร'))}).sort((a,b)=>(a.innerText||'').length-(b.innerText||'').length)[0];if(foot)foot.classList.add('invoice-company-footer-fixed')}
"""

if 'function markInvoiceBottomBlocks()' not in s:
    s = s.replace('function patchPreview(){', helper + 'function patchPreview(){')

s = s.replace(
    'syncPreviewCustomer();requestAnimationFrame(fitInvoicePreview);return r',
    'syncPreviewCustomer();markInvoiceBottomBlocks();requestAnimationFrame(fitInvoicePreview);return r'
)

s = s.replace(
    'requestAnimationFrame(fitInvoicePreview);try{await load()',
    'requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});try{await load();markInvoiceBottomBlocks()'
)

s = s.replace(
    '#invoicePaper .invoice-signatures{position:absolute!important;left:42px!important;right:42px!important;bottom:118px!important;margin:0!important}',
    '#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:42px!important;right:42px!important;bottom:122px!important;margin:0!important;z-index:3!important;background:#fff!important}'
)

s = s.replace(
    '#invoicePaper .invoice-company-footer{position:absolute!important;left:42px!important;right:42px!important;bottom:32px!important;margin:0!important}',
    '#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:42px!important;right:42px!important;bottom:24px!important;margin:0!important;z-index:2!important;background:#fff!important}'
)

s = s.replace(
    '#invoicePaper .invoice-signatures{position:absolute!important;left:12mm!important;right:12mm!important;bottom:31mm!important}',
    '#invoicePaper .invoice-signatures,#invoicePaper .invoice-signatures-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:32mm!important}'
)

s = s.replace(
    '#invoicePaper .invoice-company-footer{position:absolute!important;left:12mm!important;right:12mm!important;bottom:8mm!important}',
    '#invoicePaper .invoice-company-footer,#invoicePaper .invoice-company-footer-fixed{position:absolute!important;left:12mm!important;right:12mm!important;bottom:6mm!important}'
)

s = s.replace(
    'function boot(){addCss();patchPreview();patch();requestAnimationFrame(fitInvoicePreview);',
    'function boot(){addCss();patchPreview();patch();requestAnimationFrame(()=>{markInvoiceBottomBlocks();fitInvoicePreview()});'
)

p.write_text(s, encoding='utf-8')
print('invoice A4 layout patch applied')
