import { cloudStorage, flush } from "./cloud";

// ต้นทุนคงที่และต้นทุนเฉลี่ย of the notice project, set once for every site in the ตั้งค่าต้นทุน menu.
// Each site's calculator and the P&L summary read them from here instead of the site's own record.
// The key fits the system-cost-api allowlist (epc:electricity-notice:v1:site:<id>).
export const COST_SETTINGS_KEY = "epc:electricity-notice:v1:site:cost-settings";

export const COST_DEFAULTS = {
  // ต้นทุนคงที่: monthly totals for all won sites, split by each site's share of the jobs
  supervisors: 4,
  supervisorTotal: 90000,
  qcPeople: 3,
  qcTotal: 9000,
  staff: 50000,
  documents: 350,
  hospitality: 350,
  ssoRate: 5,
  ssoMin: 1650,
  ssoCap: 17500,
  // ต้นทุนเฉลี่ย: per job / per sheet / per worker, the same at every site
  labor: 3.5,
  paper: 0.24,
  waste: 2,
  capacity: 2500,
  withholding: 3,
  printer: 0, // we already own about 200 printers
  shirt: 450,
};
export type CostSettings = typeof COST_DEFAULTS;
export type CostKey = keyof CostSettings;
export const COST_KEYS = Object.keys(COST_DEFAULTS) as CostKey[];

// [key, label, integer]
export type CostField = [CostKey, string, boolean?];
export const FIXED_FIELDS: CostField[] = [
  ["supervisorTotal", "เงินเดือนผู้คุมงานรวม (บาท/เดือน)"],
  ["supervisors", "ผู้คุมงาน (คน)", true],
  ["qcTotal", "ค่า QC รวม (บาท/เดือน)"],
  ["qcPeople", "QC (คน)", true],
  ["staff", "ค่าใช้จ่ายสตาฟรวม (บาท/เดือน)"],
  ["documents", "ค่าเอกสารรวม (บาท/เดือน)"],
  ["hospitality", "ค่ารับรองรวม (บาท/เดือน)"],
];
export const SSO_FIELDS: CostField[] = [
  ["ssoRate", "อัตราสมทบ (%)"],
  ["ssoMin", "ฐานค่าจ้างขั้นต่ำ (บาท/คน)"],
  ["ssoCap", "ฐานค่าจ้างสูงสุด (บาท/คน)"],
];
export const AVERAGE_FIELDS: CostField[] = [
  ["labor", "ค่าแรงส่งใบแจ้งเตือน (บาท/ราย)"],
  ["paper", "กระดาษ (บาท/ฉบับ)"],
  ["waste", "กระดาษเผื่อเสียเพิ่ม (%)"],
  ["capacity", "กำลังงานเฉลี่ย (ราย/คน/เดือน)", true],
  ["withholding", "หัก ณ ที่จ่าย ค่าแรงและ QC (%)"],
  ["printer", "เครื่องพิมพ์ 1 เครื่อง/คน (บาท, ค่าเริ่มต้น)"],
  ["shirt", "เสื้อ 1 ตัว/คน (บาท, ค่าเริ่มต้น)"],
];

export function loadCostSettings(): CostSettings {
  const result = { ...COST_DEFAULTS };
  try {
    const saved = JSON.parse(cloudStorage.getItem(COST_SETTINGS_KEY) || "null");
    if (saved && typeof saved === "object") {
      for (const key of COST_KEYS) {
        const value = saved[key];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0)
          result[key] = value;
      }
    }
  } catch {
    /* Use the defaults. */
  }
  return result;
}

// Why the values cannot be saved, or '' when they can.
export function costSettingsError(v: CostSettings) {
  if (COST_KEYS.some((key) => !Number.isFinite(v[key]) || v[key] < 0))
    return "กรุณากรอกตัวเลขตั้งแต่ 0 ขึ้นไป";
  if (
    [...FIXED_FIELDS, ...AVERAGE_FIELDS].some(
      ([key, , integer]) => integer && !Number.isInteger(v[key]),
    )
  )
    return "จำนวนคนและกำลังงานต่อคนต้องเป็นจำนวนเต็ม";
  if (v.capacity <= 0) return "กำลังงานต่อคนต้องมากกว่า 0";
  if (v.withholding > 100 || v.ssoRate > 100)
    return "อัตราภาษี/เงินสมทบต้องไม่เกิน 100%";
  if (v.ssoMin > v.ssoCap) return "ฐานขั้นต่ำต้องไม่เกินฐานสูงสุด";
  return "";
}

export async function saveCostSettings(v: CostSettings) {
  const record: Record<string, number | string> = {};
  for (const key of COST_KEYS) record[key] = v[key];
  record.updatedAt = new Date().toISOString();
  cloudStorage.setItem(COST_SETTINGS_KEY, JSON.stringify(record));
  await flush();
}

// The employer's social security on the supervisors' salaries, for all sites per month.
export function ssoTotal(v: CostSettings) {
  return v.supervisors > 0
    ? (v.supervisors *
        Math.min(
          v.ssoCap,
          Math.max(v.ssoMin, v.supervisorTotal / v.supervisors),
        ) *
        v.ssoRate) /
        100
    : 0;
}

// ต้นทุนคงที่ทั้งหมดต่อเดือน (รวมประกันสังคมส่วนนายจ้าง)
export const fixedTotal = (v: CostSettings) =>
  v.supervisorTotal +
  v.qcTotal +
  v.staff +
  v.documents +
  v.hospitality +
  ssoTotal(v);
