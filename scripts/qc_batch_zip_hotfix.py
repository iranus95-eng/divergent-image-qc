from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

MARK = 'QC_BATCH_ZIP_HOTFIX_V1'
if MARK in s:
    print('Already patched')
    raise SystemExit(0)

# 1) JSZip library
head_marker = '</head>'
zip_script = '''\n  <!-- QC_BATCH_ZIP_HOTFIX_V1 -->\n  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>\n'''
if head_marker not in s:
    raise SystemExit('Missing </head> marker')
s = s.replace(head_marker, zip_script + head_marker, 1)

# 2) CSS for per-batch ZIP button and wide QC detail gallery
style_marker = '</style>'
css = r'''

    /* QC_BATCH_ZIP_HOTFIX_V1 */
    .batch-download {
      width: 100%;
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid #6c4ed9;
      background: #fff;
      color: #5a36c9;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: .15s ease;
    }
    .batch-download:hover { background:#f3efff; }
    .batch-download:disabled { opacity:.6; cursor:wait; }

    body.qc-detail-wide .container {
      max-width: none !important;
      width: calc(100% - 28px) !important;
      margin: 18px auto !important;
      padding-left: 14px !important;
      padding-right: 14px !important;
    }
    body.qc-detail-wide #detailArea {
      width: 100% !important;
      max-width: none !important;
    }
    body.qc-detail-wide .overview-grid,
    body.qc-detail-wide .image-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)) !important;
      gap: 10px !important;
      width: 100% !important;
    }
    body.qc-detail-wide .image-card {
      width: 100% !important;
      min-width: 0 !important;
    }
    body.qc-detail-wide .image-card img,
    body.qc-detail-wide .image-loading,
    body.qc-detail-wide .image-error {
      width: 100% !important;
      height: 132px !important;
      object-fit: cover !important;
    }
'''
if style_marker not in s:
    raise SystemExit('Missing </style> marker')
s = s.replace(style_marker, css + '\n' + style_marker, 1)

# 3) Add ZIP button at bottom of every batch card
old = '''            <div class="batch-open">\n              <span>เข้าตรวจสอบรูปภาพ</span>\n              <span aria-hidden="true">→</span>\n            </div>\n          </div>'''
new = '''            <div class="batch-open">\n              <span>เข้าตรวจสอบรูปภาพ</span>\n              <span aria-hidden="true">→</span>\n            </div>\n            <button class="batch-download" type="button"\n                    onclick="event.stopPropagation(); downloadBatchZip(${index}, this);">\n              ⬇ ดาวน์โหลด Batch (ZIP)\n            </button>\n          </div>'''
if old not in s:
    raise SystemExit('Batch card render marker not found')
s = s.replace(old, new, 1)

# 4) ZIP download function using existing authenticated qcApi + signed-url helpers
fn_marker = '    async function openBatchDetail(index) {'
fn = r'''
    async function downloadBatchZip(index, button) {
      const batch = (window.currentBatches || [])[index];
      if (!batch) return;

      const originalText = button ? button.textContent : '';
      try {
        if (button) {
          button.disabled = true;
          button.textContent = 'กำลังเตรียมไฟล์...';
        }
        if (typeof JSZip === 'undefined') {
          throw new Error('ZIP_LIBRARY_NOT_READY');
        }

        const result = await qcApi('images', {
          siteCode: batch.site_code,
          rawDate: batch.raw_date,
          batchId: batch.batch_id
        });
        const files = Array.isArray(result?.files) ? result.files : [];
        if (!files.length) throw new Error('ไม่พบรูปใน Batch นี้');

        const zip = new JSZip();
        const root = zip.folder(String(batch.batch_id || 'batch'));
        let done = 0;
        let next = 0;
        const concurrency = Math.min(4, files.length);

        const worker = async () => {
          while (true) {
            const i = next++;
            if (i >= files.length) return;
            const f = files[i];
            const fileName = typeof f === 'string'
              ? f
              : String(f?.name || f?.file_name || f?.filename || '');
            if (!fileName) continue;

            const objectPath =
              batch.site_code + '/' +
              batch.raw_date + '/' +
              batch.batch_id + '/' +
              fileName;

            const signedUrl = await createSignedImageUrl(objectPath);
            const response = await fetch(signedUrl, { cache: 'no-store' });
            if (!response.ok) throw new Error('ดาวน์โหลดรูปไม่สำเร็จ: ' + fileName);
            const blob = await response.blob();
            root.file(fileName, blob);

            done += 1;
            if (button) button.textContent = `กำลังรวม ZIP ${done}/${files.length}`;
          }
        };

        await Promise.all(Array.from({ length: concurrency }, worker));
        if (button) button.textContent = 'กำลังสร้าง ZIP...';

        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'STORE',
          streamFiles: true
        });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = String(batch.batch_id || 'batch') + '.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        console.error('Batch ZIP download failed', error);
        alert('ดาวน์โหลด ZIP ไม่สำเร็จ\n' + (error?.message || String(error)));
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText || '⬇ ดาวน์โหลด Batch (ZIP)';
        }
      }
    }

'''
if fn_marker not in s:
    raise SystemExit('openBatchDetail marker not found')
s = s.replace(fn_marker, fn + fn_marker, 1)

# 5) Enter/leave wide gallery mode only on detail page
open_old = '''    async function openBatchDetail(index) {\n      const batch = (window.currentBatches || [])[index];'''
open_new = '''    async function openBatchDetail(index) {\n      document.body.classList.add("qc-detail-wide");\n      const batch = (window.currentBatches || [])[index];'''
if open_old not in s:
    raise SystemExit('openBatchDetail body marker not found')
s = s.replace(open_old, open_new, 1)

close_old = '''    function closeBatchDetail() {\n      document.getElementById("detailArea").style.display = "none";\n      document.getElementById("batchArea").style.display = "block";\n    }'''
close_new = '''    function closeBatchDetail() {\n      document.body.classList.remove("qc-detail-wide");\n      document.getElementById("detailArea").style.display = "none";\n      document.getElementById("batchArea").style.display = "block";\n    }'''
if close_old not in s:
    raise SystemExit('closeBatchDetail marker not found')
s = s.replace(close_old, close_new, 1)

p.write_text(s, encoding='utf-8')
print('Patched index.html successfully')
