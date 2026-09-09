from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Replace the old 5-column invoice table and standalone amount-in-words block
# with the approved 7-column table and one BAHTTEXT total row.
table_re=re.compile(r'<table class="invoice-table"><thead><tr><th style="width:45px">ลำดับ</th><th>รายการ</th><th style="width:82px">จำนวน</th><th style="width:92px">ราคาต่อหน่วย</th><th style="width:110px">จำนวนเงิน</th></tr></thead><tbody id="pInvItems"></tbody><tfoot>.*?</tfoot></table>\s*<div class="invoice-baht" id="pInvBaht"></div>',re.S)
new_table='''<table class="invoice-table"><thead><tr><th style="width:45px">ลำดับ</th><th>รายการ</th><th style="width:76px">จำนวน<br>(ราย)</th><th style="width:82px">ราคา/หน่วย<br>(บาท)</th><th style="width:92px">จำนวนเงิน</th><th style="width:82px">ภาษี<br>มูลค่าเพิ่ม</th><th style="width:105px">ราคารวม (บาท)</th></tr></thead><tbody id="pInvItems"></tbody><tfoot><tr><td></td><td class="sumlabel" style="text-align:left">รวมเป็นเงินทั้งสิ้น</td><td colspan="4" class="center" id="pInvBahtText"></td><td class="num" id="pInvGrand"></td></tr></tfoot></table>'''
s,n=table_re.subn(new_table,s,count=1)
if n!=1:
    raise SystemExit(f'Invoice table replacement count={n}')

fn_re=re.compile(r'    function renderInvoicePreview\(\)\{.*?\}\n    async function refreshInvoiceMenuAccess',re.S)
new_fn='''    function renderInvoicePreview(){const c=invoiceCustomers()[Number(document.getElementById("invCustomer")?.value||0)]||invoiceDefaultCustomers()[0];const no=document.getElementById("invNo")?.value||"",dt=document.getElementById("invDateText")?.value||"",tax=document.getElementById("invTaxId")?.value||"",addr=document.getElementById("invAddress")?.value||"";const bm=document.getElementById("invBillMonth")?.value||"",sd=invoiceThaiDateShort(document.getElementById("invStartDate")?.value),ed=invoiceThaiDateShort(document.getElementById("invEndDate")?.value),month=invoiceThaiMonth(bm);document.getElementById("pInvNo").textContent=no;document.getElementById("pInvDate").textContent=dt;document.getElementById("pInvCustomer").textContent=c.name;document.getElementById("pInvTax").textContent=tax;document.getElementById("pInvAddress").textContent=addr;let sub=0,vat=0,grand=0;document.getElementById("pInvItems").innerHTML=invoiceItems.map((r,i)=>{const amt=Number(r.qty||0)*Number(r.price||0),rowVat=amt*.07,rowTotal=amt+rowVat;sub+=amt;vat+=rowVat;grand+=rowTotal;const desc=`ส่งบิลแจ้งเตือนค่าไฟฟ้าด้วยระบบ INSX<br>ประจำเดือน ${month} (${sd} - ${ed}) ${escapeHtml(r.area)}`;return `<tr><td class="center">${i+1}</td><td>${desc}</td><td class="num">${Number(r.qty||0).toLocaleString("th-TH")}</td><td class="num">${invoiceMoney(r.price)}</td><td class="num">${invoiceMoney(amt)}</td><td class="num">${invoiceMoney(rowVat)}</td><td class="num">${invoiceMoney(rowTotal)}</td></tr>`}).join("");document.getElementById("pInvGrand").textContent=invoiceMoney(grand);document.getElementById("pInvBahtText").textContent=thaiBahtText(grand);document.getElementById("invFormTotals").innerHTML=`รวมราคาสินค้า <b>${invoiceMoney(sub)}</b> บาท<br>ภาษีมูลค่าเพิ่ม 7% <b>${invoiceMoney(vat)}</b> บาท<br>จำนวนเงินรวมทั้งสิ้น <b>${invoiceMoney(grand)}</b> บาท<br><b>${thaiBahtText(grand)}</b>`}
    async function refreshInvoiceMenuAccess'''
s,n=fn_re.subn(new_fn,s,count=1)
if n!=1:
    raise SystemExit(f'renderInvoicePreview replacement count={n}')

p.write_text(s,encoding='utf-8')
print('Invoice BAHTTEXT layout patched successfully')
