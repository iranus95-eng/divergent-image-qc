from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old_sig = '<div class="invoice-signatures"><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้รับสินค้า/Received By</div></div><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้ส่งสินค้า/Sent By</div></div><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้มีอำนาจอนุมัติ/Manager</div></div></div>'
new_sig = '<div class="invoice-signatures"><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้มีอำนาจอนุมัติ/Manager</div></div></div>'
s = s.replace(old_sig, new_sig)

# Government-style Thai document font: use one family everywhere in Invoice/Billing.
# This covers the data-entry workspace, preview paper, billing paper, controls and any
# invoice/billing element generated later by JavaScript. Sizes/weights remain unchanged.
font_css = """
<style id="invoice-signature-font-hotfix">
#invoiceWorkspace,
#invoiceWorkspace *,
#invoicePaper,
#invoicePaper *,
.invoice-paper,
.invoice-paper *,
.billing-paper,
.billing-paper *,
[id*="invoice" i],
[id*="invoice" i] *,
[class*="invoice" i],
[class*="invoice" i] *,
[id*="billing" i],
[id*="billing" i] *,
[class*="billing" i],
[class*="billing" i] * {
  font-family:'TH Sarabun New','TH SarabunPSK','Sarabun',Tahoma,sans-serif !important;
}
#invoiceWorkspace input,
#invoiceWorkspace select,
#invoiceWorkspace textarea,
#invoiceWorkspace button,
[id*="invoice" i] input,
[id*="invoice" i] select,
[id*="invoice" i] textarea,
[id*="invoice" i] button,
[id*="billing" i] input,
[id*="billing" i] select,
[id*="billing" i] textarea,
[id*="billing" i] button {
  font-family:'TH Sarabun New','TH SarabunPSK','Sarabun',Tahoma,sans-serif !important;
}
#invoicePaper .invoice-signatures,
.billing-paper .invoice-signatures {
  grid-template-columns:repeat(3,1fr) !important;
}
#invoicePaper .invoice-signatures > div:only-child,
.billing-paper .invoice-signatures > div:only-child {
  grid-column:3 !important;
}
</style>
"""

# Replace older font patch instead of stacking conflicting font rules.
s = re.sub(r'<style id="invoice-signature-font-hotfix">.*?</style>\s*', '', s, flags=re.S)
s = s.replace('</head>', font_css + '</head>', 1)

# Print popup has an isolated document. Force the same family there too.
family = "'TH Sarabun New','TH SarabunPSK','Sarabun',Tahoma,sans-serif"
s = s.replace('.invoice-paper *{font-family:inherit}', f'.invoice-paper,.invoice-paper *{{font-family:{family}!important}}')
s = re.sub(r"\.invoice-paper \*\{font-family:'TH Sarabun New','TH SarabunPSK','Sarabun',Tahoma,sans-serif!important\}", f'.invoice-paper,.invoice-paper *{{font-family:{family}!important}}', s)

p.write_text(s, encoding='utf-8')
print('Invoice/Billing official font unified across workspace, preview and print')
# workflow trigger v2
