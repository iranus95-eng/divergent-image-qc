import type { CSSProperties } from 'react';

type Props = {
  site: string;
  budget: number;
  jobs: number;
  price: number;
  auction: number;
  workers: number;
  revenue: number;
  recurring: number;
  startup: number;
  printer: number;
  shirts: number;
  tax: number;
  unsaved: boolean;
  rows: [string, number][];
};
const money = (value: number) =>
  value.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const cell: CSSProperties = {
  padding: '7px 10px',
  borderBottom: '1px solid #ede9fe',
  fontSize: 13,
  textAlign: 'left',
};
export default function NoticeReport(props: Props) {
  const row = (label: string, value: number, strong = false) => (
    <tr
      key={label}
      style={{
        background: strong ? '#f1ebff' : '#fff',
        fontWeight: strong ? 700 : 400,
      }}
    >
      <td style={cell}>{label}</td>
      <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {money(value)}
      </td>
    </tr>
  );
  const heading = (text: string) => (
    <h2 style={{ fontSize: 16, margin: '20px 0 8px', color: '#4c1d95' }}>
      {text}
    </h2>
  );
  return (
    <article
      style={{
        boxSizing: 'border-box',
        width: 794,
        minHeight: 1123,
        padding: 38,
        background: '#fff',
        color: '#23153c',
        fontFamily: "'Noto Sans Thai', Tahoma, Arial, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '3px solid #7c3aed',
          paddingBottom: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <b style={{ letterSpacing: 1, fontSize: 14, color: '#5b21b6' }}>
            DIVERGENT CORPORATION
          </b>
          <h1 style={{ fontSize: 26, margin: '8px 0 2px' }}>
            รายงานต้นทุนและกำไร
          </h1>
          <p style={{ margin: 0, fontSize: 16 }}>
            ใบแจ้งเตือนค่าไฟฟ้า — {props.site}
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11 }}>
          {new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
          <br />
          {props.unsaved
            ? 'คำนวณแล้ว / ยังไม่ได้บันทึก'
            : 'ข้อมูลที่บันทึกแล้ว'}
        </div>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: 14,
          background: '#f7f3ff',
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        <div>
          งบประมาณ 12 เดือน: <b>{money(props.budget)}</b> บาท
        </div>
        <div>
          ราคากลาง: <b>{money(props.price)}</b> บาท/ราย
        </div>
        <div>
          จำนวนราย/เดือน: <b>{money(props.jobs)}</b>
        </div>
        <div>
          ราคาที่ประมูล: <b>{money(props.auction)}</b> บาท/ราย
        </div>
        <div>
          พนักงานส่งใบแจ้งเตือน: <b>{props.workers}</b> คน
        </div>
        <div>
          ระยะเวลาสัญญา: <b>12 เดือน</b>
        </div>
      </div>
      {heading('สรุปรายเดือน (บาท)')}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {row('รายรับต่อเดือน', props.revenue)}
          {row('ต้นทุนประจำต่อเดือน', props.recurring)}
          {row('กำไรดำเนินงานต่อเดือน', props.revenue - props.recurring, true)}
        </tbody>
      </table>
      {heading('สรุปตลอดสัญญา 12 เดือน (บาท)')}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {row('รายรับรวม 12 เดือน', props.revenue * 12)}
          {row('ต้นทุนประจำรวม 12 เดือน', props.recurring * 12)}
          {row('ค่าเริ่มต้นครั้งเดียว (เครื่องพิมพ์และเสื้อ)', props.startup)}
          {row(
            'กำไรตลอดสัญญาหลังหักค่าเริ่มต้น',
            (props.revenue - props.recurring) * 12 - props.startup,
            true,
          )}
        </tbody>
      </table>
      {heading('รายละเอียดต้นทุนเฉพาะไซด์ (บาท/เดือน)')}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {props.rows.map(([label, value]) => row(label, value))}
          {row('รวมต้นทุนประจำ', props.recurring, true)}
        </tbody>
      </table>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          paddingTop: 12,
        }}
      >
        <span>เครื่องพิมพ์เริ่มต้น {money(props.printer)} บาท</span>
        <span>เสื้อเริ่มต้น {money(props.shirts)} บาท</span>
        <span>ภาษีหักไว้เพื่อนำส่ง/เดือน {money(props.tax)} บาท</span>
      </div>
      <p style={{ fontSize: 11, color: '#6b5b80', margin: '15px 0' }}>
        ค่าใช้จ่ายส่วนกลางเฉลี่ยจากยอดรวม ÷ 200,000 × จำนวนรายต่อเดือนของไซด์
        ภาษีหัก ณ ที่จ่ายรวมอยู่ในต้นทุนยอดเต็มแล้ว ใช้ปริมาณงานและต้นทุนคงที่
        12 เดือน ค่าเริ่มต้นหักครั้งเดียว ยังไม่บวกหรือแยก VAT
        และภาษีเงินได้นิติบุคคล
      </p>
      <footer
        style={{
          borderTop: '1px solid #ddd6fe',
          paddingTop: 10,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#7c6597',
        }}
      >
        <span>Executive Profit Calculator • {props.site}</span>
        <span>รายงานสัญญา 12 เดือน</span>
      </footer>
    </article>
  );
}
