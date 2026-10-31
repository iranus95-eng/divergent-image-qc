import {
  computeNotice,
  loadNoticeValues,
  noticeStorageKey,
  shareOf,
  type Allocation,
} from './NoticeCalculator';
import { useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import type { Site } from './NoticeSites';
import { datedFileName } from './fileName';
import { downloadBlob, xlsxBlob, type XlsxRow } from './xlsx';

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const esc = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
const TITLE = 'สรุปกำไรขาดทุน ไซด์ที่ชนะประมูล';
const FILE = 'สรุปกำไรขาดทุนใบแจ้งเตือน';
const HEADERS = [
  'ไซด์',
  'ราย/เดือน',
  'พนักงาน (คน)',
  'ราคาที่ชนะ (บาท/ราย)',
  'รายรับ/เดือน',
  'ค่าแรง + กระดาษ',
  'ส่วนกลางเฉลี่ย',
  'สัดส่วนส่วนกลาง (%)',
  'กำไร/เดือน',
  'กำไร 12 เดือน หลังค่าเริ่มต้น',
];
const DIGITS = [0, 0, 0, 2, 0, 0, 0, 2, 0, 0];

// The printed / PDF page: a standalone A4 landscape document with inline styles.
function reportHtml(
  table: (string | number)[][],
  metrics: [string, number][],
  notes: string[],
) {
  const cell = (value: string | number, i: number, strong: boolean) => {
    const negative = typeof value === 'number' && value < 0;
    return `<td style="padding:6px 8px;border-bottom:1px solid #ede9fe;text-align:${i ? 'right' : 'left'};white-space:nowrap;${strong ? 'font-weight:700;' : ''}${negative ? 'color:#b42318;' : ''}">${typeof value === 'number' ? fmt(value, DIGITS[i]) : esc(value)}</td>`;
  };
  const rows = table
    .map(
      (row, r) =>
        `<tr style="background:${r === table.length - 1 ? '#f1ebff' : '#fff'}">${row
          .map((value, i) => cell(value, i, r === table.length - 1))
          .join('')}</tr>`,
    )
    .join('');
  return (
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>' +
    esc(datedFileName(FILE)) +
    `</title><style>@page{size:A4 landscape;margin:8mm}html,body{margin:0;background:#fff}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}</style></head><body><article style="width:1123px;padding:30px 34px;color:#23153c;font-family:'Noto Sans Thai','IBM Plex Sans Thai',Tahoma,Arial,sans-serif;line-height:1.45">` +
    `<header style="display:flex;justify-content:space-between;border-bottom:3px solid #7c3aed;padding-bottom:10px;margin-bottom:14px"><div><b style="letter-spacing:1px;font-size:13px;color:#5b21b6">DIVERGENT CORPORATION</b><h1 style="font-size:24px;margin:6px 0 0">${TITLE}</h1><p style="margin:2px 0 0;font-size:14px">ใบแจ้งเตือนค่าไฟฟ้า</p></div><div style="text-align:right;font-size:11px">${esc(new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))}</div></header>` +
    `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">${metrics
      .map(
        ([label, value]) =>
          `<div style="background:#f7f3ff;border-radius:8px;padding:10px 12px"><div style="font-size:11px;color:#6b5b80">${label}</div><b style="font-size:17px;${value < 0 ? 'color:#b42318' : ''}">${fmt(value)} บาท</b></div>`,
      )
      .join('')}</div>` +
    `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${HEADERS.map(
      (h, i) =>
        `<th style="padding:7px 8px;background:#f1ebff;color:#4c1d95;font-size:11px;text-align:${i ? 'right' : 'left'}">${h}</th>`,
    ).join('')}</tr></thead><tbody>${rows}</tbody></table>` +
    notes
      .map(
        (note) =>
          `<p style="font-size:11px;color:#6b5b80;margin:8px 0 0">${esc(note)}</p>`,
      )
      .join('') +
    '</article></body></html>'
  );
}

// Rough profit and loss of the won sites, each costed with its own saved inputs.
export default function NoticeSummary({
  sites,
  incomplete,
  noQuote,
  noQuoteQty,
  quoteError,
  allocationFor,
  onOpen,
}: {
  sites: Site[];
  incomplete: { name: string; missing: string }[];
  noQuote: string[];
  noQuoteQty: string[];
  quoteError: boolean;
  allocationFor: (jobs: number) => Allocation;
  onOpen: (id: string) => void;
}) {
  const lines = sites.map((site) => {
    const values = loadNoticeValues(noticeStorageKey(site.id), site);
    const share = shareOf(allocationFor(site.jobs), values.jobs);
    const result = computeNotice(values, share);
    const direct = result.labor + result.paperCount * values.paper;
    const profit = result.revenue - result.recurring;
    return {
      site,
      values,
      share,
      direct,
      shared: result.recurring - direct,
      ...result,
      profit,
      contract: profit * 12 - result.startup,
    };
  });
  const total = (pick: (line: (typeof lines)[number]) => number) =>
    lines.reduce((sum, line) => sum + pick(line), 0);
  const revenue = total((line) => line.revenue);
  const recurring = total((line) => line.recurring);
  const contract = total((line) => line.contract);
  const sharedTotals = lines[0]?.values;
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const table: (string | number)[][] = [
    ...lines.map((line) => [
      line.site.name,
      line.values.jobs,
      line.workers,
      line.values.auction,
      line.revenue,
      line.direct,
      line.shared,
      line.share * 100,
      line.profit,
      line.contract,
    ]),
    [
      'รวม ' + sites.length + ' ไซด์',
      total((line) => line.values.jobs),
      total((line) => line.workers),
      '',
      revenue,
      total((line) => line.direct),
      total((line) => line.shared),
      100,
      revenue - recurring,
      contract,
    ],
  ];
  const metrics: [string, number][] = [
    ['รายรับ/เดือน', revenue],
    ['ต้นทุนประจำ/เดือน', recurring],
    ['กำไรดำเนินงาน/เดือน', revenue - recurring],
    ['กำไรตลอดสัญญา 12 เดือน', contract],
  ];
  const notes = [
    'จำนวนราย/เดือน = จำนวนรายในใบเสนอราคา ÷ 12' +
      (noQuoteQty.length
        ? ' (ไม่พบในใบเสนอราคา ใช้งบประมาณ ÷ ราคากลาง ÷ 12: ' +
          noQuoteQty.join(', ') +
          ')'
        : ''),
    'ส่วนกลาง = เงินเดือนผู้คุมงาน + ประกันสังคมส่วนนายจ้าง + QC + ค่าใช้จ่ายสตาฟ + ค่าเอกสาร + ค่ารับรอง เฉลี่ยตามสัดส่วนจำนวนรายของไซด์ที่ชนะประมูล • ยังไม่บวกหรือแยก VAT และภาษีเงินได้นิติบุคคล',
    ...(incomplete.length
      ? [
          'ยังไม่นับในยอดรวม (ข้อมูลไม่ครบ): ' +
            incomplete
              .map((site) => site.name + ' ขาด' + site.missing)
              .join(' • '),
        ]
      : []),
  ];
  const exportExcel = () => {
    const rows: XlsxRow[] = [
      { cells: [TITLE], bold: true },
      { cells: [] },
      ...metrics.map(([label, value]) => ({ cells: [label, value] })),
      { cells: [] },
      { cells: HEADERS, bold: true },
      ...table.map((row, r) => ({
        cells: row,
        bold: r === table.length - 1,
      })),
      { cells: [] },
      ...notes.map((note) => ({ cells: [note] })),
    ];
    downloadBlob(
      xlsxBlob(
        'สรุปกำไรขาดทุน',
        rows,
        [24, 12, 12, 14, 14, 15, 15, 14, 14, 18],
      ),
      datedFileName(FILE) + '.xlsx',
    );
  };
  const exportReport = async (mode: 'print' | 'pdf') => {
    if (busy) return;
    setBusy(true);
    setExportError('');
    const frame = document.createElement('iframe');
    frame.title = TITLE;
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1123px;height:800px;border:0';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument;
      if (!doc) throw new Error('report frame unavailable');
      doc.open();
      doc.write(reportHtml(table, metrics, notes));
      doc.close();
      await doc.fonts.ready;
      if (mode === 'print') {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => frame.remove(), 60000);
        return;
      }
      const article = doc.querySelector('article');
      if (!article) throw new Error('report unavailable');
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(article, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        logging: false,
        width: 1123,
        height: article.scrollHeight,
        windowWidth: 1123,
      });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const scale = Math.min(277 / canvas.width, 190 / canvas.height);
      const width = canvas.width * scale;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.94),
        'JPEG',
        (297 - width) / 2,
        10,
        width,
        canvas.height * scale,
      );
      pdf.setProperties({ title: TITLE });
      pdf.save(datedFileName(FILE) + '.pdf');
      frame.remove();
    } catch {
      frame.remove();
      setExportError(
        'ไม่สามารถสร้างรายงานได้ กรุณาลองอีกครั้ง หรือใช้ปุ่มพิมพ์แล้วเลือกบันทึกเป็น PDF',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-6xl mx-auto mt-6 space-y-6">
      <header className="noticeHeader">
        <div className="noticeToolbar">
          <span className="noticeBrand">DIVERGENT CORPORATION</span>
          <div className="noticeReportActions">
            <button
              type="button"
              disabled={!sites.length}
              onClick={exportExcel}
              className="noticeOutline"
            >
              <FileSpreadsheet size={17} />
              ส่งออก Excel
            </button>
            <button
              type="button"
              disabled={!sites.length || busy}
              onClick={() => void exportReport('print')}
              className="noticeOutline"
            >
              <Printer size={17} />
              พิมพ์
            </button>
            <button
              type="button"
              disabled={!sites.length || busy}
              onClick={() => void exportReport('pdf')}
              className="noticePrimary"
            >
              <Download size={17} />
              {busy ? 'กำลังสร้างรายงาน…' : 'บันทึก PDF'}
            </button>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="text-red-700 text-sm mb-3">
            {exportError}
          </p>
        )}
        <p className="text-sm font-bold text-sky-700">ใบแจ้งเตือนค่าไฟฟ้า</p>
        <h1 className="text-3xl font-bold mt-1">
          สรุปกำไรขาดทุน ไซด์ที่ชนะประมูล
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          คิด {sites.length} ไซด์ • รายรับ = จำนวนราย/เดือน × ราคาต่อหน่วยที่ชนะ
          (จากใบเสนอราคา ถ้าไม่มีใช้ราคาปี70 ในตารางประมูล) • จำนวนราย/เดือน =
          จำนวนรายในใบเสนอราคา ÷ 12 •
          ต้นทุนแต่ละไซด์ใช้ค่าที่บันทึกไว้ในหน้าไซด์นั้น
        </p>
      </header>
      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ['รายรับ/เดือน', fmt(revenue)],
          ['ต้นทุนประจำ/เดือน', fmt(recurring)],
          ['กำไรดำเนินงาน/เดือน', fmt(revenue - recurring)],
          ['กำไรตลอดสัญญา 12 เดือน', fmt(contract)],
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <b>{value} บาท</b>
          </div>
        ))}
      </section>
      <section className="bg-white border rounded-2xl p-5 overflow-x-auto">
        <h2 className="font-bold mb-4">รายไซด์ (บาท/เดือน)</h2>
        <table>
          <thead>
            <tr>
              <th>ไซด์</th>
              <th>ราย/เดือน</th>
              <th>พนักงาน (คน)</th>
              <th>ราคาที่ชนะ</th>
              <th>รายรับ</th>
              <th>ค่าแรง + กระดาษ</th>
              <th>ส่วนกลางเฉลี่ย</th>
              <th>กำไร/เดือน</th>
              <th>กำไร 12 เดือน หลังค่าเริ่มต้น</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.site.id}>
                <td>
                  <button
                    type="button"
                    className="font-semibold text-sky-700 underline"
                    onClick={() => onOpen(line.site.id)}
                  >
                    {line.site.name}
                  </button>
                  <small className="block text-slate-500">
                    สัดส่วนส่วนกลาง {fmt(line.share * 100, 2)}%
                  </small>
                </td>
                <td>{fmt(line.values.jobs)}</td>
                <td>{fmt(line.workers)}</td>
                <td>{fmt(line.values.auction, 2)}</td>
                <td>{fmt(line.revenue)}</td>
                <td>{fmt(line.direct)}</td>
                <td>{fmt(line.shared)}</td>
                <td className={line.profit < 0 ? 'text-red-700 font-bold' : ''}>
                  {fmt(line.profit)}
                </td>
                <td
                  className={line.contract < 0 ? 'text-red-700 font-bold' : ''}
                >
                  {fmt(line.contract)}
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td>รวม {sites.length} ไซด์</td>
              <td>{fmt(total((line) => line.values.jobs))}</td>
              <td>{fmt(total((line) => line.workers))}</td>
              <td></td>
              <td>{fmt(revenue)}</td>
              <td>{fmt(total((line) => line.direct))}</td>
              <td>{fmt(total((line) => line.shared))}</td>
              <td className={revenue - recurring < 0 ? 'text-red-700' : ''}>
                {fmt(revenue - recurring)}
              </td>
              <td className={contract < 0 ? 'text-red-700' : ''}>
                {fmt(contract)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className="rounded-xl bg-sky-50 p-4 text-sm space-y-2">
        <p>
          ส่วนกลาง = เงินเดือนผู้คุมงาน
          {sharedTotals &&
            ' (' +
              sharedTotals.supervisors +
              ' คน รวม ' +
              fmt(sharedTotals.supervisorTotal) +
              ')'}{' '}
          + ประกันสังคมส่วนนายจ้าง + QC + ค่าใช้จ่ายสตาฟ + ค่าเอกสาร + ค่ารับรอง
          เฉลี่ยให้ไซด์ที่ชนะประมูลตามสัดส่วนจำนวนราย (จำนวนรายของไซด์ ÷
          จำนวนรายรวมของ {sites.length} ไซด์)
        </p>
        <p>
          ยอดรวมส่วนกลางแก้ได้ในหน้าแต่ละไซด์ หัวข้อ "ตั้งค่ายอดรวม"
          ยังไม่บวกหรือแยก VAT และภาษีเงินได้นิติบุคคล
        </p>
      </section>
      {(incomplete.length > 0 ||
        noQuote.length > 0 ||
        noQuoteQty.length > 0 ||
        quoteError) && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm space-y-2">
          {incomplete.length > 0 && (
            <p>
              ยังไม่นับในยอดรวม (ข้อมูลไม่ครบ):{' '}
              {incomplete
                .map((site) => site.name + ' ขาด' + site.missing)
                .join(' • ')}
            </p>
          )}
          {noQuote.length > 0 && (
            <p>
              ไม่มีใบเสนอราคา ใช้ราคาปี70 ในตารางประมูล: {noQuote.join(', ')}
            </p>
          )}
          {noQuoteQty.length > 0 && (
            <p>
              ไม่พบจำนวนรายในใบเสนอราคา ใช้งบประมาณ ÷ ราคากลาง ÷ 12:{' '}
              {noQuoteQty.join(', ')}
            </p>
          )}
          {quoteError && (
            <p role="alert">
              โหลดใบเสนอราคาไม่สำเร็จ ใช้ราคาปี70 ในตารางประมูลแทนทุกไซด์
            </p>
          )}
        </section>
      )}
      {sites.length === 0 && (
        <p>
          ยังไม่มีไซด์ที่ชนะประมูล กดช่องติ๊กหน้าชื่อไซด์ หรือ
          "เพิ่มไซด์ที่ชนะประมูล" ทางซ้ายเพื่อทำเครื่องหมาย
        </p>
      )}
    </div>
  );
}
