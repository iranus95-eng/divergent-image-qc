import { useEffect, useMemo, useState } from 'react';
import { api, cloudStorage } from './cloud';
import {
  Calculator,
  Save,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  FileText,
  Gavel,
  Workflow,
  ShieldAlert,
  Landmark,
  ClipboardCheck,
  NotebookPen,
  Printer,
} from 'lucide-react';

type Cost = { label: string; value: number; kind?: 'laborRate' };
type Scenario = {
  id: string;
  name: string;
  areas: { kantharalak: number; siRattana: number; nonKhun: number };
  rate: number;
  costs: Cost[];
  createdAt: string;
};
type BidSnapshot = {
  meters: Meter[];
  specialNoPrint: number;
  operating: Cost[];
  monthlyBuys: BuyCost[];
  equipment: BuyCost[];
};
type MenuKey =
  | 'original'
  | 'bid'
  | 'prasat'
  | 'phayak'
  | 'phutthaisong'
  | 'mahasarakham'
  | 'work'
  | 'qc'
  | 'risk'
  | 'capital'
  | 'requirements'
  | 'notes';
type Meter = {
  key: string;
  label: string;
  count: number;
  ceiling: number;
  bid: number;
};
type BuyCost = { label: string; value: number };
type SiteConfig = {
  key: MenuKey;
  name: string;
  total: number;
  rotary: number;
  electronic: number;
  tou: number;
  ami: number;
  budget: number;
  days: number;
  workers: number;
  total36: number;
};
const VAT = 0.07;
const initialCosts: Cost[] = [
  { label: 'ค่าแรง', value: 299138 },
  { label: 'กระดาษพิมพ์บิล', value: 33000 },
  { label: 'QC', value: 32000 },
  { label: 'Staff', value: 12000 },
  { label: 'ค่าใช้จ่าย Staff', value: 10000 },
  { label: 'สำนักงาน', value: 6000 },
  { label: 'โทรศัพท์', value: 6000 },
  { label: 'ค่าใช้จ่ายอื่น', value: 28400 },
];
const defaultOperatingCosts: Cost[] = [
  { label: 'ค่าแรง/ราย (บาท)', value: 3.5, kind: 'laborRate' },
  { label: 'QC/เดือน', value: 0 },
  { label: 'Staff/เดือน', value: 0 },
  { label: 'ค่าเช่าสำนักงาน/เดือน', value: 0 },
  { label: 'ค่าน้ำ/เดือน', value: 0 },
  { label: 'ค่าอินเทอร์เน็ต/เดือน', value: 0 },
  { label: 'เงินสดย่อย/เดือน', value: 2000 },
  { label: 'ค่าปรับ/เดือน', value: 0 },
  { label: 'ค่าเดินทาง/น้ำมัน/เดือน', value: 0 },
  { label: 'ค่าใช้จ่ายดำเนินงานอื่น/เดือน', value: 0 },
];
const createDefaultOperatingCosts = () =>
  defaultOperatingCosts.map((c) => ({ ...c }));
const normalizeOperatingRows = (rows: Cost[]) => {
  const normalized = rows.map((c) => ({
    label: String(c.label ?? ''),
    value: Number(c.value || 0),
    ...(c.kind === 'laborRate' ? { kind: 'laborRate' as const } : {}),
  }));
  return normalized.some((c) => c.kind === 'laborRate')
    ? normalized
    : [
        { label: 'ค่าแรง/ราย (บาท)', value: 3.5, kind: 'laborRate' as const },
        ...normalized,
      ];
};
const phayakRoutes = [
  {
    branch: 'พยัคฆภูมิพิสัย',
    groups: '201+801 – 207+807',
    groupCount: 7,
    routes: 174,
    customers: 25476,
    days: 10,
    devices: 17,
  },
  {
    branch: 'นาเชือก',
    groups: '231+831 – 235+835',
    groupCount: 5,
    routes: 275,
    customers: 41545,
    days: 10,
    devices: 17,
  },
  {
    branch: 'ยางสีสุราช',
    groups: '241+841 – 245+845',
    groupCount: 5,
    routes: 369,
    customers: 53754,
    days: 10,
    devices: 17,
  },
];
const phayakDaily = [
  ['A1', '16/7/2569', 2780],
  ['A2', '17/7/2569', 2657],
  ['A3', '18/7/2569', 2426],
  ['A4', '19/7/2569', 2666],
  ['B1', '20/7/2569', 2584],
  ['B2', '21/7/2569', 2666],
  ['B3', '22/7/2569', 2475],
  ['B4', '23/7/2569', 2366],
  ['C1', '24/7/2569', 2234],
  ['C2', '25/7/2569', 2622],
] as const;
const fmt = (v: number) =>
  new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(v || 0);
