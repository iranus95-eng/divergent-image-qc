// pure helpers (no imports) so node tests can load them
export const FAR_M = 1000;
export type Pt = { lat: number; lng: number };
export function haversine(a: Pt, b: Pt) {
  const R = 6371000, r = Math.PI / 180;
  const x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
export const validPt = (lat: unknown, lng: unknown) => {
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && a > 5 && a < 21 && b > 97 && b < 106 ? { lat: a, lng: b } : null;
};
export function parseMru(v: unknown) {
  const m = String(v ?? "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z]{4}\d{4})-?(\d{6})$/);
  return m ? { route: m[1], seq: Number(m[2]), mru: `${m[1]}-${m[2]}` } : null;
}
export const hasMoo = (addr: string) => /(?:ม\.|หมู่(?:ที่)?)\s*\d/.test(addr);
export const cleanAddress = (addr: string) => String(addr || "").replace(/\(\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*\)\s*$/, "").replace(/\s+/g, " ").trim();

export const OUTLIER_M = 5000;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/* ตัดจุดที่อยู่ห่างกลางสายเกิน 5 กม. (พิกัดที่ลงผิด เช่นหลายรายใช้จุดเดียวกันไกลจากหมู่บ้าน) */
export function dropOutliers<T extends { pt: Pt }>(rows: T[]) {
  if (rows.length < 5) return rows;
  const c = { lat: median(rows.map((r) => r.pt.lat)), lng: median(rows.map((r) => r.pt.lng)) };
  return rows.filter((r) => haversine(r.pt, c) <= OUTLIER_M);
}
/* บ้านข้างเคียง: เรียงตามเลขลำดับ MRU แล้วเลือกที่ใกล้ที่สุดก่อน/หลัง (ไม่นับตัวเอง) */
export function pickNeighbours(rows: any[], seq: number, ca: string, n = 2) {
  const ok = dropOutliers(rows.map((r) => ({ ...r, p: parseMru(r.mru), pt: validPt(r.latitude, r.longitude) }))
    .filter((r) => r.p && r.pt) as any[])
    .filter((r: any) => String(r.ca) !== ca && r.p.seq !== seq);
  const before = ok.filter((r) => r.p.seq < seq).sort((a, b) => b.p.seq - a.p.seq).slice(0, n);
  const after = ok.filter((r) => r.p.seq > seq).sort((a, b) => a.p.seq - b.p.seq).slice(0, n);
  const near = [before[0], after[0]].filter(Boolean);
  const estimate = near.length ? { lat: near.reduce((s, r) => s + r.pt.lat, 0) / near.length, lng: near.reduce((s, r) => s + r.pt.lng, 0) / near.length } : null;
  const spread_m = near.length === 2 ? haversine(near[0].pt, near[1].pt) : null;
  const out = (r: any) => ({ mru: r.p.mru, ca: r.ca, address: cleanAddress(r.address), lat: r.pt.lat, lng: r.pt.lng });
  return { before: before.map(out), after: after.map(out), estimate, spread_m };
}

