from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old_sig = '<div class="invoice-signatures"><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้รับสินค้า/Received By</div></div><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้ส่งสินค้า/Sent By</div></div><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้มีอำนาจอนุมัติ/Manager</div></div></div>'
new_sig = '<div class="invoice-signatures"><div><div class="sigline">ลงชื่อ................................................</div><div class="siglabel">ผู้มีอำนาจอนุมัติ/Manager</div></div></div>'

# Remove Received By + Sent By everywhere they are generated in index.html,
# including the main invoice preview and billing/print document template.
s = s.replace(old_sig, new_sig)

# Force one Thai document font throughout invoice/billing output while preserving
# each element's intended size/weight. Keep the remaining approval signature
# in the original right-hand signature column.
font_css = """
<style id="invoice-signature-font-hotfix">
#invoicePaper,
#invoicePaper *,
.billing-paper,
.billing-paper * {
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

if 'id="invoice-signature-font-hotfix"' not in s:
    s = s.replace('</head>', font_css + '</head>', 1)

# Print popup has its own isolated document head. Strengthen its embedded CSS too.
needle = ".invoice-paper *{font-family:inherit}"
replacement = ".invoice-paper *{font-family:'TH Sarabun New','TH SarabunPSK','Sarabun',Tahoma,sans-serif!important}.invoice-signatures>div:only-child{grid-column:3!important}"
s = s.replace(needle, replacement)

p.write_text(s, encoding='utf-8')
print('invoice signatures reduced to Manager only; invoice font unified')
