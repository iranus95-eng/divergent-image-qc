import {
  computeNotice,
  loadNoticeValues,
  noticeStorageKey,
  shareOf,
  type Allocation,
} from './NoticeCalculator';
import type { Site } from './NoticeSites';

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

// Rough profit and loss of the won sites, each costed with its own saved inputs.
export default function NoticeSummary({
  sites,
  incomplete,
  noQuote,
  quoteError,
  allocationFor,
  onOpen,
}: {
  sites: Site[];
  incomplete: { name: string; missing: string }[];
  noQuote: string[];
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
  return (
    <div className="max-w-6xl mx-auto mt-6 space-y-6">
      <header className="noticeHeader">
        <p className="text-sm font-bold text-sky-700">ใบแจ้งเตือนค่าไฟฟ้า</p>
        <h1 className="text-3xl font-bold mt-1">
          สรุปกำไรขาดทุน ไซด์ที่ชนะประมูล
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          คิด {sites.length} ไซด์ • รายรับ = จำนวนราย/เดือน × ราคาต่อหน่วยที่ชนะ
          (จากใบเสนอราคา ถ้าไม่มีใช้ราคาปี70 ในตารางประมูล) •
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
      {(incomplete.length > 0 || noQuote.length > 0 || quoteError) && (
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
