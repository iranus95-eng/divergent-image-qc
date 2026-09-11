from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
mark='QC_BATCH_OWNER_NAME_V1'
if mark in s:
    print('Already patched')
    raise SystemExit(0)

const_marker='    const QC_BATCH_DATA_API_URL =\n      "https://neauzvqroaszvqffahkv.functions.supabase.co/qc-batch-data";'
const_new=const_marker+'\n    const QC_BATCH_OWNER_API_URL =\n      "https://neauzvqroaszvqffahkv.functions.supabase.co/qc-batch-owner"; // '+mark
if const_marker not in s:
    raise SystemExit('QC batch data constant marker not found')
s=s.replace(const_marker,const_new,1)

batch_marker='''        const result = await qcApi("batches", { siteCode });\n        const batches = result.batches || [];\n        window.currentBatches = batches;'''
batch_new='''        const result = await qcApi("batches", { siteCode });\n        const batches = result.batches || [];\n        try {\n          const token = await getBestDataToken();\n          if (token && batches.length) {\n            const ownerResponse = await fetch(QC_BATCH_OWNER_API_URL, {\n              method: "POST",\n              headers: {\n                "Authorization": "Bearer " + token,\n                "Content-Type": "application/json"\n              },\n              body: JSON.stringify({ batchIds: batches.map(x => x.batch_id) })\n            });\n            const ownerData = await ownerResponse.json().catch(() => ({}));\n            if (ownerResponse.ok && Array.isArray(ownerData.owners)) {\n              const ownerMap = new Map(ownerData.owners.map(x => [String(x.batch_id), x]));\n              for (const batch of batches) {\n                const owner = ownerMap.get(String(batch.batch_id));\n                if (owner) {\n                  batch.employee_name = owner.employee_name || "";\n                  batch.uploaded_by_username = owner.username || "";\n                }\n              }\n            }\n          }\n        } catch (ownerError) {\n          console.warn("QC batch owner lookup failed", ownerError);\n        }\n        window.currentBatches = batches;'''
if batch_marker not in s:
    raise SystemExit('loadBatches marker not found')
s=s.replace(batch_marker,batch_new,1)

card_marker='''            <div class="batch-site">ไซด์งาน ${escapeHtml(batch.site_name)}</div>\n            <div class="batch-row">วันที่ ${escapeHtml(formatRawDate(batch.raw_date))}</div>\n            <div class="batch-row">จำนวนรูป ${escapeHtml(batch.image_count)} รูป</div>'''
card_new='''            <div class="batch-site">ไซด์งาน ${escapeHtml(batch.site_name)}</div>\n            <div class="batch-row">วันที่ ${escapeHtml(formatRawDate(batch.raw_date))}</div>\n            <div class="batch-row"><b>พนักงาน:</b> ${escapeHtml(batch.employee_name || batch.uploaded_by_username || "-")}</div>\n            <div class="batch-row">จำนวนรูป ${escapeHtml(batch.image_count)} รูป</div>'''
if card_marker not in s:
    raise SystemExit('batch card marker not found')
s=s.replace(card_marker,card_new,1)

p.write_text(s,encoding='utf-8')
print('Patched batch employee names')
