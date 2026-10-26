import { cloudStorage, flush, setUnsaved, storageKeys } from './cloud';
import { useEffect, useRef, useState } from 'react';
import { Printer, Download, Eye } from 'lucide-react';
import NoticeReport from './NoticeReport';

const KEY = 'epc:electricity-notice:v1';
const ALLOCATION_JOBS = 200000;
const SHARED_TOTALS_REVISION = 'confirmed-totals-2026-10-16-v1';
const SHARED_COST_KEYS: (keyof Values)[] = [
  'supervisorTotal',
  'qcTotal',
  'staff',
  'documents',
  'hospitality',
];
const allocateSharedCost = (total: number, monthlyJobs: number) =>
  (total / ALLOCATION_JOBS) * monthlyJobs;
const defaults = {
  budget: 19200000,
  jobs: 200000,
  capacity: 2500,
  price: 8,
  auction: 8,
  labor: 3.5,
  withholding: 3,
  printer: 3500,
  supervisors: 4,
  supervisorTotal: 90000,
  qcPeople: 3,
  qcTotal: 9000,
  paper: 0.26,
  waste: 2,
  documents: 5000,
  staff: 50000,
  hospitality: 5000,
  shirt: 450,
  ssoRate: 5,
  ssoMin: 1650,
  ssoCap: 17500,
};
type Values = typeof defaults;
type Field = [keyof Values, string, number?];
const groups: { title: string; fields: Field[] }[] = [
  {
    title: 'ปริมาณงานและรายรับ',
    fields: [
      ['jobs', 'จำนวนรายต่อเดือน (คำนวณอัตโนมัติ)'],
      ['capacity', 'กำลังงานเฉลี่ย (ราย/คน/เดือน)', 1],
      ['price', 'ราคากลาง (บาท/ราย)'],
      ['auction', 'ราคาที่ประมูล (บาท/ราย)'],
    ],
  },
  {
    title: 'ค่าแรงและบุคลากร',
    fields: [
      ['labor', 'ค่าแรงส่งใบแจ้งเตือน (บาท/ราย)'],
      ['withholding', 'หัก ณ ที่จ่าย ค่าแรงและ QC (%)'],
      ['supervisors', 'ผู้คุมงาน (คน)', 1],
      ['supervisorTotal', 'เงินเดือนผู้คุมงานรวมทุกไซด์ (บาท/เดือน)'],
      ['qcPeople', 'QC (คน)', 1],
      ['qcTotal', 'ค่า QC รวมทุกไซด์ (บาท/เดือน)'],
    ],
  },
  {
    title: 'กระดาษและค่าใช้จ่ายประจำ',
    fields: [
      ['paper', 'กระดาษ (บาท/ฉบับ)'],
      ['waste', 'กระดาษเผื่อเสียเพิ่ม (%)'],
      ['documents', 'ค่าเอกสารรวมทุกไซด์ (บาท/เดือน)'],
      ['staff', 'ค่าใช้จ่ายสตาฟรวมทุกไซด์ (บาท/เดือน)'],
      ['hospitality', 'ค่ารับรองรวมทุกไซด์ (บาท/เดือน)'],
    ],
  },
  {
    title: 'ค่าเริ่มต้น เฉพาะพนักงานส่งใบแจ้งเตือน',
    fields: [
      ['printer', 'เครื่องพิมพ์ 1 เครื่อง/คน (บาท)'],
      ['shirt', 'เสื้อ 1 ตัว/คน (บาท)'],
    ],
  },
  {
    title: 'ประกันสังคมผู้คุมงาน — ส่วนนายจ้าง',
    fields: [
      ['ssoRate', 'อัตราสมทบ (%)'],
      ['ssoMin', 'ฐานค่าจ้างขั้นต่ำ (บาท/คน)'],
      ['ssoCap', 'ฐานค่าจ้างสูงสุด (บาท/คน)'],
    ],
  },
];
// Budget, ราคากลาง and the bid price follow the ตารางประมูลแจ้งเตือน row;
// edits are kept until that row changes.
export type BidSource = {
  bidId: number;
  budget: number;
  price: number;
  auction: number;
};
const sourceTag = (bid: BidSource) =>
  ['notice-bids', bid.bidId, bid.budget, bid.price, bid.auction].join(':');
const fmt = (n: number) =>
  n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
