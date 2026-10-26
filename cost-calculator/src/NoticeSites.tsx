import { useCallback, useState } from 'react';
import { Gavel } from 'lucide-react';
import NoticeCalculator from './NoticeCalculator';

const sites = [
  { id: 'chok-chai', name: 'โชคชัย', monthlyJobs: 6420, sourceCell: 'F2' },
  { id: 'non-thai', name: 'โนนไทย', monthlyJobs: 5885, sourceCell: 'F3' },
  { id: 'nm1', name: 'นม1', monthlyJobs: 14980, sourceCell: 'F4' },
  { id: 'nm3', name: 'นม3', monthlyJobs: 14980, sourceCell: 'F5' },
  { id: 'nang-rong', name: 'นางรอง', monthlyJobs: 10700, sourceCell: 'F6' },
  { id: 'prasat', name: 'ปราสาท', monthlyJobs: 10700, sourceCell: 'F7' },
  {
    id: 'pak-thong-chai',
    name: 'ปักธงชัย',
    monthlyJobs: 5885,
    sourceCell: 'F8',
  },
  { id: 'phimai', name: 'พิมาย', monthlyJobs: 6420, sourceCell: 'F9' },
  { id: 'surin', name: 'สุรินทร์', monthlyJobs: 26750, sourceCell: 'F10' },
];

export default function NoticeSites({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [activeId, setActiveId] = useState(sites[0].id);
  const [dirty, setDirty] = useState(false);
  const active = sites.find((site) => site.id === activeId)!;
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
  return (
    <div className="noticeTheme appShell mt-4 rounded-2xl border border-slate-200 overflow-hidden">
      <aside className="siteSidebar noPrint" aria-label="ไซด์งานใบแจ้งเตือน">
        <div className="siteTitle">ไซด์งาน (ใบแจ้งเตือน)</div>
        {sites.map((site) => (
          <button
            type="button"
            key={site.id}
            onClick={() => selectSite(site.id)}
            aria-current={activeId === site.id ? 'page' : undefined}
            className={'siteBtn ' + (activeId === site.id ? 'siteActive' : '')}
          >
            <Gavel size={17} />
            <span>{site.name}</span>
            <b aria-hidden="true">›</b>
          </button>
        ))}
      </aside>
      <div className="appMain px-3 sm:px-6 pb-6">
        <NoticeCalculator
          key={active.id}
          siteId={active.id}
          siteName={active.name}
          initialJobs={active.monthlyJobs}
          sourceCell={active.sourceCell}
          onDirtyChange={reportDirty}
        />
      </div>
    </div>
  );
}
