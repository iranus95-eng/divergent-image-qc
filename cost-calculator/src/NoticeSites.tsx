import { useCallback, useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import NoticeCalculator, { type BidSource } from './NoticeCalculator';
import { loadNoticeBids } from './cloud';

type Site = BidSource & { id: string; name: string; status: string | null };

export default function NoticeSites({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    let active = true;
    loadNoticeBids()
      .then((bids) => {
        if (!active) return;
        // Only offices with a budget and a ราคากลาง can be costed.
        const list = bids
          .filter(
            (bid) =>
              bid.site && (bid.budget ?? 0) > 0 && (bid.mid_price ?? 0) > 0,
          )
          .map((bid) => ({
            id: 'bid-' + bid.id,
            name: bid.site,
            status: bid.status,
            bidId: bid.id,
            budget: bid.budget!,
            price: bid.mid_price!,
            auction: bid.price_bid ?? bid.mid_price!,
          }));
        setSites(list);
        setActiveId(list[0]?.id || '');
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const reportDirty = useCallback(
    (next: boolean) => {
      setDirty(next);
      onDirtyChange(next);
    },
    [onDirtyChange],
  );
  const selectSite = (id: string) => {
    if (id === activeId) return;
    if (
      dirty &&
      !window.confirm(
        'ไซด์นี้มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนไซด์โดยไม่บันทึกหรือไม่? กดยกเลิกเพื่อกลับไปบันทึก',
      )
    )
      return;
    reportDirty(false);
    setActiveId(id);
  };
  if (error)
    return (
      <p role="alert" className="mt-6 text-red-700">
        โหลดไซด์งานจากตารางประมูลแจ้งเตือนไม่สำเร็จ: {error}
      </p>
    );
  if (!sites)
    return <p className="mt-6">กำลังโหลดไซด์งานจากตารางประมูลแจ้งเตือน…</p>;
  if (!sites.length)
    return (
      <p className="mt-6">
        ยังไม่มีไซด์งานที่มีงบประมาณและราคากลางในตารางประมูลแจ้งเตือน
      </p>
    );
  const active = sites.find((site) => site.id === activeId) || sites[0];
  return (
    <div className="noticeTheme appShell mt-4 rounded-2xl border border-slate-200 overflow-hidden">
      <aside className="siteSidebar noPrint" aria-label="ไซด์งานใบแจ้งเตือน">
        <div className="siteTitle">
          ไซด์งาน (ตารางประมูลแจ้งเตือน) · {sites.length}
        </div>
        {sites.map((site) => (
          <button
            type="button"
            key={site.id}
            onClick={() => selectSite(site.id)}
            aria-current={active.id === site.id ? 'page' : undefined}
            className={'siteBtn ' + (active.id === site.id ? 'siteActive' : '')}
          >
            <Gavel size={17} />
            <span>
              {site.name}
              {site.status && <small className="siteTag">{site.status}</small>}
            </span>
            <b aria-hidden="true">›</b>
          </button>
        ))}
      </aside>
      <div className="appMain px-3 sm:px-6 pb-6">
        <NoticeCalculator
          key={active.id}
          siteId={active.id}
          siteName={active.name}
          bid={active}
          onDirtyChange={reportDirty}
        />
      </div>
    </div>
  );
}