const money = (v: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(v || 0);
const siteConfigs: SiteConfig[] = [
  {
    key: 'bid',
    name: 'จตุรัส',
    total: 45645,
    rotary: 40690,
    electronic: 4718,
    tou: 237,
    ami: 0,
    budget: 299423.36,
    days: 10,
    workers: 11,
    total36: 10779240.96,
  },
  {
    key: 'prasat',
    name: 'ปราสาท',
    total: 71688,
    rotary: 61322,
    electronic: 9991,
    tou: 375,
    ami: 0,
    budget: 468521.92,
    days: 10,
    workers: 21,
    total36: 16866789.12,
  },
  {
    key: 'phayak',
    name: 'พยัคฆภูมิพิสัย',
    total: 53754,
    rotary: 46919,
    electronic: 6571,
    tou: 264,
    ami: 0,
    budget: 351839.32,
    days: 10,
    workers: 17,
    total36: 12666215.52,
  },
  {
    key: 'phutthaisong',
    name: 'พุทไธสง',
    total: 33457,
    rotary: 29281,
    electronic: 4049,
    tou: 127,
    ami: 0,
    budget: 218799.48,
    days: 10,
    workers: 10,
    total36: 7876781.28,
  },
  {
    key: 'mahasarakham',
    name: 'มหาชนะชัย',
    total: 26026,
    rotary: 23014,
    electronic: 2841,
    tou: 171,
    ami: 0,
    budget: 170831.52,
    days: 10,
    workers: 7,
    total36: 6149934.72,
  },
];
const buildSiteMeters = (s: SiteConfig): Meter[] => [
  {
    key: 'rotary',
    label: 'มิเตอร์จานหมุน',
    count: s.rotary,
    ceiling: 6.6,
    bid: 6.6,
  },
  {
    key: 'electronic',
    label: 'มิเตอร์อิเล็กทรอนิกส์ (Bluetooth)',
    count: s.electronic,
    ceiling: 5.92,
    bid: 5.92,
  },
  { key: 'tou', label: 'มิเตอร์ TOU', count: s.tou, ceiling: 12.4, bid: 12.4 },
  { key: 'ami', label: 'มิเตอร์ AMI', count: s.ami, ceiling: 4.6, bid: 4.6 },
];
const readSavedMeters = (s: SiteConfig): Meter[] => {
  const base = buildSiteMeters(s);
  if (typeof window === 'undefined') return base;
  try {
    const direct = cloudStorage.getItem('site-bid-prices-' + s.key);
    const draft = cloudStorage.getItem('site-bid-draft-' + s.key);
    const saved = direct
      ? (JSON.parse(direct) as Meter[])
      : draft
        ? (JSON.parse(draft) as Partial<BidSnapshot>).meters
        : undefined;
    if (Array.isArray(saved)) {
      return base.map((m) => {
        const old = saved.find((x) => x.key === m.key);
        return old ? { ...m, bid: Number(old.bid ?? m.bid) } : m;
      });
    }
  } catch {}
  return base;
};
const readSavedOperating = (key: MenuKey): Cost[] => {
  if (typeof window === 'undefined') return createDefaultOperatingCosts();
  try {
    const direct = cloudStorage.getItem('site-operating-' + key);
    if (direct) {
      const rows = JSON.parse(direct) as Cost[];
      if (Array.isArray(rows)) return normalizeOperatingRows(rows);
    }
    const oldDraft = cloudStorage.getItem('site-bid-draft-' + key);
    if (oldDraft) {
      const parsed = JSON.parse(oldDraft) as Partial<BidSnapshot>;
      if (Array.isArray(parsed.operating))
        return normalizeOperatingRows(parsed.operating);
    }
  } catch {}
  return createDefaultOperatingCosts();
};
const defaultMonthlyBuys: BuyCost[] = [
  { label: 'กระดาษ/แบบฟอร์ม (ก่อน VAT)', value: 0 },
  { label: 'วัสดุสิ้นเปลืองอื่น (ก่อน VAT)', value: 0 },
];
const defaultEquipment: BuyCost[] = [
  { label: 'Smartphone (ก่อน VAT)', value: 0 },
  { label: 'เครื่องพิมพ์พกพา (ก่อน VAT)', value: 0 },
  { label: 'Clip-on ammeter (ก่อน VAT)', value: 0 },
  { label: 'ชุด/อุปกรณ์เริ่มงาน (ก่อน VAT)', value: 0 },
];
const cloneBuyCosts = (rows: BuyCost[]) =>
  rows.map((x) => ({
    ...x,
    label: String(x.label ?? ''),
    value: Number(x.value || 0),
  }));
const readSavedMonthlyBuys = (key: MenuKey): BuyCost[] => {
  if (typeof window === 'undefined') return cloneBuyCosts(defaultMonthlyBuys);
  try {
    const direct = cloudStorage.getItem('site-monthly-buys-' + key);
    if (direct) {
      const rows = JSON.parse(direct) as BuyCost[];
      if (Array.isArray(rows)) return cloneBuyCosts(rows);
    }
    const oldDraft = cloudStorage.getItem('site-bid-draft-' + key);
    if (oldDraft) {
      const parsed = JSON.parse(oldDraft) as Partial<BidSnapshot>;
      if (Array.isArray(parsed.monthlyBuys))
        return cloneBuyCosts(parsed.monthlyBuys);
    }
  } catch {}
  return cloneBuyCosts(defaultMonthlyBuys);
};
const readSavedEquipment = (key: MenuKey): BuyCost[] => {
  if (typeof window === 'undefined') return cloneBuyCosts(defaultEquipment);
  try {
    const direct = cloudStorage.getItem('site-equipment-' + key);
    if (direct) {
      const rows = JSON.parse(direct) as BuyCost[];
      if (Array.isArray(rows)) return cloneBuyCosts(rows);
    }
    const oldDraft = cloudStorage.getItem('site-bid-draft-' + key);
    if (oldDraft) {
      const parsed = JSON.parse(oldDraft) as Partial<BidSnapshot>;
      if (Array.isArray(parsed.equipment))
        return cloneBuyCosts(parsed.equipment);
    }
  } catch {}
  return cloneBuyCosts(defaultEquipment);
};
const siteMenus: [MenuKey, string][] = siteConfigs.map((s) => [s.key, s.name]);
const menus: [MenuKey, string, string, typeof FileText][] = [
  ['original', 'ต้นฉบับ', 'โครงคำนวณชุดแรก', FileText],
  ['work', 'การทำงาน', 'ขั้นตอนและภาระงาน', Workflow],
  ['qc', 'QC / รหัสผิดปกติ', 'ตรวจหน่วยและแก้ไข', ClipboardCheck],
  ['risk', 'ความเสี่ยง', 'ค่าปรับและจุดควบคุม', ShieldAlert],
  ['capital', 'หลักประกัน/เงินทุน', 'เงินที่ต้องเตรียม', Landmark],
  ['requirements', 'ข้อกำหนด', 'คุณสมบัติและอุปกรณ์', ClipboardCheck],
  ['notes', 'บันทึกเพิ่มเติม', 'ประเด็นรอตรวจสอบ', NotebookPen],
];
function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className="font-bold text-slate-900 mb-3">{title}</h3>
      <div className="text-sm leading-7 text-slate-600">{children}</div>
    </div>
  );
}
function DecimalInput({
  value,
  onCommit,
  className = 'cell text-right',
  ariaLabel,
}: {
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const commit = () => {
    const normalized = draft.replace(',', '.').trim();
    const parsed = normalized === '' ? 0 : Number(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onCommit(parsed);
      setDraft(String(parsed));
    } else {
      setDraft(String(value));
    }
  };
  return (
    <input
      aria-label={ariaLabel}
      className={className}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        if (/^\d*(?:[.,]\d*)?$/.test(v)) setDraft(v);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
function App() {
  const [menu, setMenu] = useState<MenuKey>('original');
  const [areas, setAreas] = useState({
    kantharalak: 74800,
    siRattana: 19038,
    nonKhun: 12997,
  });
  const [rate, setRate] = useState(5.5);
  const [costs, setCosts] = useState<Cost[]>(initialCosts);
  const [name, setName] = useState('กันทรลักษณ์ 69');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [meters, setMeters] = useState<Meter[]>(() =>
    readSavedMeters(siteConfigs[0]),
  );
  const [specialNoPrint, setSpecialNoPrint] = useState(0);
  const [calculated, setCalculated] = useState<BidSnapshot | null>(null);
  const [calcSite, setCalcSite] = useState<MenuKey>('bid');
  const [bidMessage, setBidMessage] = useState(
    'กรอกข้อมูลแล้วกด คำนวณ เพื่ออัปเดตผลลัพธ์',
  );
  const equipmentReserve = 0.05;
  const paperWaste = 0.05;
  const [operatingBySite, setOperatingBySite] = useState<
    Record<string, Cost[]>
  >(() =>
    Object.fromEntries(
      siteConfigs.map((s) => [s.key, readSavedOperating(s.key)]),
    ),
  );
  const operating = operatingBySite[calcSite] ?? createDefaultOperatingCosts();
  const setOperating: React.Dispatch<React.SetStateAction<Cost[]>> = (next) =>
    setOperatingBySite((prev) => {
      const current = prev[calcSite] ?? createDefaultOperatingCosts();
      const value =
        typeof next === 'function'
          ? (next as (items: Cost[]) => Cost[])(current)
          : next;
      return { ...prev, [calcSite]: value };
    });
  const [monthlyBuysBySite, setMonthlyBuysBySite] = useState<
    Record<string, BuyCost[]>
  >(() =>
    Object.fromEntries(
      siteConfigs.map((s) => [s.key, readSavedMonthlyBuys(s.key)]),
    ),
  );
  const monthlyBuys =
    monthlyBuysBySite[calcSite] ?? cloneBuyCosts(defaultMonthlyBuys);
  const setMonthlyBuys: React.Dispatch<React.SetStateAction<BuyCost[]>> = (
    next,
  ) =>
    setMonthlyBuysBySite((prev) => {
      const current = prev[calcSite] ?? cloneBuyCosts(defaultMonthlyBuys);
      const value =
        typeof next === 'function'
          ? (next as (items: BuyCost[]) => BuyCost[])(current)
          : next;
      return { ...prev, [calcSite]: value };
    });
  const [equipmentBySite, setEquipmentBySite] = useState<
    Record<string, BuyCost[]>
  >(() =>
    Object.fromEntries(
      siteConfigs.map((s) => [s.key, readSavedEquipment(s.key)]),
    ),
  );
  const equipment =
    equipmentBySite[calcSite] ?? cloneBuyCosts(defaultEquipment);
  const setEquipment: React.Dispatch<React.SetStateAction<BuyCost[]>> = (
    next,
  ) =>
    setEquipmentBySite((prev) => {
      const current = prev[calcSite] ?? cloneBuyCosts(defaultEquipment);
      const value =
        typeof next === 'function'
          ? (next as (items: BuyCost[]) => BuyCost[])(current)
          : next;
      return { ...prev, [calcSite]: value };
    });
  const load = async () => {
    try {
      const r = await api.get('/api/scenarios');
      setScenarios((r.data.items ?? []) as Scenario[]);
    } catch {
      setMessage('โหลดรายการที่บันทึกไม่สำเร็จ');
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    siteConfigs.forEach((s) => {
      const rows = operatingBySite[s.key];
      if (rows)
        cloudStorage.setItem('site-operating-' + s.key, JSON.stringify(rows));
    });
  }, [operatingBySite]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    siteConfigs.forEach((s) => {
      const rows = monthlyBuysBySite[s.key];
      if (rows)
        cloudStorage.setItem(
          'site-monthly-buys-' + s.key,
          JSON.stringify(rows),
        );
    });
  }, [monthlyBuysBySite]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    siteConfigs.forEach((s) => {
      const rows = equipmentBySite[s.key];
      if (rows)
        cloudStorage.setItem('site-equipment-' + s.key, JSON.stringify(rows));
    });
  }, [equipmentBySite]);
  const calcConfig =
    siteConfigs.find((s) => s.key === calcSite) ?? siteConfigs[0];
  useEffect(() => {
    const s = siteConfigs.find((x) => x.key === menu);
    if (!s) return;
    setCalcSite(s.key);
    setMeters(readSavedMeters(s));
    setSpecialNoPrint(0);
    setCalculated(null);
    setBidMessage('กรอกข้อมูลแล้วกด คำนวณ เพื่ออัปเดตผลลัพธ์');
  }, [menu]);
  const totalJobs = areas.kantharalak + areas.siRattana + areas.nonKhun;
  const totalCost = useMemo(
    () => costs.reduce((s, c) => s + Number(c.value || 0), 0),
    [costs],
  );
  const revenue = totalJobs * rate;
  const profit = revenue - totalCost;
  const costPerJob = totalJobs ? totalCost / totalJobs : 0;
  const profitPerJob = totalJobs ? profit / totalJobs : 0;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const comparisons = [5.5, 5.4, 5.3, 5.2, 5.1, 5, 4.95, 4.9].map((r) => ({
    rate: r,
    revenue: totalJobs * r,
    profit: totalJobs * r - totalCost,
  }));
  const activeMeters = calculated?.meters ?? meters;
  const activeSpecialNoPrint = calculated?.specialNoPrint ?? 0;
  const activeOperating = calculated?.operating ?? operating;
  const activeMonthlyBuys = calculated?.monthlyBuys ?? monthlyBuys;
  const activeEquipment = calculated?.equipment ?? equipment;
  const currentLaborIndex = operating.findIndex((c) => c.kind === 'laborRate');
  const currentLaborRate =
    currentLaborIndex >= 0 ? operating[currentLaborIndex].value : 3.5;
  const currentLaborCost =
    meters.reduce((s, m) => s + m.count, 0) * currentLaborRate;
  const bidRevenue = activeMeters.reduce((s, m) => s + m.count * m.bid, 0);
  const ceilingRevenue = meters.reduce((s, m) => s + m.count * m.ceiling, 0);
  const specialRevenue = activeSpecialNoPrint * 0.4;
  const laborIndex = activeOperating.findIndex((c) => c.kind === 'laborRate');
  const laborRate = laborIndex >= 0 ? activeOperating[laborIndex].value : 0;
  const laborCost = activeMeters.reduce((s, m) => s + m.count, 0) * laborRate;
  const monthlyOperating =
    activeOperating.reduce(
      (s, c, i) => s + (i === laborIndex ? 0 : c.value),
      0,
    ) + laborCost;
  const paperUnitPrice = activeMonthlyBuys[0]?.value ?? 0;
  const paperQuantity = Math.ceil(
    activeMeters.reduce((s, m) => s + m.count, 0) * (1 + paperWaste),
  );
  const paperPreVat = paperUnitPrice * paperQuantity;
  const otherMonthlyBuyPreVat = activeMonthlyBuys
    .slice(1)
    .reduce((s, c) => s + c.value, 0);
  const monthlyBuyPreVat = paperPreVat + otherMonthlyBuyPreVat;
  const monthlyBuyVat = monthlyBuyPreVat * VAT;
  const monthlyBuyGross = monthlyBuyPreVat + monthlyBuyVat;
  const siteWorkers = calcConfig.workers;
  const equipmentBasePreVat = activeEquipment.reduce(
    (s, c) => s + c.value * siteWorkers,
    0,
  );
  const reservedQty = Math.ceil(siteWorkers * (1 + equipmentReserve));
  const equipmentReservedPreVat = activeEquipment.reduce(
    (s, c) =>
      s +
      c.value *
        (c.label.toLowerCase().includes('clip') ? siteWorkers : reservedQty),
    0,
  );
  const equipmentReserveCost = equipmentReservedPreVat - equipmentBasePreVat;
  const equipmentVat = equipmentReservedPreVat * VAT;
  const equipmentGross = equipmentReservedPreVat + equipmentVat;
  const equipmentMonthly = equipmentGross / 36;
  const monthlyBidIncome = bidRevenue + specialRevenue;
  const monthlyBidCost = monthlyOperating + monthlyBuyGross + equipmentMonthly;
  const activeTotalMeters = activeMeters.reduce((s, m) => s + m.count, 0);
  const averageCostPerCustomer = activeTotalMeters
    ? monthlyBidCost / activeTotalMeters
    : 0;
  const monthlyBidProfit = monthlyBidIncome - monthlyBidCost;
  const bidMargin = monthlyBidIncome
    ? (monthlyBidProfit / monthlyBidIncome) * 100
    : 0;
  const total36Income = monthlyBidIncome * 36;
  const total36Cost =
    monthlyOperating * 36 + monthlyBuyGross * 36 + equipmentGross;
  const total36Profit = total36Income - total36Cost;
  const totalMeters = meters.reduce((s, m) => s + m.count, 0);
  const bidGuarantee = totalMeters;
  const contractGuarantee = totalMeters * 20;
  const overCeiling = meters.some((m) => m.bid > m.ceiling);
  const calculateBid = () => {
    if (overCeiling) {
      setBidMessage('ยังคำนวณไม่ได้: มีราคาที่เสนอสูงกว่าราคากลาง');
      return;
    }
    setCalculated({
      meters: meters.map((x) => ({ ...x })),
      specialNoPrint,
      operating: operating.map((x) => ({ ...x })),
      monthlyBuys: monthlyBuys.map((x) => ({ ...x })),
      equipment: equipment.map((x) => ({ ...x })),
    });
    setBidMessage('คำนวณล่าสุดเรียบร้อยแล้ว');
  };
  const saveBid = () => {
    if (!calculated) {
      setBidMessage('กรุณากด คำนวณ ก่อนบันทึก');
      return;
    }
    const snapshot = {
      ...calculated,
      monthlyBuys: monthlyBuys.map((x) => ({ ...x })),
      equipment: equipment.map((x) => ({ ...x })),
    };
    cloudStorage.setItem(
      'site-bid-draft-' + calcSite,
      JSON.stringify(snapshot),
    );
    cloudStorage.setItem(
      'site-monthly-buys-' + calcSite,
      JSON.stringify(snapshot.monthlyBuys),
    );
    cloudStorage.setItem(
      'site-equipment-' + calcSite,
      JSON.stringify(snapshot.equipment),
    );
    setBidMessage('บันทึกชุดคำนวณ' + calcConfig.name + 'ไว้แล้ว');
  };
  const saveScenario = async () => {
    if (!name.trim()) {
      setMessage('กรุณาตั้งชื่อชุดคำนวณ');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (editingId) {
        await api.put('/api/scenarios/' + editingId, {
          name,
          areas,
          rate,
          costs,
        });
        setMessage('อัปเดตชุดคำนวณแล้ว');
      } else {
        const r = await api.post('/api/scenarios', {
          name,
          areas,
          rate,
          costs,
        });
        setEditingId(r.data.id);
        setMessage('บันทึกชุดคำนวณแล้ว');
      }
      await load();
    } catch {
      setMessage(editingId ? 'อัปเดตไม่สำเร็จ' : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!confirm('ลบชุดคำนวณนี้หรือไม่?')) return;
    try {
      await api.delete('/api/scenarios/' + id);
      if (editingId === id) setEditingId(null);
      await load();
    } catch {
      setMessage('ลบไม่สำเร็จ');
    }
  };
  const openScenario = (s: Scenario) => {
    setEditingId(s.id);
    setName(s.name);
    setAreas(s.areas);
    setRate(s.rate);
    setCosts(s.costs);
    setMenu('original');
    setMessage('กำลังแก้ไขชุด: ' + s.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const changeBidPrice = (i: number, value: number) =>
    setMeters((p) => {
      const next = p.map((x, j) => (j === i ? { ...x, bid: value } : x));
      if (typeof window !== 'undefined')
        cloudStorage.setItem(
          'site-bid-prices-' + calcSite,
          JSON.stringify(next),
        );
      return next;
    });
  const changeCost = (i: number, field: 'label' | 'value', value: string) =>
    setCosts((p) =>
      p.map((c, x) =>
        x === i
          ? { ...c, [field]: field === 'value' ? Number(value) : value }
          : c,
      ),
    );
  const changeList = (
    setter: React.Dispatch<React.SetStateAction<Cost[]>>,
    i: number,
    field: 'label' | 'value',
    value: string,
  ) =>
    setter((p) =>
      p.map((c, x) =>
        x === i
          ? { ...c, [field]: field === 'value' ? Number(value) : value }
          : c,
      ),
    );
  const siteLabel = siteMenus.find((x) => x[0] === menu)?.[1];
  const menuLabel = siteLabel ?? menus.find((x) => x[0] === menu)?.[1] ?? '';
  const printSite = siteLabel
    ? 'ไซด์งาน' + siteLabel + ' ครั้งที่ 1/2569'
    : 'Executive Profit & Bid Center';
  const printReport = () => window.print();
  const Original = () => (
    <>
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div className="font-bold text-amber-900">
          ต้นฉบับ — เก็บโครงสร้างชุดแรกไว้เหมือนเดิม
        </div>
        <p className="text-sm text-amber-800 mt-1">
          ใช้เป็นฐานอ้างอิงและไม่ถูกแทนที่ด้วยหน้าจำลองเสนอราคา
        </p>
      </section>
      {message && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {message}
        </div>
      )}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <Calculator size={20} />
            <h2 className="font-bold">ข้อมูลชุดคำนวณ</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <label className="field">
              ชื่อชุดคำนวณ
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              ค่าตอบแทน / ราย (บาท)
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="field">
              กันทรลักษณ์
              <input
                type="number"
                value={areas.kantharalak}
                onChange={(e) =>
                  setAreas({ ...areas, kantharalak: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              ศรีรัตนะ
              <input
                type="number"
                value={areas.siRattana}
                onChange={(e) =>
                  setAreas({ ...areas, siRattana: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              โนนคูณ
              <input
                type="number"
                value={areas.nonKhun}
                onChange={(e) =>
                  setAreas({ ...areas, nonKhun: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 flex justify-between">
            <span className="text-sm text-slate-500">จำนวนงานรวม</span>
            <strong>{fmt(totalJobs)} ราย</strong>
          </div>
        </div>
        <div
          className={
            'rounded-2xl p-5 text-white shadow-sm ' +
            (profit >= 0 ? 'bg-emerald-600' : 'bg-rose-600')
          }
        >
          <div className="flex items-center gap-2 text-sm opacity-90">
            {profit >= 0 ? (
              <TrendingUp size={18} />
            ) : (
              <TrendingDown size={18} />
            )}{' '}
            ผลลัพธ์สุทธิ
          </div>
          <div className="text-3xl font-bold mt-3">{money(profit)}</div>
          <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
            <div className="metricDark">
              <span>Margin</span>
              <b>{margin.toFixed(2)}%</b>
            </div>
            <div className="metricDark">
              <span>กำไร/ราย</span>
              <b>{money(profitPerJob)}</b>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={saveScenario}
            className="mt-5 w-full bg-white text-slate-900 rounded-xl px-4 py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {busy
              ? 'กำลังบันทึก...'
              : editingId
                ? 'อัปเดตชุดคำนวณ'
                : 'บันทึกชุดคำนวณ'}
          </button>
        </div>
      </section>
      <section className="grid md:grid-cols-4 gap-4">
        <div className="metric">
          <span>รายได้</span>
          <b>{money(revenue)}</b>
        </div>
        <div className="metric">
          <span>ต้นทุนรวม</span>
          <b>{money(totalCost)}</b>
        </div>
        <div className="metric">
          <span>ต้นทุน/ราย</span>
          <b>{money(costPerJob)}</b>
        </div>
        <div className="metric">
          <span>จุดคุ้มทุน</span>
          <b>{costPerJob.toFixed(2)} บาท/ราย</b>
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-6">
        <InfoCard title="รายการต้นทุน">
          <div className="space-y-2">
            {costs.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_150px] gap-2">
                <input
                  className="cell"
                  value={c.label}
                  onChange={(e) => changeCost(i, 'label', e.target.value)}
                />
                <input
                  className="cell text-right"
                  type="number"
                  value={c.value}
                  onChange={(e) => changeCost(i, 'value', e.target.value)}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setCosts([...costs, { label: 'รายการใหม่', value: 0 }])
            }
            className="mt-3 text-sm font-semibold text-sky-700"
          >
            + เพิ่มรายการต้นทุน
          </button>
        </InfoCard>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-bold">ตารางเปรียบเทียบค่าตอบแทน</h2>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>บาท/ราย</th>
                  <th>รายได้</th>
                  <th>กำไร/ขาดทุน</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((x) => (
                  <tr key={x.rate}>
                    <td>{x.rate.toFixed(2)}</td>
                    <td>{money(x.revenue)}</td>
                    <td
                      className={
                        x.profit >= 0
                          ? 'text-emerald-700 font-semibold'
                          : 'text-rose-700 font-semibold'
                      }
                    >
                      {money(x.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b flex justify-between">
          <div>
            <h2 className="font-bold">ชุดคำนวณที่บันทึกไว้</h2>
            <p className="text-sm text-slate-500">ฐานข้อมูลแยกของเว็บนี้</p>
          </div>
          <button onClick={load}>
            <RefreshCw size={18} />
          </button>
        </div>
        {scenarios.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            ยังไม่มีชุดคำนวณที่บันทึก
          </div>
        ) : (
          <div className="divide-y">
            {scenarios.map((s) => (
              <div key={s.id} className="p-4 flex justify-between">
                <button onClick={() => openScenario(s)} className="text-left">
                  <b>{s.name}</b>
                  <div className="text-xs text-slate-500">
                    {fmt(
                      s.areas.kantharalak + s.areas.siRattana + s.areas.nonKhun,
                    )}{' '}
                    ราย • {s.rate.toFixed(2)} บาท/ราย
                  </div>
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
  const Phayak = () => (
    <>
      {Bid()}
      <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5">
        <div className="text-xs font-bold text-fuchsia-700">
          รายละเอียดเอกสารและแผนจดหน่วย
        </div>
        <h3 className="text-xl font-bold text-fuchsia-950 mt-1">
          พยัคฆภูมิพิสัย ครั้งที่ 1/2569
        </h3>
        <p className="text-sm text-fuchsia-800 mt-1">
          ประกาศ ฉ.2 กฟฟ.(ตบ)2715/2569 • กฟภ.2 • ยืนยันเสนอค่าตอบแทน 2 ต.ค. 2569
          เวลา 09:00–12:00
        </p>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <InfoCard title="จำนวนมิเตอร์">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>จำนวน/เดือน</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>มิเตอร์จานหมุน</td>
                  <td>{fmt(46919)}</td>
                </tr>
                <tr>
                  <td>มิเตอร์อิเล็กทรอนิกส์</td>
                  <td>{fmt(6571)}</td>
                </tr>
                <tr>
                  <td>มิเตอร์ TOU</td>
                  <td>{fmt(264)}</td>
                </tr>
                <tr>
                  <td>มิเตอร์ AMI</td>
                  <td>0</td>
                </tr>
                <tr>
                  <td>
                    <b>รวม</b>
                  </td>
                  <td>
                    <b>{fmt(53754)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </InfoCard>
        <InfoCard title="ข้อมูลประกาศ">
          <ul>
            <li>วงเงินประมาณการ 36 รอบ {money(12666215.52)} ไม่รวม VAT</li>
            <li>เริ่มยื่นเอกสาร 14 ก.ย. 2569 เวลา 09:00 น.</li>
            <li>สิ้นสุดยื่นเอกสาร 25 ก.ย. 2569 เวลา 16:30 น.</li>
            <li>วันยืนยันเสนอค่าตอบแทน 2 ต.ค. 2569</li>
            <li>ช่วงเวลายืนยัน 09:00–12:00</li>
          </ul>
        </InfoCard>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <InfoCard title="ราคากลางแยกประเภทที่ได้รับเพิ่ม">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>ราคากลาง</th>
                  <th>วงเงิน/เดือน</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>จานหมุน 46,919</td>
                  <td>6.60</td>
                  <td>{money(309665.4)}</td>
                </tr>
                <tr>
                  <td>Electronic 6,571</td>
                  <td>5.92</td>
                  <td>{money(38900.32)}</td>
                </tr>
                <tr>
                  <td>TOU 264</td>
                  <td>12.40</td>
                  <td>{money(3273.6)}</td>
                </tr>
                <tr>
                  <td>AMI 0</td>
                  <td>4.60</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            รวม {money(351839.32)}/เดือน ตรงกับวงเงินประกาศ
          </p>
        </InfoCard>
        <InfoCard title="หลักประกันตามเอกสาร">
          <ul>
            <li>หลักประกันเสนอค่าตอบแทน {money(53754)} = 53,754 × 1 บาท</li>
            <li>หลักประกันสัญญา {money(1075080)} = 53,754 × 20 บาท</li>
            <li>วงเงิน 36 รอบ {money(12666215.52)} ไม่รวม VAT</li>
          </ul>
        </InfoCard>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-bold">แผนสายการจดหน่วยที่ได้รับ</h3>
          <p className="text-sm text-slate-500">
            แยกตามพื้นที่และหมายเลขกลุ่ม เพื่อใช้วางกำลังคน/ต้นทุนรายสาย
          </p>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>พื้นที่</th>
                <th>หมายเลขกลุ่ม</th>
                <th>กลุ่ม</th>
                <th>จำนวนสาย</th>
                <th>จำนวนราย</th>
                <th>วัน</th>
                <th>เครื่อง</th>
              </tr>
            </thead>
            <tbody>
              {phayakRoutes.map((r) => (
                <tr key={r.branch}>
                  <td>{r.branch}</td>
                  <td>{r.groups}</td>
                  <td>{r.groupCount}</td>
                  <td>{fmt(r.routes)}</td>
                  <td>{fmt(r.customers)}</td>
                  <td>{r.days}</td>
                  <td>{r.devices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <InfoCard title="ภาระงานรายวัน — แผนพยัคฆภูมิพิสัย 25,476 ราย">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Portion</th>
                  <th>วันที่</th>
                  <th>รายรวม</th>
                </tr>
              </thead>
              <tbody>
                {phayakDaily.map((d) => (
                  <tr key={d[0]}>
                    <td>{d[0]}</td>
                    <td>{d[1]}</td>
                    <td>{fmt(d[2])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            สูงสุด A1 = 2,780 ราย • ต่ำสุด C1 = 2,234 ราย • ต่างกัน 546 ราย
          </p>
        </InfoCard>
        <InfoCard title="วิเคราะห์ต่อได้จากสายการจดหน่วย">
          <ol>
            <li>คำนวณจำนวนรายต่อพนักงาน/วัน เพื่อดูวันงานหนักและวันงานเบา</li>
            <li>จัดพนักงานลง Portion และสายจริง พร้อมวางพนักงานสำรอง</li>
            <li>คิดค่าแรง น้ำมัน กระดาษ และต้นทุนเดินทางแยกตามสาย</li>
            <li>เปรียบเทียบแผนกับผลงานจริงรายวัน/รายสาย</li>
            <li>
              เก็บจำนวนผิดปกติ งาน QC คืน และค่าปรับแยกตามสาย เพื่อหาสายเสี่ยง
            </li>
            <li>
              ใช้ข้อมูลจริงภายหลังปรับจำนวนคนให้เหมาะสมแทนการใช้ขั้นต่ำ 17
              คนแบบตายตัว
            </li>
          </ol>
        </InfoCard>
      </section>
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h3 className="font-bold text-amber-950">
          ตรวจยอดก่อนเชื่อมเข้าสูตรการเงิน
        </h3>
        <p className="text-sm text-amber-900 mt-1">
          แผนที่ได้รับระบุ พยัคฆภูมิพิสัย 25,476 ราย, นาเชือก 41,545 ราย
          และยางสีสุราช 53,754 ราย แต่เอกสารเสนอราคาชุดนี้ใช้ฐาน 53,754 ราย
          ซึ่งตรงกับยอดแผนยางสีสุราช ไม่ใช่ผลรวมทั้งสามพื้นที่
        </p>
      </section>
    </>
  );
  const Bid = () => (
    <>
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <div className="grid lg:grid-cols-[1fr_1.35fr_.8fr] gap-5 items-center">
          <div>
            <div className="text-xs font-bold text-violet-600">ไซด์งานจริง</div>
            <h3 className="text-xl font-bold text-violet-950 mt-1">
              {calcConfig.name} ครั้งที่ 1/2569
            </h3>
            <p className="text-sm text-violet-700 mt-2">
              ข้อมูลจำนวนรายจากเอกสารประกาศ
            </p>
          </div>
          <div className="lg:border-l lg:border-violet-200 lg:pl-6">
            <div className="text-sm font-bold text-slate-700">
              จำนวนรายผู้ใช้ไฟฟ้า
            </div>
            <div className="flex items-end gap-3 mt-1">
              <span className="text-5xl md:text-6xl font-black tracking-tight text-fuchsia-700">
                {fmt(calcConfig.total)}
              </span>
              <b className="text-2xl text-slate-900 pb-1">ราย</b>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              {fmt(calcConfig.total)} เครื่อง/เดือน • {calcConfig.days}{' '}
              วัน/เดือน • พนักงานจดหน่วยอย่างน้อย {calcConfig.workers} คน/วัน
            </p>
            <p className="text-xs text-violet-700 mt-2">
              ค่าแรงตั้งต้น {laborRate.toFixed(2)} บาท/ราย • อุปกรณ์สำรอง 5%
              (ยกเว้น Clip amp) • กระดาษเผื่อ 5%
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-white/70 p-4 text-center">
            <div className="text-xs font-bold text-violet-700">
              วงเงินประมาณการ 36 รอบ
            </div>
            <b className="block text-xl md:text-2xl text-violet-900 mt-2">
              {money(calcConfig.total36)}
            </b>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <b className="text-sky-950">กรอกข้อมูลให้ครบก่อน</b>
          <div className="text-sm text-sky-700">{bidMessage}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={calculateBid}
            className="rounded-xl bg-sky-700 text-white px-5 py-3 font-bold flex items-center gap-2"
          >
            <Calculator size={18} />
            คำนวณ
          </button>
          <button
            type="button"
            onClick={saveBid}
            className="rounded-xl bg-slate-900 text-white px-5 py-3 font-bold flex items-center gap-2"
          >
            <Save size={18} />
            บันทึกชุดคำนวณ
          </button>
        </div>
      </section>
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b">
            <h3 className="font-bold">ราคาที่จะเสนอ แยกตามประเภทมิเตอร์</h3>
            <p className="text-sm text-slate-500">
              ราคาต้องไม่เกินราคากลางของแต่ละประเภท
            </p>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>จำนวน/เดือน</th>
                  <th>ราคากลาง</th>
                  <th>ราคาที่จะเสนอ</th>
                  <th>รายได้/เดือน</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((m, i) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{fmt(m.count)}</td>
                    <td>{m.ceiling.toFixed(2)}</td>
                    <td>
                      <DecimalInput
                        ariaLabel={'ราคาที่จะเสนอ ' + m.label}
                        className={
                          'cell w-28 text-right ' +
                          (m.bid > m.ceiling ? 'border-rose-400' : '')
                        }
                        value={m.bid}
                        onCommit={(value) => changeBidPrice(i, value)}
                      />
                    </td>
                    <td>{money(m.count * m.bid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overCeiling && (
            <div className="m-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
              มีราคาที่เสนอสูงกว่าราคากลาง กรุณาปรับก่อนใช้ยื่นจริง
            </div>
          )}
          <div className="p-5 border-t grid sm:grid-cols-2 gap-4">
            <label className="field">
              จำนวนกรณีไม่มีการพิมพ์ใบแจ้งฯ / เดือน
              <input
                type="number"
                min="0"
                value={specialNoPrint}
                onChange={(e) => setSpecialNoPrint(Number(e.target.value))}
              />
              <small className="font-normal text-slate-400">
                คิดค่าตอบแทนเพิ่มตามเงื่อนไข 0.40 บาท/ฉบับ
              </small>
            </label>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">
                ค่าตอบแทนรวมที่ราคากลาง
              </div>
              <b className="text-lg">{money(ceilingRevenue)}</b>
              <div className="text-xs text-slate-400 mt-1">
                วงเงินประมาณการ {money(calcConfig.budget)}/เดือน
              </div>
            </div>
          </div>
        </div>
        <div
          className={
            'rounded-2xl p-5 text-white ' +
            (monthlyBidProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600')
          }
        >
          <div className="text-sm opacity-90">
            ผลจำลองต่อเดือน {calculated ? '(คำนวณล่าสุด)' : '(ค่าเริ่มต้น)'}
          </div>
          <div className="text-3xl font-bold mt-2">
            {money(monthlyBidProfit)}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="metricDark">
              <span>รายได้</span>
              <b>{money(monthlyBidIncome)}</b>
            </div>
            <div className="metricDark">
              <span>Margin</span>
              <b>{bidMargin.toFixed(2)}%</b>
            </div>
            <div className="metricDark">
              <span>ต้นทุน/เดือน</span>
              <b>{money(monthlyBidCost)}</b>
            </div>
            <div className="metricDark">
              <span>ต้นทุนเฉลี่ย/ราย</span>
              <b>{money(averageCostPerCustomer)}</b>
            </div>
            <div className="metricDark">
              <span>36 รอบ</span>
              <b>{money(total36Profit)}</b>
            </div>
          </div>
        </div>
      </section>
      <section className="grid lg:grid-cols-3 gap-4">
        <InfoCard
          title={
            'ค่าใช้จ่ายดำเนินงาน / เดือน — ' +
            calcConfig.name +
            ' (ไม่บวก VAT อัตโนมัติ)'
          }
        >
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 mb-4">
            <div className="font-bold text-sky-950 mb-2">ค่าแรง</div>
            <div className="grid sm:grid-cols-[1fr_130px] gap-3 items-end">
              <label className="field">
                ค่าแรงต่อราย (บาท)
                <DecimalInput
                  ariaLabel="ค่าแรงต่อราย"
                  value={currentLaborRate}
                  onCommit={(value) =>
                    setOperating((p) => {
                      const i = p.findIndex((x) => x.kind === 'laborRate');
                      return i >= 0
                        ? p.map((x, j) => (j === i ? { ...x, value } : x))
                        : [
                            {
                              label: 'ค่าแรง/ราย (บาท)',
                              value,
                              kind: 'laborRate',
                            },
                            ...p,
                          ];
                    })
                  }
                />
              </label>
              <div className="rounded-xl bg-white border border-sky-200 p-3">
                <div className="text-xs text-sky-700">ค่าแรงรวม/เดือน</div>
                <b className="block text-lg text-sky-950">
                  {money(currentLaborCost)}
                </b>
              </div>
            </div>
            <div className="text-xs text-sky-700 mt-2">
              {currentLaborRate.toFixed(2)} บาท ×{' '}
              {fmt(meters.reduce((s, m) => s + m.count, 0))} ราย •
              พนักงานขั้นต่ำตามเอกสาร {siteWorkers} คน/วัน
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <b className="text-slate-800">รายการค่าใช้จ่ายอื่น</b>
            <button
              type="button"
              className="rounded-lg bg-sky-700 text-white px-3 py-2 text-sm font-semibold"
              onClick={() =>
                setOperating((p) => [...p, { label: 'รายการใหม่', value: 0 }])
              }
            >
              + เพิ่มรายการ
            </button>
          </div>
          <div className="space-y-2">
            {operating.map((c, i) =>
              c.kind === 'laborRate' ? null : (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2"
                >
                  <input
                    className="cell min-w-0"
                    value={c.label}
                    onChange={(e) =>
                      changeList(setOperating, i, 'label', e.target.value)
                    }
                  />
                  <DecimalInput
                    value={c.value}
                    onCommit={(value) =>
                      setOperating((p) =>
                        p.map((x, j) => (j === i ? { ...x, value } : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={'ลบรายการ ' + c.label}
                    title="ลบรายการ"
                    onClick={() =>
                      setOperating((p) => p.filter((_, j) => j !== i))
                    }
                    className="rounded-lg border border-rose-200 px-3 text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">ลบ</span>
                  </button>
                </div>
              ),
            )}
          </div>
        </InfoCard>
        <InfoCard title="ของที่ซื้อทุกเดือน — ราคา “ก่อน VAT”">
          <div className="space-y-2">
            {monthlyBuys.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_130px] gap-2">
                <input
                  className="cell"
                  value={c.label}
                  onChange={(e) =>
                    changeList(setMonthlyBuys, i, 'label', e.target.value)
                  }
                />
                <DecimalInput
                  value={c.value}
                  onCommit={(value) =>
                    setMonthlyBuys((p) =>
                      p.map((x, j) => (j === i ? { ...x, value } : x)),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <button
            className="mt-3 text-sky-700 font-semibold"
            onClick={() =>
              setMonthlyBuys((p) => [
                ...p,
                { label: 'รายการซื้อใหม่ (ก่อน VAT)', value: 0 },
              ])
            }
          >
            + เพิ่มของซื้อ
          </button>
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <div className="text-xs text-amber-800 mb-2">
              ช่องกระดาษเป็น “ราคาต่อราย/แผ่น” ระบบคูณจำนวนรายและบวกสำรอง 5%
              ก่อน VAT
            </div>
            <div className="flex justify-between">
              <span>จำนวนราย</span>
              <b>{fmt(activeMeters.reduce((s, m) => s + m.count, 0))}</b>
            </div>
            <div className="flex justify-between">
              <span>จำนวนกระดาษรวมสำรอง 5%</span>
              <b>{fmt(paperQuantity)} แผ่น</b>
            </div>
            <div className="flex justify-between">
              <span>ค่ากระดาษก่อน VAT</span>
              <b>{money(paperPreVat)}</b>
            </div>
            <div className="flex justify-between">
              <span>ก่อน VAT รวมของซื้อ</span>
              <b>{money(monthlyBuyPreVat)}</b>
            </div>
            <div className="flex justify-between">
              <span>VAT 7%</span>
              <b>{money(monthlyBuyVat)}</b>
            </div>
            <div className="flex justify-between border-t border-amber-200 mt-2 pt-2 text-amber-900">
              <span>จ่ายจริง/เดือน</span>
              <b>{money(monthlyBuyGross)}</b>
            </div>
          </div>
        </InfoCard>
        <InfoCard title="อุปกรณ์ซื้อครั้งแรก — ราคา/หน่วย “ก่อน VAT”">
          <div className="space-y-2">
            {equipment.map((c, i) => {
              const isClip = c.label.toLowerCase().includes('clip');
              const qty = isClip ? siteWorkers : reservedQty;
              return (
                <div key={i}>
                  <div className="grid grid-cols-[1fr_130px] gap-2">
                    <input
                      className="cell"
                      value={c.label}
                      onChange={(e) =>
                        changeList(setEquipment, i, 'label', e.target.value)
                      }
                    />
                    <DecimalInput
                      value={c.value}
                      onCommit={(value) =>
                        setEquipment((p) =>
                          p.map((x, j) => (j === i ? { ...x, value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1 px-1">
                    จำนวนซื้อ {qty} ชิ้น × {money(c.value)} ={' '}
                    {money(c.value * qty)}
                    {isClip ? ' • ไม่สำรอง' : ' • รวมสำรอง 5% ปัดขึ้น'}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            className="mt-3 text-sky-700 font-semibold"
            onClick={() =>
              setEquipment((p) => [
                ...p,
                { label: 'อุปกรณ์ใหม่ (ก่อน VAT)', value: 0 },
              ])
            }
          >
            + เพิ่มอุปกรณ์
          </button>
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <div className="text-xs text-amber-800 mb-2">
              คำนวณจากพนักงาน {siteWorkers} คน: อุปกรณ์ทั่วไปซื้อ {reservedQty}{' '}
              ชิ้น (รวมสำรอง 5% ปัดขึ้น) ส่วน Clip amp ซื้อ {siteWorkers} ชิ้น
              ไม่สำรอง
            </div>
            <div className="flex justify-between">
              <span>อุปกรณ์หลัก {siteWorkers} ชุด ก่อน VAT</span>
              <b>{money(equipmentBasePreVat)}</b>
            </div>
            <div className="flex justify-between">
              <span>ต้นทุนอุปกรณ์สำรอง</span>
              <b>{money(equipmentReserveCost)}</b>
            </div>
            <div className="flex justify-between">
              <span>ฐานก่อน VAT รวมสำรอง</span>
              <b>{money(equipmentReservedPreVat)}</b>
            </div>
            <div className="flex justify-between">
              <span>VAT 7%</span>
              <b>{money(equipmentVat)}</b>
            </div>
            <div className="flex justify-between border-t border-amber-200 mt-2 pt-2 text-amber-900">
              <span>เงินสดจ่ายเริ่มต้น</span>
              <b>{money(equipmentGross)}</b>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              ผลกำไรต่อเดือนเฉลี่ยต้นทุนอุปกรณ์ตลอด 36 รอบ ={' '}
              {money(equipmentMonthly)}/เดือน
            </div>
          </div>
        </InfoCard>
      </section>
      <section className="grid md:grid-cols-4 gap-4">
        <div className="metric">
          <span>หลักประกันเสนอราคา</span>
          <b>{money(bidGuarantee)}</b>
          <small>{fmt(totalMeters)} × 1 บาท</small>
        </div>
        <div className="metric">
          <span>หลักประกันสัญญา</span>
          <b>{money(contractGuarantee)}</b>
          <small>{fmt(totalMeters)} × 20 บาท</small>
        </div>
        <div className="metric">
          <span>เงินสดอุปกรณ์รวม VAT</span>
          <b>{money(equipmentGross)}</b>
        </div>
        <div className="metric">
          <span>รายได้รวม 36 รอบ</span>
          <b>{money(total36Income)}</b>
        </div>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold">สรุป 36 รอบ</h3>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <div className="metric">
            <span>รายได้รวม</span>
            <b>{money(total36Income)}</b>
          </div>
          <div className="metric">
            <span>ต้นทุนรวมที่ใช้จำลอง</span>
            <b>{money(total36Cost)}</b>
          </div>
          <div className="metric">
            <span>กำไร/ขาดทุนรวม</span>
            <b
              className={
                total36Profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }
            >
              {money(total36Profit)}
            </b>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          หมายเหตุ: ช่องราคาในหน้าจตุรัสไม่มีปุ่มลูกศรและรองรับทศนิยม เช่น 0.35
          หรือ 12.50 ระบบรับค่าหลังออกจากช่องหรือกด Enter
          และผลสรุปจะเปลี่ยนเมื่อกด “คำนวณ”
        </p>
      </section>
    </>
  );
  const Prasat = () => Bid();
  const Phutthaisong = () => Bid();
  const Mahasarakham = () => (
    <>
      {Bid()}
      <section className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
        <div className="text-xs font-bold text-purple-700">
          รายละเอียดเอกสาร
        </div>
        <h3 className="text-xl font-bold text-purple-950 mt-1">
          มหาชนะชัย ครั้งที่ 1/2569
        </h3>
        <p className="text-sm text-purple-800 mt-1">
          ประกาศ ฉ.2 กฟฟ.(ตบ)2715/2569 • กฟภ.2 • งานจดหน่วยพร้อมแจ้งค่าไฟฟ้า
          กฟส.อำเภอมหาชนะชัย
        </p>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <InfoCard title="จำนวนมิเตอร์และราคากลาง">
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>จำนวน/เดือน</th>
                  <th>ราคากลาง</th>
                  <th>วงเงิน/เดือน</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>มิเตอร์จานหมุน</td>
                  <td>{fmt(23014)}</td>
                  <td>6.60</td>
                  <td>{money(151892.4)}</td>
                </tr>
                <tr>
                  <td>มิเตอร์อิเล็กทรอนิกส์ Bluetooth</td>
                  <td>{fmt(2841)}</td>
                  <td>5.92</td>
                  <td>{money(16818.72)}</td>
                </tr>
                <tr>
                  <td>มิเตอร์ TOU</td>
                  <td>{fmt(171)}</td>
                  <td>12.40</td>
                  <td>{money(2120.4)}</td>
                </tr>
                <tr>
                  <td>มิเตอร์ AMI</td>
                  <td>0</td>
                  <td>4.60</td>
                  <td>-</td>
                </tr>
                <tr>
                  <td>
                    <b>รวม</b>
                  </td>
                  <td>
                    <b>{fmt(26026)}</b>
                  </td>
                  <td></td>
                  <td>
                    <b>{money(170831.52)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            กรณีจดหน่วยแต่ไม่มีการพิมพ์/วางใบแจ้งตามเงื่อนไข เอกสารระบุค่าตอบแทน
            0.40 บาท/ฉบับ
          </p>
        </InfoCard>
        <InfoCard title="รายละเอียดประกาศ">
          <ul>
            <li>วงเงินประมาณการ 36 รอบ {money(6149934.72)} ไม่รวม VAT</li>
            <li>วันที่ประกาศ 7 ก.ย. 2569 เวลา 09:00 น.</li>
            <li>วันที่สิ้นสุด 25 ก.ย. 2569 เวลา 16:30 น.</li>
            <li>เริ่มยื่นเอกสาร 14 ก.ย. 2569 เวลา 09:00 น.</li>
            <li>สิ้นสุดยื่นเอกสาร 25 ก.ย. 2569 เวลา 16:30 น.</li>
            <li>ยืนยันเสนอค่าตอบแทน 2 ต.ค. 2569 เวลา 09:00–12:00</li>
          </ul>
        </InfoCard>
      </section>
      <section className="grid lg:grid-cols-2 gap-4">
        <InfoCard title="หลักประกันตามเอกสาร">
          <ul>
            <li>หลักประกันเสนอค่าตอบแทน {money(26026)} = 26,026 × 1 บาท</li>
            <li>หลักประกันสัญญา {money(520520)} = 26,026 × 20 บาท</li>
            <li>
              หลักประกันเป็นเงินสด Pay-IN แคชเชียร์เช็ค
              หรือหนังสือค้ำประกันธนาคารตามเงื่อนไข
            </li>
          </ul>
        </InfoCard>
        <InfoCard title="ข้อมูลติดต่อ/พื้นที่">
          <ul>
            <li>เขตการไฟฟ้า: กฟภ.2</li>
            <li>การไฟฟ้าคู่สัญญา: การไฟฟ้าส่วนภูมิภาคสาขาอำเภอมหาชนะชัย</li>
            <li>ที่อยู่: 129 หมู่ 6 ต.ปิง อ.มหาชนะชัย จ.ยโสธร 35130</li>
            <li>ผู้ติดต่อ: นางสาวกอบกอง หล้าแหล่ง • 089-4256143</li>
          </ul>
        </InfoCard>
      </section>
    </>
  );
  const content: Record<
    Exclude<
      MenuKey,
      | 'original'
      | 'bid'
      | 'khueangnai'
      | 'prasat'
      | 'phayak'
      | 'phutthaisong'
      | 'mahasarakham'
    >,
    React.ReactNode
  > = {
    work: (
      <>
        <section className="grid md:grid-cols-4 gap-4">
          <div className="metric">
            <span>งานต่อเดือน</span>
            <b>45,645 ราย</b>
          </div>
          <div className="metric">
            <span>แผนจดหน่วย</span>
            <b>10 วัน/เดือน</b>
          </div>
          <div className="metric">
            <span>พนักงานขั้นต่ำ</span>
            <b>11 คน/วัน</b>
          </div>
          <div className="metric">
            <span>เครื่องจดหน่วยขั้นต่ำ</span>
            <b>11 เครื่อง/วัน</b>
          </div>
        </section>
        <div className="grid lg:grid-cols-2 gap-4">
          <InfoCard title="ก่อนเริ่มงาน">
            <ul>
              <li>
                เตรียมพนักงานอย่างน้อย 11 คน/วัน และเครื่องจดหน่วยอย่างน้อย 11
                เครื่อง/วัน
              </li>
              <li>
                เตรียม Smartphone, Mobile Printer, Clip-on ammeter, กระดาษ
                Thermal และเครื่องแต่งกาย
              </li>
              <li>
                อุปกรณ์ Smartphone และ Printer
                ที่ใช้ยื่นหลักฐานต้องเป็นเครื่องใหม่ตามเงื่อนไขเอกสาร
              </li>
              <li>
                มีช่วงจดหน่วยเสมือนจริงก่อนเริ่มงานจริง
                และช่วงดังกล่าวไม่มีค่าตอบแทนตามเงื่อนไขที่ได้รับ
              </li>
            </ul>
          </InfoCard>
          <InfoCard title="แผนปฏิบัติงานไซด์จตุรัส">
            <ul>
              <li>จำนวนมิเตอร์รวม 45,645 เครื่อง/เดือน</li>
              <li>จานหมุน 40,690 • Electronic 4,718 • TOU 237 • AMI 0</li>
              <li>กำหนดแผนจดหน่วย 10 วัน/เดือน</li>
              <li>สัญญาสูงสุด 36 รอบการจดหน่วย</li>
            </ul>
          </InfoCard>
          <InfoCard title="ระหว่างปฏิบัติงาน">
            <ul>
              <li>
                เริ่มจดหน่วยตามแผนได้ตั้งแต่ 07:00–15:30 น.
                และต้องส่งข้อมูลภายในเวลาที่ กฟภ. กำหนด
              </li>
              <li>
                พนักงานต้องตรวจเลขมิเตอร์ หน่วย และรหัสผิดปกติ
                พร้อมถ่ายภาพ/หลักฐานตามกรณี
              </li>
              <li>
                QC ตรวจข้อมูลผ่าน MRM ก่อนส่ง SAP
                และส่งรายการผิดกลับให้พนักงานแก้ไข
              </li>
              <li>
                ใบแจ้งค่าไฟฟ้าต้องพิมพ์/ส่งมอบตามเงื่อนไข รวมถึงการตรวจ
                Barcode/QR Code และข้อมูลผู้ใช้ไฟ
              </li>
              <li>
                กรณีไม่มีการพิมพ์ใบแจ้งของมิเตอร์ที่เข้าเงื่อนไข ใช้อัตรา 0.40
                บาท/ฉบับตามประกาศ
              </li>
            </ul>
          </InfoCard>
          <InfoCard title="การบริหารพนักงาน">
            <ul>
              <li>ใช้เฉพาะพนักงานที่แจ้งรายชื่อและได้รับอนุญาตให้ปฏิบัติงาน</li>
              <li>
                พนักงานต้องแต่งกายตามแบบ มีบัตรประจำตัว และอุปกรณ์พร้อมใช้งาน
              </li>
              <li>
                อบรมทบทวนหลักสูตรอย่างน้อยปีละครั้ง
                และตัวแทนต้องผ่านการอบรม/ทดสอบตามหลักเกณฑ์
              </li>
              <li>
                สลับสายจดหน่วยทุก 6 เดือน ไม่น้อยกว่า 50% ของพนักงานทั้งหมด
                และแจ้งแผนให้หน่วยงานทราบ
              </li>
              <li>เอกสารกำหนดให้มีการประเมินผลปฏิบัติงานรายปีตลอดอายุสัญญา</li>
            </ul>
          </InfoCard>
        </div>
      </>
    ),
    qc: (
      <>
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <div className="text-xs font-bold text-cyan-700">
            อ้างอิงเอกสารแนบ หน้า 17–21
          </div>
          <h3 className="text-xl font-bold text-cyan-950 mt-1">
            QC และการจัดการรหัสผิดปกติ
          </h3>
          <p className="text-sm text-cyan-800 mt-1">
            จัดลำดับจากข้อมูลจดหน่วย → ตรวจใน MRM → QC ตรวจหลักฐาน →
            ส่งกลับแก้ไข → ยืนยัน → ส่ง SAP
          </p>
        </section>
        <section className="grid md:grid-cols-5 gap-3">
          {[
            ['1', 'รับข้อมูล', 'MRM รับข้อมูลจดหน่วย'],
            ['2', 'ตรวจระบบ', 'คัดกรองข้อมูลผิดปกติ'],
            ['3', 'QC ตรวจ', 'ตรวจข้อมูล/รูป/หลักฐาน'],
            ['4', 'แก้ไข', 'ส่งคืนพนักงานเมื่อผิด'],
            ['5', 'ยืนยัน', 'ยืนยันก่อนส่ง SAP'],
          ].map((x) => (
            <div key={x[0]} className="metric">
              <span>ขั้น {x[0]}</span>
              <b>{x[1]}</b>
              <small>{x[2]}</small>
            </div>
          ))}
        </section>
        <section className="grid lg:grid-cols-2 gap-4">
          <InfoCard title="Workflow QC จากเอกสาร">
            <ol>
              <li>ระบบ MRM แสดงรายการข้อมูลจดหน่วยที่ต้องตรวจสอบ</li>
              <li>
                QC เปิดรายการและตรวจข้อมูลมิเตอร์ หน่วย รหัสผิดปกติ
                และข้อมูลประกอบ
              </li>
              <li>ตรวจรูปภาพที่พนักงานส่ง เช่น รูปมิเตอร์/หลักฐานที่กำหนด</li>
              <li>
                หากข้อมูลหรือรูปไม่ถูกต้อง ให้ส่งกลับพนักงานจดหน่วยเพื่อแก้ไข
              </li>
              <li>เมื่อแก้ไขครบ QC ตรวจซ้ำและยืนยันข้อมูล</li>
              <li>รายการที่ผ่านจึงเข้าสู่ขั้นตอนส่งข้อมูลต่อไปยังระบบ SAP</li>
            </ol>
          </InfoCard>
          <InfoCard title="หลักฐานที่ QC ควรตรวจ">
            <ul>
              <li>เลข PEA No. / เลขมิเตอร์และข้อมูลผู้ใช้ไฟ</li>
              <li>ค่าหน่วยที่จดและความสอดคล้องกับสภาพมิเตอร์</li>
              <li>รหัสผิดปกติและเงื่อนไขของรหัสนั้น</li>
              <li>ภาพมิเตอร์/ภาพหลักฐานที่ระบบกำหนด</li>
              <li>Clip-on ammeter เฉพาะกรณีที่รหัส/เงื่อนไขกำหนด</li>
              <li>ความครบถ้วนก่อนกดยืนยันส่งข้อมูล</li>
            </ul>
          </InfoCard>
        </section>
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b">
            <h3 className="font-bold">หมวดรหัสผิดปกติในตารางเอกสาร</h3>
            <p className="text-sm text-slate-500">
              หน้า 17–18 แบ่งรหัสเป็นหลายหมวดและระบุว่าต้องถ่ายรูป/ตรวจ/ใช้
              Clip-on หรือไม่ตามแต่ละรหัส
            </p>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>หมวดที่พบในเอกสาร</th>
                  <th>การใช้งานใน QC</th>
                  <th>สิ่งที่ต้องตรวจ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>05 — Patrol Board</td>
                  <td>ตรวจสภาพ/เหตุผิดปกติที่พบภาคสนาม</td>
                  <td>รหัสย่อย + หลักฐานตามตาราง</td>
                </tr>
                <tr>
                  <td>06 — ผิดปกติด้านไฟฟ้า</td>
                  <td>ตรวจค่าหรือสภาพไฟฟ้าที่ผิดปกติ</td>
                  <td>รูป/ค่าที่เกี่ยวข้อง และ Clip-on ตามกรณี</td>
                </tr>
                <tr>
                  <td>07 — PEA No.</td>
                  <td>ตรวจข้อมูลระบุตัวมิเตอร์/ผู้ใช้ไฟ</td>
                  <td>PEA No. และข้อมูลประกอบ</td>
                </tr>
                <tr>
                  <td>09 — ไม่พบ/เข้าถึงมิเตอร์ไม่ได้</td>
                  <td>ตรวจเหตุที่ไม่สามารถจดตามปกติ</td>
                  <td>เหตุผลและหลักฐานตามรหัสย่อย</td>
                </tr>
                <tr>
                  <td>10 — งานตรวจสอบ</td>
                  <td>รายการที่ต้องตรวจเพิ่มเติม</td>
                  <td>ข้อมูลและภาพตามเงื่อนไข</td>
                </tr>
                <tr>
                  <td>11 — เหตุเฉพาะ/การดำเนินการอื่น</td>
                  <td>ตรวจตามรหัสย่อยในเอกสาร</td>
                  <td>หลักฐานตามช่องกำหนด</td>
                </tr>
                <tr>
                  <td>77 — งานที่เกี่ยวกับหน่วย/โหลด</td>
                  <td>ตรวจค่าหน่วยและการใช้เครื่องมือประกอบ</td>
                  <td>ค่าที่จด รูป และ Clip-on ตามกรณี</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-amber-50 text-xs text-amber-900">
            หมายเหตุ: ตารางนี้สรุประดับ “หมวด” จากเอกสารเพื่อใช้งานง่ายก่อน
            โดยรายละเอียดรหัสย่อยและเครื่องหมายว่าต้องถ่ายรูป/Clip-on
            ให้ยึดตารางต้นฉบับหน้า 17–18 เป็นหลัก
          </div>
        </section>
        <section className="grid lg:grid-cols-3 gap-4">
          <InfoCard title="QC ต้องส่งกลับเมื่อ">
            <ul>
              <li>เลขมิเตอร์/ข้อมูลไม่ตรง</li>
              <li>หน่วยหรือรหัสผิดปกติไม่สมเหตุผล</li>
              <li>ภาพไม่ชัด/ไม่ครบ</li>
              <li>หลักฐานตามรหัสไม่ครบ</li>
            </ul>
          </InfoCard>
          <InfoCard title="QC ผ่านเมื่อ">
            <ul>
              <li>ข้อมูลและรูปสอดคล้องกัน</li>
              <li>รหัสผิดปกติถูกต้อง</li>
              <li>หลักฐานครบตามเงื่อนไข</li>
              <li>พร้อมยืนยันส่งข้อมูลต่อ</li>
            </ul>
          </InfoCard>
          <InfoCard title="เป้าหมาย">
            <p>
              ลดงานแก้ซ้ำ ลดข้อมูลผิดที่หลุดไป SAP
              และลดความเสี่ยงค่าปรับจากการจดหน่วย/หลักฐานไม่ถูกต้อง
            </p>
          </InfoCard>
        </section>
      </>
    ),
    risk: (
      <>
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="font-bold text-rose-950">ค่าปรับที่มีข้อมูลแล้ว</h3>
          <p className="text-sm text-rose-800 mt-1">
            ใช้เป็นรายการเฝ้าระวังเบื้องต้น ก่อนที่เราจะทำตัวจำลองจำนวนครั้ง ×
            ค่าปรับในภายหลัง
          </p>
        </section>
        <div className="grid lg:grid-cols-2 gap-4">
          <InfoCard title="ความเสี่ยงด้านข้อมูล/บิล">
            <ul>
              <li>
                ข้อมูลจดหน่วยผิดจนเกิดความเสียหาย/ร้องเรียน —
                มีค่าปรับตามกรณีในหลักเกณฑ์
              </li>
              <li>
                จดมิเตอร์ TOU ผิดหรือไม่ครบตามช่วงเวลา —
                ต้องตรวจเป็นรายการเสี่ยงสูง
              </li>
              <li>
                พิมพ์ใบแจ้งซ้ำมากกว่า 1 ครั้งโดยไม่ดำเนินการตามเงื่อนไข — 500
                บาท/ครั้ง
              </li>
              <li>
                ใบแจ้งไม่พิมพ์ Barcode/QR Code หรือพิมพ์ไม่ชัดจนชำระไม่ได้ — 500
                บาท/ฉบับ
              </li>
              <li>ใบแจ้งค่าไฟฟ้าสูญหาย — 100 บาท/ฉบับ</li>
              <li>ส่งข้อมูลจดหน่วยล่าช้าเกินกำหนด — 3 บาท/มิเตอร์/วัน</li>
            </ul>
          </InfoCard>
          <InfoCard title="ความเสี่ยงด้านบุคลากร/อุปกรณ์">
            <ul>
              <li>
                ใช้พนักงานจดหน่วยไม่ตรงกับรายชื่อที่แจ้ง — 1,000 บาท/คน/วัน
              </li>
              <li>
                ใช้เครื่องจดหน่วย/อุปกรณ์ไม่ตรงหลักฐานที่แจ้ง — 1,000
                บาท/เครื่อง/วัน
              </li>
              <li>
                พนักงานไม่แต่งกายตามแบบหรือไม่มีบัตรประจำตัว —
                เสี่ยงผิดข้อกำหนดการปฏิบัติงาน
              </li>
              <li>
                ไม่แก้ไขรายการผิดหรือไม่ส่งข้อมูลภายในกำหนด
                อาจเกิดค่าปรับสะสมและกระทบผลประเมิน
              </li>
            </ul>
          </InfoCard>
          <InfoCard title="จุดควบคุมที่ควรมี">
            <ul>
              <li>QC ก่อนส่งข้อมูลทุกวัน</li>
              <li>ตรวจเลขมิเตอร์และประเภท TOU แยกเป็นรายการเสี่ยงสูง</li>
              <li>ควบคุม Serial/รายการอุปกรณ์ให้ตรงกับที่ยื่น</li>
              <li>ตรวจรายชื่อพนักงานก่อนออกปฏิบัติงาน</li>
            </ul>
          </InfoCard>
          <InfoCard title="ผลกระทบต่อกำไร">
            <p>
              ค่าปรับบางรายการสูงกว่ากำไรต่อรายหลายเท่า จึงต้องแยก
              “งบสำรองค่าปรับ” และ “ค่าปรับเกิดจริง” ออกจากกัน
              เมื่อมีสถิติจริงเราจะนำมาคำนวณเป็นอัตราความเสี่ยงต่อเดือน
            </p>
          </InfoCard>
        </div>
      </>
    ),
    capital: (
      <>
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="text-xs font-bold text-indigo-600">
            ไซด์จตุรัส ครั้งที่ 1/2569
          </div>
          <h3 className="text-xl font-bold text-indigo-950 mt-1">
            หลักประกันและเงินทุนที่ต้องเตรียม
          </h3>
          <p className="text-sm text-indigo-800 mt-1">
            แยกเงินที่ถูกวางค้ำประกันออกจากค่าใช้จ่ายจริง
            เพื่อไม่ให้คำนวณกำไรผิด
          </p>
        </section>
        <section className="grid md:grid-cols-3 gap-4">
          <div className="metric">
            <span>จำนวนผู้ใช้ไฟ/มิเตอร์</span>
            <b>{fmt(totalMeters)} ราย</b>
          </div>
          <div className="metric">
            <span>หลักประกันเสนอค่าตอบแทน</span>
            <b>{money(bidGuarantee)}</b>
            <small>45,645 × 1.00 บาท</small>
          </div>
          <div className="metric">
            <span>หลักประกันสัญญา</span>
            <b>{money(contractGuarantee)}</b>
            <small>45,645 × 20.00 บาท</small>
          </div>
        </section>
        <section className="grid lg:grid-cols-2 gap-4">
          <InfoCard title="1. หลักประกันเสนอค่าตอบแทน">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between">
                <span>จำนวนราย</span>
                <b>{fmt(totalMeters)}</b>
              </div>
              <div className="flex justify-between">
                <span>อัตราหลักประกัน</span>
                <b>1.00 บาท/ราย</b>
              </div>
              <div className="flex justify-between border-t mt-2 pt-2">
                <span>ต้องเตรียม</span>
                <b className="text-indigo-700">{money(bidGuarantee)}</b>
              </div>
            </div>
            <p className="mt-3">
              เป็นเงินสำหรับขั้นตอนเสนอค่าตอบแทน จึงแสดงเป็นเงินที่ต้องเตรียม
              ไม่หักเป็นต้นทุนดำเนินงานหรือกำไรของงาน
            </p>
          </InfoCard>
          <InfoCard title="2. หลักประกันสัญญา">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between">
                <span>จำนวนราย</span>
                <b>{fmt(totalMeters)}</b>
              </div>
              <div className="flex justify-between">
                <span>อัตราหลักประกัน</span>
                <b>20.00 บาท/ราย</b>
              </div>
              <div className="flex justify-between border-t mt-2 pt-2">
                <span>ต้องเตรียม</span>
                <b className="text-indigo-700">{money(contractGuarantee)}</b>
              </div>
            </div>
            <p className="mt-3">
              เป็นเงินค้ำประกันเมื่อได้งาน แยกออกจากค่าแรง กระดาษ อุปกรณ์
              และค่าใช้จ่ายรายเดือน
            </p>
          </InfoCard>
        </section>
        <section className="grid lg:grid-cols-2 gap-4">
          <InfoCard title="3. เงินลงทุนอุปกรณ์เริ่มต้น">
            <div className="flex justify-between">
              <span>อุปกรณ์รวม VAT ตามหน้าเสนอราคา</span>
              <b>{money(equipmentGross)}</b>
            </div>
            <p className="mt-3">
              ตัวเลขนี้เชื่อมจาก Smartphone, Printer, Clip amp
              และอุปกรณ์เริ่มงานในหน้าเสนอราคา รวมจำนวนพนักงาน/สำรองและ VAT 7%
              แล้ว
            </p>
          </InfoCard>
          <InfoCard title="4. สรุปเงินที่ต้องเตรียมเบื้องต้น">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>ช่วงยื่นเสนอราคา</span>
                <b>{money(bidGuarantee)}</b>
              </div>
              <div className="flex justify-between">
                <span>เมื่อเข้าทำสัญญา</span>
                <b>{money(contractGuarantee)}</b>
              </div>
              <div className="flex justify-between">
                <span>อุปกรณ์เริ่มต้น</span>
                <b>{money(equipmentGross)}</b>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg">
                <span>เงินเตรียมเมื่อได้งาน*</span>
                <b className="text-indigo-700">
                  {money(contractGuarantee + equipmentGross)}
                </b>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              * ยังไม่รวมเงินหมุนเวียนค่าแรง กระดาษ ค่าเดินทาง QC/Staff
              และรายการอื่นที่เรายังไม่ได้กำหนดจริง จึงยังไม่ใส่ตัวเลขสมมติ
            </p>
          </InfoCard>
        </section>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-950">รายการที่จะเติมภายหลัง</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-sm">
            <div className="rounded-xl bg-white p-3 border">
              เงินหมุนเวียนค่าแรง
            </div>
            <div className="rounded-xl bg-white p-3 border">กระดาษและวัสดุ</div>
            <div className="rounded-xl bg-white p-3 border">
              ค่าเดินทาง / น้ำมัน
            </div>
            <div className="rounded-xl bg-white p-3 border">
              QC / Staff / ค่าใช้จ่ายอื่น
            </div>
          </div>
          <p className="text-xs text-amber-800 mt-3">
            รอข้อมูลจริงก่อนคำนวณ เพื่อไม่ให้ยอดเงินทุนที่ต้องเตรียมคลาดเคลื่อน
          </p>
        </section>
      </>
    ),
    requirements: (
      <div className="grid lg:grid-cols-2 gap-4">
        <InfoCard title="คุณสมบัตินิติบุคคล">
          <ul>
            <li>เป็นนิติบุคคลไทยและมีวัตถุประสงค์ตรงตามหลักเกณฑ์</li>
            <li>มีประสบการณ์งานที่เข้าเงื่อนไขตามระยะเวลาที่กำหนด</li>
            <li>ไม่อยู่ในสถานะต้องห้ามตามหลักเกณฑ์สรรหา</li>
            <li>ตัวแทน/ผู้ปฏิบัติงานผ่านการอบรมและทดสอบตามที่กำหนด</li>
          </ul>
        </InfoCard>
        <InfoCard title="เอกสารที่ใช้ในกระบวนการ ARM">
          <ul>
            <li>หนังสือรับรองนิติบุคคล</li>
            <li>ภ.พ.20 หรือ ภ.พ.09 ตามกรณี</li>
            <li>หนังสือรับรองผลงานและสัญญาจ้างที่ใช้ยืนยันประสบการณ์</li>
            <li>เอกสารผู้มีอำนาจลงนาม/หนังสือมอบอำนาจตามกรณี</li>
            <li>หลักฐานหลักประกันตามขั้นตอนเสนอราคาและทำสัญญา</li>
          </ul>
        </InfoCard>
        <InfoCard title="อุปกรณ์ปฏิบัติงานตามเอกสาร">
          <ul>
            <li>
              Smartphone: Android 11 ขึ้นไป, รองรับ 4G LTE/5G, ROM ≥64 GB, RAM
              ≥3 GB, microSD, GPS, กล้อง ≥5 MP, แบตเตอรี่ ≥3,500 mAh, จอ ≥5.5
              นิ้ว
            </li>
            <li>
              Mobile Printer: Direct Thermal, ความละเอียด ≥203 dpi, ความเร็ว ≥50
              มม./วินาที, Bluetooth และรองรับ Android/iOS
            </li>
            <li>
              รุ่น Printer ที่เอกสารยกตัวอย่าง: ZEBRA ZQ521/RW420, TSC
              Alpha-40L/Alpha-4L, RONGTA RBS04, SEWOO LK-P400, HONEYWELL RP4e,
              O'NEIL RL4e
            </li>
            <li>Clip-on ammeter สำหรับกรณีที่กำหนด</li>
            <li>
              กระดาษ Thermal/แบบฟอร์ม Spot Bill ขนาด 4×11 นิ้ว
              และเครื่องแต่งกายตามแบบ
            </li>
          </ul>
          <p className="mt-2">
            หน้าเสนอราคาปัจจุบันคิดอุปกรณ์จากพนักงาน 11 คน สำรอง 5% ยกเว้น Clip
            amp และบวก VAT 7%
          </p>
        </InfoCard>
        <InfoCard title="ข้อกำหนดด้านอุปกรณ์/บุคลากร">
          <ul>
            <li>
              ต้องจัดเตรียม Smartphone, Printer, Clip-on ammeter และอุปกรณ์เอง
              พร้อมใช้งานและปลอดภัย
            </li>
            <li>
              ต้องใช้อุปกรณ์และพนักงานให้ตรงกับรายการที่แจ้ง/ยื่น
              และแจ้งการเปลี่ยนแปลงตามขั้นตอน
            </li>
            <li>
              เครื่องแต่งกายกำหนดเสื้อแขนยาวสีกรมท่า แถบสีเทา
              พร้อมชื่อบริษัท/ข้อความปฏิบัติงานด้านมิเตอร์ตามแบบ
            </li>
            <li>
              อบรมทบทวนอย่างน้อยปีละครั้ง และสลับสายจดหน่วยทุก 6 เดือน
              ไม่น้อยกว่า 50%
            </li>
            <li>
              แบบฟอร์ม Spot Bill ต้องเป็นกระดาษ Thermal ต่อเนื่องตาม
              Specification ในเอกสารแนบ
            </li>
          </ul>
        </InfoCard>
      </div>
    ),
    notes: (
      <>
        <InfoCard title="ข้อมูลประกาศไซด์จตุรัสที่บันทึกแล้ว">
          <ol>
            <li>
              ประกาศงานจดหน่วยพร้อมแจ้งค่าไฟฟ้า กฟส.จตุรัส ครั้งที่ 1/2569
            </li>
            <li>
              45,645 เครื่อง/เดือน: จานหมุน 40,690, Electronic 4,718, TOU 237,
              AMI 0
            </li>
            <li>
              ราคากลางสูงสุด: จานหมุน 6.60, Electronic 5.92, TOU 12.40, AMI 4.60
              บาท/เครื่อง
            </li>
            <li>
              วงเงินประมาณการ 299,423.36 บาท/เดือน และ 10,779,240.96 บาท/36 รอบ
            </li>
            <li>
              ทำงาน 10 วัน/เดือน • พนักงานและเครื่องจดหน่วยอย่างน้อย 11
              คน/เครื่องต่อวัน
            </li>
          </ol>
        </InfoCard>
        <InfoCard title="สมมติฐานต้นทุนที่เราตกลงแล้ว">
          <ol>
            <li>ค่าแรง 3.50 บาท/ราย</li>
            <li>อุปกรณ์ทั่วไปสำรอง 5% ปัดขึ้น ยกเว้น Clip amp ไม่สำรอง</li>
            <li>กระดาษ: ราคาต่อแผ่น × จำนวนราย + สำรอง 5% แล้วบวก VAT 7%</li>
            <li>ของซื้อ/อุปกรณ์คิด VAT 7%</li>
            <li>เงินสดย่อย 2,000 บาท/เดือน</li>
            <li>
              มีช่องค่าเช่าสำนักงาน ค่าน้ำ อินเทอร์เน็ต ค่าปรับ ค่าเดินทาง
              QC/Staff และค่าใช้จ่ายอื่นให้ปรับได้
            </li>
          </ol>
        </InfoCard>
        <InfoCard title="หลักประกันที่คำนวณแล้ว">
          <ul>
            <li>หลักประกันเสนอค่าตอบแทน 45,645 บาท</li>
            <li>หลักประกันสัญญา 912,900 บาท</li>
            <li>แยกเงินหลักประกันออกจากต้นทุนและกำไร</li>
          </ul>
        </InfoCard>
        <InfoCard title="ข้อมูลจากหลักเกณฑ์ 26 หน้าที่เพิ่มเข้าระบบ">
          <ul>
            <li>สัญญาไม่เกิน 36 รอบ และมีการประเมินผลรายปี</li>
            <li>ขั้นตอนจดหน่วย/ตรวจผิดปกติ/QC ผ่าน MRM ก่อนส่ง SAP</li>
            <li>
              เพิ่มรายละเอียดค่าปรับเรื่องใบแจ้งสูญหาย, Barcode/QR,
              การส่งข้อมูลล่าช้า และการใช้บุคลากร/อุปกรณ์ไม่ตรงรายการ
            </li>
            <li>
              เพิ่ม Specification Smartphone, Mobile Printer, กระดาษ Spot Bill
              และเครื่องแต่งกาย
            </li>
            <li>
              เอกสารยังมีตารางรหัสผิดปกติและแบบฟอร์มการโอนเงิน
              ซึ่งเก็บไว้เป็นข้อมูลอ้างอิงสำหรับขยายระบบต่อ
            </li>
          </ul>
          <p className="mt-2">
            ราคาที่จะเสนอจริงและต้นทุนจริงยังสามารถปรับต่อได้โดยไม่เปลี่ยนโครงสร้างหลัก
          </p>
        </InfoCard>
      </>
    ),
  };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="printHeader">
        <div>
          <b>DIVERGENT CORPORATION</b>
          <h1>รายงาน {menuLabel}</h1>
          <p>{printSite}</p>
        </div>
        <div className="printMeta">
          จัดพิมพ์จากระบบบริหารต้นทุนและเสนอราคา
          <br />
          ข้อมูล ณ วันที่พิมพ์รายงาน
        </div>
      </div>
      <header className="dvHero noPrint">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-wrap justify-between gap-4">
          <div>
            <div className="dvKicker">
              DIVERGENT CORPORATION
            </div>
            <h1 className="text-2xl font-bold mt-1">
              Executive Profit & Bid Center
            </h1>
            <p className="text-sm text-slate-500">
              ศูนย์วิเคราะห์ต้นทุน การเสนอราคา และความเสี่ยง
            </p>
          </div>
        </div>
      </header>
      <div className="appShell">
        <aside className="siteSidebar noPrint">
          <div className="siteTitle">ไซด์งาน (กฟฟ.)</div>
          {siteMenus.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMenu(key)}
              className={'siteBtn ' + (menu === key ? 'siteActive' : '')}
            >
              <Gavel size={17} />
              <span>{label}</span>
              <b>›</b>
            </button>
          ))}
        </aside>
        <div className="appMain">
          <nav className="bg-white border-b sticky top-0 z-10">
            <div className="max-w-7xl mx-auto p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {menus.map(([key, label, desc, Icon]) => (
                <button
                  key={key}
                  onClick={() => setMenu(key)}
                  className={'menuBtn ' + (menu === key ? 'menuActive' : '')}
                >
                  <Icon size={18} />
                  <span>
                    <b>{label}</b>
                    <small>{desc}</small>
                  </span>
                </button>
              ))}
            </div>
          </nav>
          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 flex justify-end noPrint">
            <button type="button" onClick={printReport} className="printBtn">
              <Printer size={17} />
              พิมพ์รายงานหน้านี้
            </button>
          </div>
          <main className="reportBody max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            {menu === 'original' ? (
              Original()
            ) : menu === 'bid' ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold">จตุรัส</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    ไซด์งานเสนอราคา — จตุรัส ครั้งที่ 1/2569
                  </p>
                </div>
                {Bid()}
              </>
            ) : menu === 'prasat' ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold">ปราสาท</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    ไซด์งานเสนอราคา — ปราสาท ครั้งที่ 1/2569
                  </p>
                </div>
                {Prasat()}
              </>
            ) : menu === 'phayak' ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold">พยัคฆภูมิพิสัย</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    ไซด์งานเสนอราคา — พยัคฆภูมิพิสัย ครั้งที่ 1/2569
                  </p>
                </div>
                {Phayak()}
              </>
            ) : menu === 'phutthaisong' ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold">พุทไธสง</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    ไซด์งานเสนอราคา — พุทไธสง ครั้งที่ 1/2569
                  </p>
                </div>
                {Phutthaisong()}
              </>
            ) : menu === 'mahasarakham' ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold">มหาชนะชัย</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    ไซด์งานเสนอราคา — มหาชนะชัย ครั้งที่ 1/2569
                  </p>
                </div>
                {Mahasarakham()}
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-2xl font-bold">
                    {menus.find((x) => x[0] === menu)?.[1]}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {menus.find((x) => x[0] === menu)?.[2]}
                  </p>
                </div>
                {content[menu]}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
export default App;
