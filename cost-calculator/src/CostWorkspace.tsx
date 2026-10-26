import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  exportData,
  flush,
  getStatus,
  hasRecoverableDraft,
  recoverDraft,
  hasUnsaved,
  importData,
  initialize,
  saveAll,
  subscribe,
} from './cloud';

const ProjectGateway = lazy(() => import('./ProjectGateway'));
const LEGACY = 'https://executive-profit-calculator-8dgqol.v2.appdeploy.ai';

export default function CostWorkspace() {
  const [recovery, setRecovery] = useState(hasRecoverableDraft);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [migration, setMigration] = useState('');
  const [importing, setImporting] = useState(false);
  const popup = useRef<Window | null>(null);
  const status = useSyncExternalStore(subscribe, getStatus);
  const unsaved = useSyncExternalStore(subscribe, hasUnsaved);
  useEffect(() => {
    let active = true;
    initialize()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const receive = async (event: MessageEvent) => {
      if (
        event.origin !== LEGACY ||
        event.source !== popup.current ||
        event.data?.type !== 'system-cost-transfer-v1'
      )
        return;
      setImporting(true);
      try {
        const count = await importData(event.data.payload);
        setMigration(
          'นำเข้าข้อมูลเดิม ' +
            count +
            ' รายการแล้ว (เก็บข้อมูลที่มีอยู่ในระบบใหม่ไว้) กดโหลดข้อมูลใหม่เพื่อแสดงค่าที่นำเข้า',
        );
        popup.current?.postMessage(
          { type: 'system-cost-transfer-complete' },
          LEGACY,
        );
      } catch (e) {
        setMigration(
          'นำเข้าไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)),
        );
      } finally {
        setImporting(false);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  const openImport = () => {
    popup.current = window.open(
      LEGACY + '/#transfer-cost-data',
      'system-cost-transfer',
      'width=760,height=700',
    );
    if (!popup.current)
      setMigration(
        'เบราว์เซอร์บล็อกหน้าต่าง กรุณาอนุญาตป๊อปอัปแล้วกดนำเข้าอีกครั้ง',
      );
    else
      setMigration(
        'ในหน้าต่างเว็บเดิม กดส่งข้อมูลมายังระบบใหม่ โดยใช้เบราว์เซอร์ที่เคยบันทึกข้อมูล',
      );
  };
  const reload = async () => {
    try {
      await flush();
      window.location.reload();
    } catch {
      /* Keep drafts visible. */
    }
  };
  const goHome = () => {
    if (
      hasUnsaved() &&
      !window.confirm(
        'ยังมีการแก้ไขที่ไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่? กดยกเลิกเพื่อกลับไปบันทึก',
      )
    )
      return;
    window.location.assign('/');
  };
  return (
    <div className="dv">
      <header className="noPrint dvTop">
        <div className="dvTopRow">
          <div className="dvBrand">
            <span className="dvLogo" aria-hidden="true">
              D
            </span>
            <span>
              <b>คำนวนต้นทุนระบบงาน</b>
              <small>Divergent Image Rescue</small>
            </span>
          </div>
          <button type="button" className="dvBtn" onClick={goHome}>
            ⌂ เมนูหลัก
          </button>
        </div>
      </header>
      <div className={'noPrint dvBar' + (unsaved ? ' dvBarUnsaved' : '')}>
        <div className="dvBarRow">
          <p
            role="status"
            className={
              'dvStatus ' +
              (unsaved || status.startsWith('ยัง') ? 'dvStatusWarn' : '')
            }
          >
            {status}
          </p>
          {ready && (
            <div className="dvActions">
              <button
                className="dvBtn dvSave"
                disabled={!unsaved && !status.startsWith('ยัง')}
                onClick={() => {
                  void saveAll().catch(() => {});
                }}
              >
                บันทึก
              </button>
              <button
                className="dvBtn"
                disabled={importing}
                onClick={openImport}
              >
                นำเข้าข้อมูลจากเว็บเดิม
              </button>
              <button className="dvBtn" onClick={exportData}>
                ดาวน์โหลดสำรองข้อมูล
              </button>
              <button
                className="dvBtn"
                onClick={() => {
                  void reload();
                }}
              >
                โหลดข้อมูลใหม่
              </button>
            </div>
          )}
        </div>
        {ready && recovery && (
          <div className="dvBarRow dvNotice">
            พบข้อมูลร่างที่ยังบันทึกไม่สำเร็จจากครั้งก่อน{' '}
            <button
              className="dvBtn"
              onClick={() => {
                if (
                  window.confirm(
                    'กู้คืนร่างลงฐานข้อมูลกลางแทนค่าปัจจุบันของรายการในร่างหรือไม่?',
                  )
                ) {
                  void recoverDraft()
                    .then(() => {
                      setRecovery(false);
                      window.location.reload();
                    })
                    .catch((e) => setMigration(e.message));
                }
              }}
            >
              กู้คืนร่างค้าง
            </button>
          </div>
        )}
        {migration && (
          <p className="dvBarRow dvNotice" role="status">
            {migration}
          </p>
        )}
      </div>
      {error ? (
        <main className="max-w-3xl mx-auto p-8">
          <p role="alert">{error}</p>
          <a className="underline text-sky-700" href="/">
            กลับเมนูหลักเพื่อเข้าสู่ระบบ
          </a>
        </main>
      ) : ready ? (
        <Suspense fallback={<p className="p-8">กำลังเปิดระบบคำนวณ…</p>}>
          <ProjectGateway />
        </Suspense>
      ) : (
        <p className="p-8">กำลังตรวจสอบสิทธิ์และโหลดข้อมูล…</p>
      )}
    </div>
  );
}
