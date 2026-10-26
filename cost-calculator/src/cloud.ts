const ENDPOINT =
  'https://neauzvqroaszvqffahkv.functions.supabase.co/system-cost-api';
const PENDING_KEY = 'system-cost:pending:v1';
const RECOVERY_KEY = 'system-cost:recovery:v1';
try {
  const previous = window.localStorage.getItem(PENDING_KEY);
  if (previous && !window.localStorage.getItem(RECOVERY_KEY)) {
    window.localStorage.setItem(RECOVERY_KEY, previous);
  }
} catch {
  /* Storage may be disabled; the in-memory workflow still works. */
}
type Row = { key: string; value: unknown; revision: number };
const records = new Map<string, Row>();
const pending = new Map<string, string>();
const listeners = new Set<() => void>();
let status = 'กำลังโหลดข้อมูลจากฐานข้อมูลกลาง';
let failure = '';
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let initialization: Promise<void> | null = null;

function notify(message: string) {
  status = message;
  listeners.forEach((listener) => listener());
}
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getStatus = () => status;
export const storageKeys = () => [...records.keys()];
export function hasRecoverableDraft() {
  try {
    return Boolean(window.localStorage.getItem(RECOVERY_KEY));
  } catch {
    return false;
  }
}
export async function recoverDraft() {
  const saved = JSON.parse(window.localStorage.getItem(RECOVERY_KEY) || '{}');
  for (const [key, value] of Object.entries(saved)) {
    if (
      (validKey(key) || /^scenario:[a-zA-Z0-9_-]+$/.test(key)) &&
      typeof value === 'string'
    )
      cloudStorage.setItem(key, value);
  }
  await flush();
  window.localStorage.removeItem(RECOVERY_KEY);
}

async function call(body: unknown) {
  const token =
    window.localStorage.getItem('divergent_web_session_token_v1') ||
    window.localStorage.getItem('divergent_fallback_session_token');
  if (!token) throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลที่เมนูหลักก่อน');
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409)
      throw new Error(
        'ข้อมูลถูกแก้ไขจากอีกหน้าจอ กรุณาดาวน์โหลดร่างก่อน แล้วโหลดหน้าใหม่',
      );
    if (response.status === 401 || response.status === 403)
      throw new Error('กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลที่ยังใช้งานได้');
    throw new Error('ติดต่อฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
  return data;
}

export function initialize() {
  if (!initialization)
    initialization = (async () => {
      const { items } = await call({ action: 'list' });
      for (const item of items as Row[]) records.set(item.key, item);
      notify('เชื่อมต่อฐานข้อมูลกลางแล้ว');
    })();
  return initialization;
}

function persistPending() {
  try {
    if (pending.size)
      window.localStorage.setItem(
        PENDING_KEY,
        JSON.stringify(Object.fromEntries(pending)),
      );
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* The visible error and in-memory draft remain available. */
  }
}

export const cloudStorage = {
  getItem(key: string) {
    if (pending.has(key)) return pending.get(key)!;
    const row = records.get(key);
    return row?.value == null ? null : JSON.stringify(row.value);
  },
  setItem(key: string, value: string) {
    if (cloudStorage.getItem(key) === value) return;
    const parsed: unknown = JSON.parse(value);
    const previous = records.get(key);
    records.set(key, { key, value: parsed, revision: previous?.revision || 0 });
    pending.set(key, value);
    persistPending();
    notify('มีข้อมูลกำลังรอบันทึกลงฐานข้อมูลกลาง');
    clearTimeout(timer);
    timer = setTimeout(() => {
      void flush().catch(() => {});
    }, 600);
  },
};

export async function flush(): Promise<void> {
  clearTimeout(timer);
  if (running) await running;
  if (!pending.size) return;
  failure = '';
  running = (async () => {
    notify('กำลังบันทึกลงฐานข้อมูลกลาง…');
    try {
      while (pending.size) {
        const [key, value] = pending.entries().next().value!;
        const { item } = await call({
          action: 'save',
          key,
          value: JSON.parse(value),
          revision: records.get(key)?.revision || 0,
        });
        const latest = pending.get(key);
        records.set(key, {
          ...item,
          value: latest === value ? item.value : JSON.parse(latest!),
        });
        if (latest === value) pending.delete(key);
        persistPending();
      }
      notify('บันทึกข้อมูลในฐานข้อมูลกลางแล้ว');
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
      notify('ยังบันทึกไม่สำเร็จ: ' + failure);
      throw e;
    }
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

export function hasPending() {
  return pending.size > 0;
}
export function exportData() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: 'system-cost-v1',
          records: Object.fromEntries(
            storageKeys().map((key) => [key, cloudStorage.getItem(key)]),
          ),
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'system-cost-backup.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const validKey = (key: string) =>
  /^(?:site-(?:bid-prices|bid-draft|operating|monthly-buys|equipment)-[a-z]+|epc:electricity-notice:v1(?::site:[a-z0-9-]+)?)$/.test(
    key,
  );
export async function importData(payload: {
  records?: Record<string, string>;
  scenarios?: Record<string, unknown>[];
}) {
  let imported = 0;
  for (const [key, value] of Object.entries(payload.records || {})) {
    if (!validKey(key) || records.has(key)) continue; // Preserve destination data, including tombstones.
    if (typeof value !== 'string' || value.length > 100_000) continue;
    JSON.parse(value);
    cloudStorage.setItem(key, value);
    imported++;
  }
  for (const scenario of payload.scenarios || []) {
    const id = String(scenario.id || '');
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) continue;
    const key = 'scenario:' + id;
    if (records.has(key)) continue;
    cloudStorage.setItem(key, JSON.stringify(scenario));
    imported++;
  }
  await flush();
  return imported;
}

export const api = {
  async get(_path: string) {
    return {
      data: {
        items: storageKeys()
          .filter((key) => key.startsWith('scenario:'))
          .map((key) => records.get(key)?.value)
          .filter(Boolean),
      },
    };
  },
  async post(_path: string, data: Record<string, unknown>) {
    const id = crypto.randomUUID();
    cloudStorage.setItem(
      'scenario:' + id,
      JSON.stringify({ ...data, id, createdAt: new Date().toISOString() }),
    );
    await flush();
    return { data: { id } };
  },
  async put(path: string, data: Record<string, unknown>) {
    const id = path.split('/').pop()!;
    const current = records.get('scenario:' + id)?.value as
      | Record<string, unknown>
      | undefined;
    cloudStorage.setItem(
      'scenario:' + id,
      JSON.stringify({
        ...current,
        ...data,
        id,
        updatedAt: new Date().toISOString(),
      }),
    );
    await flush();
  },
  async delete(path: string) {
    cloudStorage.setItem('scenario:' + path.split('/').pop(), 'null');
    await flush();
  },
};

window.addEventListener('beforeunload', (event) => {
  if (pending.size) {
    event.preventDefault();
    event.returnValue = '';
  }
});
