import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { setUnsaved } from "./cloud";
import {
  AVERAGE_FIELDS,
  COST_DEFAULTS,
  FIXED_FIELDS,
  SSO_FIELDS,
  costSettingsError,
  fixedTotal,
  loadCostSettings,
  saveCostSettings,
  ssoTotal,
  type CostField,
  type CostSettings as Settings,
} from "./costSettings";

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

// ตั้งค่าต้นทุน: the fixed and average costs every notice site and the P&L summary use.
export default function CostSettings({
  poolJobs,
  sites,
  onDirtyChange,
  onSaved,
}: {
  poolJobs: number; // ราย/เดือน of all won sites that can be costed
  sites: number;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState(loadCostSettings);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    toDraft(saved),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const values = Object.fromEntries(
    Object.entries(draft).map(([key, text]) => [
      key,
      text.trim() === "" ? NaN : Number(text),
    ]),
  ) as Settings;
  const dirty = Object.entries(draft).some(
    ([key, text]) =>
      Number(text) !== saved[key as keyof Settings] || text.trim() === "",
  );
  const error = costSettingsError(values);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  const save = async () => {
    if (error) return false;
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await saveCostSettings(values);
      setSaved({ ...values });
      setDraft(toDraft(values));
      setMessage("บันทึกตั้งค่าต้นทุนแล้ว ทุกไซด์และสรุปกำไรขาดทุนใช้ค่าใหม่");
      onSaved();
      return true;
    } catch (e) {
      setFailure(
        "บันทึกไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    setUnsaved("cost-settings", dirty ? () => saveRef.current() : null);
    return () => setUnsaved("cost-settings", null);
  }, [dirty]);

  const field = ([key, label, integer]: CostField) => (
    <label className="field" key={key}>
      {label}
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={draft[key]}
        onChange={(event) => {
          setDraft((previous) => ({ ...previous, [key]: event.target.value }));
          setMessage("");
        }}
      />
      {Number(draft[key]) !== COST_DEFAULTS[key] && (
        <small className="font-normal text-slate-500">
          ค่าเดิมของระบบ {COST_DEFAULTS[key].toLocaleString("th-TH")}
        </small>
      )}
    </label>
  );
  const ok = !error;
  const fixed = ok ? fixedTotal(values) : 0;
  const variable = ok
    ? values.labor + values.paper * (1 + values.waste / 100)
    : 0;
  return (
    <div
      className="mx-auto mt-6 space-y-6 max-w-6xl"
      aria-label="ตั้งค่าต้นทุน"
    >
      <header className="noticeHeader">
        <span className="noticeBrand">DIVERGENT CORPORATION</span>
        <p className="text-sm font-bold text-sky-700 mt-3">
          ใบแจ้งเตือนค่าไฟฟ้า
        </p>
        <h1 className="text-3xl font-bold mt-1">
          ตั้งค่าต้นทุนคงที่และต้นทุนเฉลี่ย
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          ค่าที่ตั้งไว้ที่นี่ใช้กับทุกไซด์ที่ชนะประมูลและหน้าสรุปกำไรขาดทุน
          ต้นทุนคงที่เป็นยอดรวมทุกไซด์ต่อเดือน
          แล้วเฉลี่ยให้แต่ละไซด์ตามสัดส่วนจำนวนราย
        </p>
      </header>
      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          [
            "ต้นทุนคงที่รวม/เดือน (รวมประกันสังคม)",
            ok ? fmt(fixed) + " บาท" : "—",
          ],
          [
            "ต้นทุนคงที่เฉลี่ยต่อราย",
            ok && poolJobs > 0 ? fmt(fixed / poolJobs) + " บาท" : "—",
          ],
          [
            "ต้นทุนผันแปรต่อราย (ค่าแรง + กระดาษเผื่อเสีย)",
            ok ? fmt(variable) + " บาท" : "—",
          ],
          [
            "ต้นทุนรวมเฉลี่ยต่อราย",
            ok && poolJobs > 0
              ? fmt(variable + fixed / poolJobs) + " บาท"
              : "—",
          ],
        ].map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </section>
      <p className="text-sm text-slate-500">
        คิดจาก {sites} ไซด์ที่ชนะประมูล รวม {fmt(poolJobs, 0)} ราย/เดือน
        ยังไม่รวมค่าเริ่มต้น (เครื่องพิมพ์ เสื้อ) VAT และภาษีเงินได้นิติบุคคล
      </p>
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold">ต้นทุนคงที่ (รวมทุกไซด์ ต่อเดือน)</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            เฉลี่ยให้แต่ละไซด์ตามสัดส่วนจำนวนรายของไซด์ที่ชนะประมูล
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {FIXED_FIELDS.map(field)}
          </div>
          <h3 className="font-bold mt-6 mb-1">
            ประกันสังคมผู้คุมงาน — ส่วนนายจ้าง
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {ok
              ? "คิดได้ " +
                fmt(ssoTotal(values)) +
                " บาท/เดือน รวมอยู่ในต้นทุนคงที่"
              : "คำนวณจากเงินเดือนผู้คุมงานรวม"}
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {SSO_FIELDS.map(field)}
          </div>
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-bold">ต้นทุนเฉลี่ย (ต่อราย / ต่อคน)</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            ใช้อัตราเดียวกันทุกไซด์ คูณกับจำนวนรายหรือจำนวนพนักงานของแต่ละไซด์
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {AVERAGE_FIELDS.map(field)}
          </div>
        </section>
      </div>
      {error && (
        <p
          role="alert"
          className="bg-amber-50 border border-amber-300 p-4 rounded-xl"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <button
          type="button"
          disabled={!dirty || !!error || busy}
          onClick={() => void save()}
          className="noticePrimary"
        >
          <Save size={17} />
          {busy ? "กำลังบันทึก…" : "บันทึกตั้งค่าต้นทุน"}
        </button>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => {
            setDraft(toDraft(saved));
            setMessage("");
          }}
          className="noticeOutline"
        >
          ยกเลิกการแก้ไข
        </button>
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
        {failure && (
          <p role="alert" className="text-red-700">
            {failure}
          </p>
        )}
      </div>
    </div>
  );
}

function toDraft(v: Settings) {
  return Object.fromEntries(
    Object.entries(v).map(([key, value]) => [key, String(value)]),
  ) as Record<string, string>;
}