function load(storageKey: string, bid?: BidSource): Values {
  try {
    const saved = JSON.parse(cloudStorage.getItem(storageKey) || 'null');
    const result = { ...defaults };
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(defaults) as (keyof Values)[]) {
        if (
          typeof saved[key] === 'number' &&
          Number.isFinite(saved[key]) &&
          saved[key] >= 0
        )
          result[key] = saved[key];
      }
    }
    if (saved?.sharedTotalsRevision !== SHARED_TOTALS_REVISION) {
      for (const key of SHARED_COST_KEYS) result[key] = defaults[key];
    }
    if (saved && saved.auction === undefined) result.auction = result.price;
    if (bid && saved?.bidSource !== sourceTag(bid)) {
      result.budget = bid.budget;
      result.price = bid.price;
      result.auction = bid.auction;
    }
    result.jobs = result.price > 0 ? result.budget / result.price / 12 : 0;
    return result;
  } catch {
    const result = {
      ...defaults,
      ...(bid && {
        budget: bid.budget,
        price: bid.price,
        auction: bid.auction,
      }),
    };
    result.jobs = result.price > 0 ? result.budget / result.price / 12 : 0;
    return result;
  }
}

export default function NoticeCalculator({
  onDirtyChange,
  siteId,
  siteName,
  bid,
}: {
  onDirtyChange: (dirty: boolean) => void;
  siteId: string;
  siteName: string;
  bid: BidSource;
}) {
  const storageKey = KEY + ':site:' + siteId;
  const [values, setValues] = useState(() => load(storageKey, bid));
  const [hasLegacy] = useState(() => {
    try {
      return cloudStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  });
  const [calculated, setCalculated] = useState(values);
  const [dirty, setDirty] = useState(false);
  const [needsCalculation, setNeedsCalculation] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [storageError, setStorageError] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      // Reset only the five confirmed totals once, across all notice-site records.
      const noticeKeys = storageKeys().filter(
        (key) => key === KEY || key.startsWith(KEY + ':site:'),
      );
      for (const key of noticeKeys) {
        const record = JSON.parse(cloudStorage.getItem(key) || 'null');
        if (
          !record ||
          typeof record !== 'object' ||
          Array.isArray(record) ||
          record.sharedTotalsRevision === SHARED_TOTALS_REVISION
        )
          continue;
        const corrected = {
          ...record,
          sharedTotalsRevision: SHARED_TOTALS_REVISION,
        };
        for (const field of SHARED_COST_KEYS)
          corrected[field] = defaults[field];
        cloudStorage.setItem(key, JSON.stringify(corrected), true);
      }
      const saved = JSON.parse(cloudStorage.getItem(storageKey) || 'null');
      if (saved?.bidSource !== sourceTag(bid)) {
        cloudStorage.setItem(
          storageKey,
          JSON.stringify({
            ...load(storageKey, bid),
            bidSource: sourceTag(bid),
            sharedTotalsRevision: SHARED_TOTALS_REVISION,
          }),
          true,
        );
      }
    } catch {
      setStorageError(true);
    }
  }, [storageKey, bid]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const edit = (key: keyof Values, text: string) => {
    setDraft((previous) => ({ ...previous, [key]: text }));
    setDirty(true);
    setNeedsCalculation(true);
    setMessage('');
    if (
      text.trim() !== '' &&
      Number.isFinite(Number(text)) &&
      Number(text) >= 0
    ) {
      setValues((previous) => {
        const next = { ...previous, [key]: Number(text) };
        next.jobs = next.price > 0 ? next.budget / next.price / 12 : 0;
        return next;
      });
    }
  };
  const input = (
    key: keyof Values,
    label: string,
    integer = false,
    editTotal = false,
  ) => (
    <label className="field" key={key}>
      {SHARED_COST_KEYS.includes(key) && !editTotal
        ? label.replace('รวมทุกไซด์', 'เฉพาะไซด์นี้')
        : label}
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        readOnly={
          key === 'jobs' || (SHARED_COST_KEYS.includes(key) && !editTotal)
        }
        aria-readonly={
          key === 'jobs' || (SHARED_COST_KEYS.includes(key) && !editTotal)
        }
        value={
          SHARED_COST_KEYS.includes(key) && !editTotal
            ? values.price > 0 && draft.price !== '' && draft.budget !== ''
              ? allocateSharedCost(values[key], values.jobs).toFixed(2)
              : ''
            : key === 'jobs'
              ? values.price > 0 && draft.price !== '' && draft.budget !== ''
                ? String(values.jobs)
                : ''
              : (draft[key] ?? String(values[key]))
        }
        onChange={(event) => edit(key, event.target.value)}
      />
      {key === 'jobs' && (
        <small>งบประมาณ ÷ ราคากลาง ÷ 12 โดยไม่ปัดเศษจำนวนรายเฉลี่ย</small>
      )}
    </label>
  );
  const invalid =
    Object.values(draft).some(
      (value) =>
        value.trim() === '' ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0,
    ) ||
    values.capacity <= 0 ||
    values.price <= 0 ||
    !Number.isFinite(values.jobs) ||
    !Number.isInteger(values.capacity) ||
    !Number.isInteger(values.supervisors) ||
    !Number.isInteger(values.qcPeople) ||
    values.withholding > 100 ||
    values.ssoRate > 100 ||
    values.ssoMin > values.ssoCap;
  const workers =
    calculated.capacity > 0
      ? Math.ceil(calculated.jobs / calculated.capacity)
      : 0;
  const paperCount = Math.ceil(calculated.jobs * (1 + calculated.waste / 100));
  const labor = calculated.jobs * calculated.labor;
  const allocationRatio = calculated.jobs / ALLOCATION_JOBS;
  const supervisorCost = allocateSharedCost(
    calculated.supervisorTotal,
    calculated.jobs,
  );
  const qcCost = allocateSharedCost(calculated.qcTotal, calculated.jobs);
  const documentsCost = allocateSharedCost(
    calculated.documents,
    calculated.jobs,
  );
  const staffCost = allocateSharedCost(calculated.staff, calculated.jobs);
  const hospitalityCost = allocateSharedCost(
    calculated.hospitality,
    calculated.jobs,
  );
  const totalSso =
    calculated.supervisors > 0
      ? (calculated.supervisors *
          Math.min(
            calculated.ssoCap,
            Math.max(
              calculated.ssoMin,
              calculated.supervisorTotal / calculated.supervisors,
            ),
          ) *
          calculated.ssoRate) /
        100
      : 0;
  const sso = totalSso * allocationRatio;
  const recurring =
    labor +
    supervisorCost +
    sso +
    qcCost +
    paperCount * calculated.paper +
    documentsCost +
    staffCost +
    hospitalityCost;
  const startup = workers * (calculated.printer + calculated.shirt);
  const revenue = calculated.jobs * calculated.auction;
  const tax = ((labor + qcCost) * calculated.withholding) / 100;
  const rows: [string, number][] = [
    ['ค่าแรงส่งใบแจ้งเตือน (ยอดเต็ม)', labor],
    ['เงินเดือนผู้คุมงานเฉลี่ยตามไซด์', supervisorCost],
    ['ประกันสังคมส่วนนายจ้าง', sso],
    ['ค่า QC เฉลี่ยตามไซด์ (ก่อนหักภาษี)', qcCost],
    ['กระดาษรวมเผื่อเสีย', paperCount * calculated.paper],
    ['ค่าเอกสารเฉลี่ยตามไซด์', documentsCost],
    ['ค่าใช้จ่ายสตาฟเฉลี่ยตามไซด์', staffCost],
    ['ค่ารับรองเฉลี่ยตามไซด์', hospitalityCost],
  ];
  const reportRef = useRef<HTMLDivElement>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const exportReport = async (mode: 'print' | 'pdf') => {
    if (invalid || needsCalculation || reportBusy || !reportRef.current) return;
    setReportBusy(true);
    setReportError('');
    let printFrame: HTMLIFrameElement | null = null;
    try {
      await document.fonts.ready;
      const filename =
        'รายงานใบแจ้งเตือน-' +
        siteName +
        '-' +
        new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
      if (mode === 'pdf') {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);
        // Render an isolated document rather than cloning the full calculator.
        printFrame = document.createElement('iframe');
        printFrame.title = 'กำลังสร้าง PDF ' + siteName;
        printFrame.style.cssText =
          'position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0';
        document.body.appendChild(printFrame);
        const exportDoc = printFrame.contentDocument;
        if (!exportDoc) throw new Error('PDF document unavailable');
        exportDoc.open();
        exportDoc.write(
          '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:white;width:794px}*{box-sizing:border-box}</style></head><body>' +
            reportRef.current.innerHTML +
            '</body></html>',
        );
        exportDoc.close();
        await exportDoc.fonts.ready;
        const exportArticle = exportDoc.querySelector('article');
        if (!exportArticle) throw new Error('PDF report unavailable');
        const canvas = await html2canvas(exportArticle, {
          scale: 1.5,
          backgroundColor: '#ffffff',
          logging: false,
          width: 794,
          height: Math.min(exportArticle.scrollHeight, 2000),
          windowWidth: 794,
          windowHeight: 1200,
          scrollX: 0,
          scrollY: 0,
        });
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        const scale = Math.min(190 / canvas.width, 277 / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.94),
          'JPEG',
          (210 - width) / 2,
          10,
          width,
          height,
        );
        pdf.setProperties({ title: 'รายงานต้นทุนและกำไร ' + siteName });
        pdf.save(filename + '.pdf');
        printFrame.remove();
        printFrame = null;
        canvas.width = 0;
        canvas.height = 0;
        setMessage('ส่งออก PDF ของไซด์ ' + siteName + ' แล้ว');
      } else {
        printFrame = document.createElement('iframe');
        printFrame.title = 'รายงานสำหรับพิมพ์ ' + siteName;
        printFrame.style.cssText =
          'position:fixed;left:-10000px;top:0;width:900px;height:1200px;border:0';
        document.body.appendChild(printFrame);
        const doc = printFrame.contentDocument;
        if (!doc) throw new Error('print frame unavailable');
        doc.open();
        doc.write(
          '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>' +
            filename +
            '</title><style>@page{size:A4 portrait;margin:8mm}body{margin:0;background:#fff}article{width:100%!important;min-height:0!important;padding:8px!important}table{break-inside:avoid}tr{break-inside:avoid}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' +
            reportRef.current.innerHTML +
            '</body></html>',
        );
        doc.close();
        await doc.fonts.ready;
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        const frame = printFrame;
        setTimeout(() => frame.remove(), 60000);
      }
    } catch {
      printFrame?.remove();
      setReportError(
        'ไม่สามารถสร้างรายงานได้ กรุณาลองอีกครั้ง หรือใช้ปุ่มพิมพ์เพื่อบันทึกเป็น PDF',
      );
    } finally {
      setReportBusy(false);
    }
  };

  const save = (): boolean => {
    if (invalid) return false;
    try {
      cloudStorage.setItem(
        storageKey,
        JSON.stringify({
          ...values,
          bidSource: sourceTag(bid),
          sharedTotalsRevision: SHARED_TOTALS_REVISION,
        }),
      );
      setCalculated({ ...values });
      setNeedsCalculation(false);
      setDirty(false);
      onDirtyChange(false);
      setMessage('ส่งข้อมูลใบแจ้งเตือนไปบันทึกแล้ว — ตรวจสถานะฐานข้อมูลด้านบน');
      setStorageError(false);
      void flush().catch(() => {});
      return true;
    } catch {
      setStorageError(true);
      return false;
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    setUnsaved('notice', dirty ? () => saveRef.current() : null);
    return () => setUnsaved('notice', null);
  }, [dirty]);
  return (
    <div className="max-w-6xl mx-auto mt-6 space-y-6">
      <header className="noticeHeader">
        <div className="noticeToolbar">
          <span className="noticeBrand">DIVERGENT CORPORATION</span>
          <div className="noticeReportActions">
            <button
              type="button"
              disabled={invalid || needsCalculation || reportBusy}
              onClick={() => void exportReport('print')}
              className="noticeOutline"
            >
              <Printer size={17} />
              พิมพ์
            </button>
            <button
              type="button"
              disabled={invalid || needsCalculation || reportBusy}
              onClick={() => void exportReport('pdf')}
              className="noticePrimary"
            >
              <Download size={17} />
              {reportBusy ? 'กำลังสร้างรายงาน…' : 'ส่งออก PDF'}
            </button>
          </div>
        </div>
        <p className="text-sm font-bold text-sky-700">ใบแจ้งเตือนค่าไฟฟ้า</p>
        <h1 className="text-3xl font-bold mt-1">ไซด์{siteName}</h1>
        {needsCalculation && (
          <p className="text-amber-800 text-sm mt-3">
            กรุณากดคำนวณก่อนพิมพ์หรือส่งออก PDF เพื่อใช้ค่าล่าสุด
          </p>
        )}
        {reportError && (
          <p role="alert" className="text-red-700 text-sm mt-3">
            {reportError}
          </p>
        )}
        <p className="text-sm text-slate-500 mt-2">
          บันทึกข้อมูลแยกเฉพาะไซด์ {siteName} • งบประมาณ {fmt(bid.budget)} บาท
          และราคากลาง {bid.price} บาท/ราย จากตารางประมูลแจ้งเตือน
          คำนวณจำนวนรายจากงบประมาณกับราคากลาง
        </p>
        {hasLegacy && (
          <button
            type="button"
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            onClick={() => {
              if (
                !window.confirm(
                  'นำเข้าข้อมูลใบแจ้งเตือนที่บันทึกไว้ก่อนแยกไซด์ มาแทนค่าที่กำลังกรอกของ ' +
                    siteName +
                    ' หรือไม่? ข้อมูลเดิมยังคงอยู่ และต้องกดบันทึกเพื่อเก็บลงไซด์นี้',
                )
              )
                return;
              const imported = load(KEY);
              setValues({
                ...imported,
                budget: bid.budget,
                price: bid.price,
                auction: bid.auction,
                jobs: bid.budget / bid.price / 12,
              });
              setDraft({});
              setDirty(true);
              setNeedsCalculation(true);
              setMessage(
                'นำเข้าต้นทุนเดิมแล้ว โดยใช้งบประมาณจากตารางประมูลแจ้งเตือน กรุณาคำนวณและบันทึกลงไซด์ ' +
                  siteName,
              );
            }}
          >
            นำเข้าข้อมูลที่บันทึกก่อนแยกไซด์
          </button>
        )}
        <p className="text-slate-500 mt-2">
          คำนวณต้นทุนและกำไร • ฐาน 1 รอบงานต่อเดือน •
          จำนวนคนปัดขึ้นเป็นจำนวนเต็ม
        </p>
        <p className="text-sm text-slate-500 mt-2">
          ใช้ราคาตามที่กรอก ยังไม่บวกหรือแยก VAT และภาษีเงินได้นิติบุคคล
          เครื่องพิมพ์และเสื้อคิดเป็นค่าเริ่มต้นครั้งเดียว
        </p>
      </header>
      {dirty && (
        <div
          role="alert"
          className="sticky top-0 z-20 rounded-xl border border-amber-400 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <span>
            มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก กรุณากดบันทึกข้อมูล
            {needsCalculation ? ' และคำนวณใหม่' : ''}
          </span>
          <button
            type="button"
            disabled={invalid}
            onClick={() => save()}
            className="rounded-lg bg-sky-700 text-white px-4 py-2 disabled:opacity-50"
          >
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      )}
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 space-y-3">
        <h2 className="font-bold">งบประมาณและจำนวนราย</h2>
        {input('budget', 'งบประมาณตลอดสัญญา 12 เดือน (บาท)')}
        <p className="text-sm text-slate-600">
          จำนวนรายต่อเดือน = งบประมาณ ÷ ราคากลาง ÷ 12
          รายรับและกำไรยังคำนวณจากราคาที่ประมูล
        </p>
      </section>
      <div className="grid lg:grid-cols-2 gap-5">
        {groups.map((group) => (
          <section
            key={group.title}
            className="bg-white border border-slate-200 rounded-2xl p-5"
          >
            <h2 className="font-bold mb-4">{group.title}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {group.fields.map(([key, label, step]) => (
                <div
                  key={key}
                  className={
                    key === 'budget' || key === 'price' || key === 'auction'
                      ? 'sm:col-span-2'
                      : ''
                  }
                >
                  {input(key, label, step === 1)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          ตั้งค่ายอดรวมสำหรับเฉลี่ยต้นทุน (ฐาน 200,000 ราย)
        </summary>
        <p className="text-sm text-slate-500 my-3">
          ช่องต้นทุนด้านบนแสดงยอดเฉพาะไซด์นี้อัตโนมัติ
          หากต้องการเปลี่ยนฐานยอดรวม ให้แก้ที่นี่แล้วคำนวณและบันทึก
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {input(
            'supervisorTotal',
            'เงินเดือนผู้คุมงานรวม (บาท/เดือน)',
            false,
            true,
          )}
          {input('qcTotal', 'ค่า QC รวม (บาท/เดือน)', false, true)}
          {input('staff', 'ค่าใช้จ่ายสตาฟรวม (บาท/เดือน)', false, true)}
          {input('documents', 'ค่าเอกสารรวม (บาท/เดือน)', false, true)}
          {input('hospitality', 'ค่ารับรองรวม (บาท/เดือน)', false, true)}
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={invalid}
          onClick={() => {
            setCalculated({ ...values });
            setNeedsCalculation(false);
            setMessage('คำนวณแล้ว กรุณาบันทึกหากมีการแก้ไขข้อมูล');
          }}
          className="rounded-xl bg-slate-900 text-white px-6 py-3 disabled:opacity-50"
        >
          คำนวณ
        </button>
        <button
          type="button"
          disabled={invalid}
          onClick={() => {
            setCalculated({ ...values });
            setNeedsCalculation(false);
            setShowContract(true);
            setMessage(
              'คำนวณกำไรตลอดสัญญา 12 เดือนแล้ว กรุณาบันทึกหากมีการแก้ไขข้อมูล',
            );
          }}
          className="rounded-xl bg-emerald-700 text-white px-6 py-3 disabled:opacity-50"
        >
          คำนวณกำไรตลอดสัญญา 12 เดือน
        </button>
        <span className="text-sm text-slate-500">
          รายรับและกำไรใช้ราคาที่ประมูล ราคากลางใช้เปรียบเทียบ
        </span>
        {values.auction > values.price && (
          <span role="alert" className="text-amber-800">
            ราคาที่ประมูลสูงกว่าราคากลาง
          </span>
        )}
      </div>
      {needsCalculation && (
        <p className="text-amber-800">
          ผลด้านล่างเป็นการคำนวณครั้งล่าสุด กดคำนวณเพื่อใช้ค่าที่แก้ไข
        </p>
      )}
      {invalid && (
        <p
          role="alert"
          className="bg-amber-50 border border-amber-300 p-4 rounded-xl"
        >
          กรุณากรอกตัวเลขตั้งแต่ 0 ขึ้นไป
          จำนวนคนและกำลังงานต่อคนต้องเป็นจำนวนเต็ม
          กำลังงานต่อคนและราคากลางต้องมากกว่า 0 อัตราภาษี/เงินสมทบไม่เกิน 100%
          และฐานขั้นต่ำต้องไม่เกินฐานสูงสุด ผลที่แสดงเป็นค่าคำนวณครั้งล่าสุด
        </p>
      )}
      {
        <>
          <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[
              [
                'พนักงานส่งใบแจ้งเตือน',
                workers.toLocaleString('th-TH') + ' คน',
              ],
              ['รายรับ/เดือน', fmt(revenue)],
              ['ต้นทุนประจำ/เดือน', fmt(recurring)],
              ['กำไรดำเนินงาน/เดือน', fmt(revenue - recurring)],
              [
                'กำไรตลอดสัญญา 12 เดือน',
                fmt((revenue - recurring) * 12 - startup),
              ],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </section>
          {showContract && (
            <section
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
              aria-label="สรุปสัญญา 12 เดือน"
            >
              <h2 className="text-xl font-bold">
                กำไรตลอดสัญญา 12 เดือน — {siteName}
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                ใช้ปริมาณงาน ราคาที่ประมูล และต้นทุนต่อเดือนเท่ากันตลอด 12 เดือน
                หักเครื่องพิมพ์และเสื้อเริ่มต้นครั้งเดียว
                ยังไม่หักภาษีเงินได้นิติบุคคล
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {[
                  ['รายรับรวม 12 เดือน', revenue * 12],
                  ['ต้นทุนประจำรวม 12 เดือน', recurring * 12],
                  ['ค่าเริ่มต้นครั้งเดียว', startup],
                  [
                    'กำไรตลอดสัญญา หลังหักค่าเริ่มต้น',
                    (revenue - recurring) * 12 - startup,
                  ],
                ].map(([label, amount]) => (
                  <div className="metric" key={String(label)}>
                    <span>{label}</span>
                    <b>{fmt(Number(amount))} บาท</b>
                  </div>
                ))}
              </div>
              <p className="text-sm mt-3">
                ต้นทุนตลอดสัญญารวมค่าเริ่มต้น {fmt(recurring * 12 + startup)}{' '}
                บาท
              </p>
              {needsCalculation && (
                <p className="text-amber-800 mt-2">
                  สรุปนี้เป็นค่าคำนวณครั้งล่าสุด
                  กรุณากดคำนวณใหม่เพื่อใช้ค่าที่แก้ไข
                </p>
              )}
            </section>
          )}
          <section className="bg-white border rounded-2xl p-5 overflow-x-auto">
            <h2 className="font-bold mb-4">รายละเอียดต้นทุน (บาท)</h2>
            <div className="rounded-xl bg-sky-50 p-4 mb-4 text-sm space-y-2">
              <p>
                เงินเดือนผู้คุมงาน, QC, ค่าใช้จ่ายสตาฟ, ค่าเอกสาร และค่ารับรอง:
                ยอดรวมทุกไซด์ ÷ {ALLOCATION_JOBS.toLocaleString('th-TH')} ×
                จำนวนรายต่อเดือนของไซด์
              </p>
              <p>
                ฐานรวม {ALLOCATION_JOBS.toLocaleString('th-TH')} ราย • ไซด์นี้{' '}
                {calculated.jobs.toLocaleString('th-TH')} ราย • สัดส่วน{' '}
                {(allocationRatio * 100).toFixed(4)}%
              </p>
              <p>
                เงินสมทบนายจ้างคำนวณจากเงินเดือนผู้คุมงานรวมก่อน
                แล้วเฉลี่ยตามสัดส่วนเดียวกัน ช่องทั้ง 5
                รายการแสดงยอดเฉลี่ยเฉพาะไซด์นี้
                ยอดรวมแก้ได้ในหัวข้อตั้งค่ายอดรวม
              </p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th>ต้นทุน/ค่าตั้งต้นของไซด์นี้ (บาท)</th>
                  <th>ต้นทุนไซด์นี้/เดือน (คำนวณล่าสุด)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, amount], index) => {
                  const fields: Field[][] = [
                    [['labor', 'ค่าแรง (บาท/ราย)']],
                    [
                      ['supervisorTotal', 'เงินเดือนรวมทุกไซด์ (บาท/เดือน)'],
                      ['supervisors', 'ผู้คุมงาน (คน)', 1],
                    ],
                    [
                      ['ssoRate', 'สมทบนายจ้าง (%)'],
                      ['ssoMin', 'ฐานขั้นต่ำ (บาท)'],
                      ['ssoCap', 'ฐานสูงสุด (บาท)'],
                    ],
                    [
                      ['qcTotal', 'QC รวมทุกไซด์ (บาท/เดือน)'],
                      ['qcPeople', 'QC (คน)', 1],
                    ],
                    [
                      ['paper', 'กระดาษ (บาท/ฉบับ)'],
                      ['waste', 'เผื่อเสีย (%)'],
                    ],
                    [['documents', 'เอกสารรวมทุกไซด์ (บาท/เดือน)']],
                    [['staff', 'สตาฟรวมทุกไซด์ (บาท/เดือน)']],
                    [['hospitality', 'รับรองรวมทุกไซด์ (บาท/เดือน)']],
                  ];
                  const sharedKey = fields[index].find(([key]) =>
                    SHARED_COST_KEYS.includes(key),
                  )?.[0];
                  return (
                    <tr key={label}>
                      <td>
                        {label}
                        {sharedKey && (
                          <small className="block text-slate-500 mt-1">
                            {fmt(calculated[sharedKey])} ÷{' '}
                            {ALLOCATION_JOBS.toLocaleString('th-TH')} ×{' '}
                            {fmt(calculated.jobs)} = {fmt(amount)} บาท/เดือน
                          </small>
                        )}
                      </td>
                      <td>
                        <div className="min-w-[160px] space-y-2">
                          {fields[index].map(([key, name, step]) =>
                            input(key, name, step === 1),
                          )}
                        </div>
                      </td>
                      <td>{fmt(amount)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td colSpan={2}>รวมต้นทุนประจำ</td>
                  <td>{fmt(recurring)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>ต้นทุนประจำเฉลี่ย/ราย</td>
                  <td>
                    {calculated.jobs > 0
                      ? fmt(recurring / calculated.jobs)
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td>เครื่องพิมพ์ {workers} เครื่อง (เริ่มต้น)</td>
                  <td>{input('printer', 'เครื่องพิมพ์ (บาท/เครื่อง)')}</td>
                  <td>{fmt(workers * calculated.printer)}</td>
                </tr>
                <tr>
                  <td>เสื้อ {workers} ตัว (เริ่มต้น)</td>
                  <td>{input('shirt', 'เสื้อ (บาท/ตัว)')}</td>
                  <td>{fmt(workers * calculated.shirt)}</td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={2}>ค่าเริ่มต้นรวม</td>
                  <td>{fmt(startup)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>ต้นทุนเดือนแรก รวมค่าเริ่มต้น</td>
                  <td>{fmt(recurring + startup)}</td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={2}>คงเหลือเดือนแรก หลังหักค่าเริ่มต้น</td>
                  <td>{fmt(revenue - recurring - startup)}</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section className="bg-sky-50 border border-sky-200 rounded-2xl p-5 space-y-2 text-sm">
            <h2 className="font-bold">ยอดจ่ายและภาษีหัก ณ ที่จ่าย</h2>
            <p>
              ค่าแรง: ยอดเต็ม {fmt(labor)} • หัก{' '}
              {fmt((labor * calculated.withholding) / 100)} • จ่ายสุทธิ{' '}
              {fmt(labor * (1 - calculated.withholding / 100))} บาท
            </p>
            <p>
              QC รวม {calculated.qcPeople} คน: ยอดที่เฉลี่ยให้ไซด์นี้{' '}
              {fmt(qcCost)} • หัก {fmt((qcCost * calculated.withholding) / 100)}{' '}
              • จ่ายสุทธิ {fmt(qcCost * (1 - calculated.withholding / 100))} บาท
            </p>
            <p>
              ภาษีหักไว้เพื่อนำส่งรวม {fmt(tax)} บาท รวมอยู่ในต้นทุนยอดเต็มแล้ว
              ไม่หักออกจากต้นทุนหรือบวกซ้ำ
            </p>
            <p>
              กระดาษ {paperCount.toLocaleString('th-TH')} ฉบับ = จำนวนราย × (1 +
              เผื่อเสีย {calculated.waste}%) ปัดขึ้น
            </p>
            <p>
              ผู้คุมงานใช้เงินเดือนเฉลี่ยเท่ากัน{' '}
              {calculated.supervisors > 0
                ? fmt(calculated.supervisorTotal / calculated.supervisors)
                : '—'}{' '}
              บาท/คน เงินสมทบคำนวณรายคนตามฐานขั้นต่ำ/สูงสุด
              ส่วนลูกจ้างหักจากเงินเดือน ไม่บวกต้นทุนซ้ำ
            </p>
            <a
              className="underline"
              href="https://songkhla.prd.go.th/th/content/category/detail/id/33/iid/477946"
              target="_blank"
              rel="noreferrer"
            >
              อ้างอิงเพดานประกันสังคมปี 2569–2571: 17,500 บาท สมทบสูงสุด 875
              บาท/คน/ฝ่าย/เดือน
            </a>
          </section>
        </>
      }
      <div className="noticePreviewControl">
        <button
          type="button"
          className="noticeOutline"
          onClick={() => setPreviewOpen((open) => !open)}
          aria-expanded={previewOpen}
        >
          <Eye size={17} />
          {previewOpen ? 'ซ่อนตัวอย่างรายงาน' : 'ดูตัวอย่างรายงาน A4'}
        </button>
        <span className="text-xs text-slate-500">
          รายงานใช้ผลคำนวณล่าสุดของไซด์ {siteName}
        </span>
      </div>
      <div
        className={
          previewOpen ? 'noticeReportPreview' : 'noticeReportOffscreen'
        }
        data-notice-report
        ref={reportRef}
        aria-hidden={!previewOpen}
      >
        <NoticeReport
          site={siteName}
          budget={calculated.budget}
          jobs={calculated.jobs}
          price={calculated.price}
          auction={calculated.auction}
          workers={workers}
          revenue={revenue}
          recurring={recurring}
          startup={startup}
          printer={workers * calculated.printer}
          shirts={workers * calculated.shirt}
          tax={tax}
          unsaved={dirty}
          rows={rows}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <button
          type="button"
          disabled={invalid}
          onClick={() => save()}
          className="bg-sky-700 text-white rounded-xl px-5 py-3 disabled:opacity-50"
        >
          บันทึกข้อมูลใบแจ้งเตือน
        </button>
        <p className="text-sm text-slate-500">
          กดบันทึกเพื่อเก็บค่าทั้งหมดของไซด์ {siteName} ในเบราว์เซอร์นี้
          แยกจากไซด์อื่นและโปรเจกต์จดหน่วย
        </p>
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
        {storageError && (
          <p role="alert" className="text-red-700">
            บันทึกไม่สำเร็จ เบราว์เซอร์ไม่อนุญาตให้เก็บข้อมูล
            กรุณาเปิดสิทธิ์พื้นที่จัดเก็บ
          </p>
        )}
      </div>
    </div>
  );
}
