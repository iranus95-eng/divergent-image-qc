import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Gavel } from 'lucide-react';
import NoticeCalculator, {
  type Allocation,
  type BidSource,
} from './NoticeCalculator';
import NoticeSummary from './NoticeSummary';
import {
  loadNoticeBids,
  loadQuotePrices,
  saveNoticeBidStatus,
  type NoticeBid,
} from './cloud';

export type Site = BidSource & { id: string; name: string; jobs: number };
type Row = {
  bid: NoticeBid;
  won: boolean;
  quotePrice: number | null;
  quoteQty: number | null; // ราย per year from the quotation
  site: Site | null; // null while the budget, ราคากลาง or winning price is missing
  missing: string;
};

const SUMMARY = 'summary';
const WON = 'ชนะประมูล';
// A site we won is marked by its status, as in ตารางประมูลแจ้งเตือน.
const isWon = (bid: NoticeBid) => String(bid.status || '').includes('ชนะ');
// Same matching as ตารางประมูลแจ้งเตือน: tone marks, spaces and the กฟส./กฟจ. prefix are ignored,
// and นครราชสีมา is written นม (so "นม3" finds "เมืองนครราชสีมา 3").
const nameKey = (text: string) =>
  String(text || '')
    .replace(/[ัิ-ฺ็-๎\s.]/g, '')
    .replace(/^(กฟส|กฟจ|กฟอ)/, '')
    .replace(/นครราชสีมา/g, 'นม');
// A quote belongs to the site of the same name, else to the longest site name inside its title.
function quoteSite(title: string, bids: NoticeBid[]) {
  const key = nameKey(title);
  return (
    bids.find((bid) => nameKey(bid.site) === key) ||
    bids
      .filter((bid) => nameKey(bid.site) && key.includes(nameKey(bid.site)))
      .sort((a, b) => nameKey(b.site).length - nameKey(a.site).length)[0]
  );
}

// A quote's quantity is per year, or per month when its column is ราย/เดือน: it is taken as
// monthly when twelve times it is nearer the bid's own estimate (budget ÷ 1.07 ÷ ราคากลาง).
function yearlyQty(qty: number | null, bid: NoticeBid) {
  if (!qty) return null;
  const estimate =
    bid.budget && bid.mid_price ? bid.budget / 1.07 / bid.mid_price : 0;
  if (!estimate) return qty;
  const off = (value: number) => Math.abs(Math.log(value / estimate));
  return off(qty * 12) < off(qty) ? qty * 12 : qty;
}

function buildRows(
  bids: NoticeBid[],
  quotes: { title: string; price: number; qty: number | null }[],
): Row[] {
  const quoteOf = new Map<number, { price: number; qty: number | null }>();
  for (const quote of quotes) {
    const bid = quoteSite(quote.title, bids);
    if (bid && !quoteOf.has(bid.id))
      quoteOf.set(bid.id, {
        price: quote.price,
        qty: yearlyQty(quote.qty, bid),
      });
  }
  return bids
    .filter((bid) => bid.site)
    .map((bid) => {
      const price = quoteOf.get(bid.id)?.price ?? null;
      const qty = quoteOf.get(bid.id)?.qty ?? null;
      // The winning unit price comes from our quotation, else ราคาปี70 of the bid table.
      const auction = price ?? (bid.price_bid || null);
      const missing = [
        !(bid.budget && bid.budget > 0) && 'งบประมาณ',
        !(bid.mid_price && bid.mid_price > 0) && 'ราคากลาง',
        !auction && 'ราคาที่ชนะ',
      ]
        .filter(Boolean)
        .join(', ');
      return {
        bid,
        won: isWon(bid),
        quotePrice: price,
        quoteQty: qty,
        missing,
        site: missing
          ? null
          : {
              id: 'bid-' + bid.id,
              name: bid.site,
              bidId: bid.id,
              budget: bid.budget!,
              price: bid.mid_price!,
              auction: auction!,
              qty,
              // ราย/เดือน: the quotation's quantity, else งบประมาณ ÷ ราคากลาง
              jobs: (qty ?? bid.budget! / bid.mid_price!) / 12,
            },
      };
    });
}

export default function NoticeSites({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState(false);
  const [activeId, setActiveId] = useState(SUMMARY);
  const [dirty, setDirty] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState(0);
  const [markError, setMarkError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      loadNoticeBids(),
      loadQuotePrices().catch(() => {
        if (active) setQuoteError(true);
        return [];
      }),
    ])
      .then(([bids, quotes]) => {
        if (active) setRows(buildRows(bids, quotes));
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
  const leaveSite = () =>
    !dirty ||
    window.confirm(
      'ไซด์นี้มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนไซด์โดยไม่บันทึกหรือไม่? กดยกเลิกเพื่อกลับไปบันทึก',
    );
  const selectSite = (id: string) => {
    if (id === activeId || !leaveSite()) return;
    reportDirty(false);
    setActiveId(id);
  };
  const toggleWon = async (row: Row) => {
    const next = row.won ? '' : WON;
    if (
      row.won &&
      !window.confirm('ยกเลิกเครื่องหมายชนะประมูลของไซด์ ' + row.bid.site + '?')
    )
      return;
    if (row.won && activeId === row.site?.id) {
      if (!leaveSite()) return;
      reportDirty(false);
      setActiveId(SUMMARY);
    }
    setBusyId(row.bid.id);
    setMarkError('');
    try {
      await saveNoticeBidStatus(row.bid.id, next);
      setRows((list) =>
        (list || []).map((item) =>
          item.bid.id === row.bid.id
            ? { ...item, won: !row.won, bid: { ...item.bid, status: next } }
            : item,
        ),
      );
    } catch (e) {
      setMarkError(
        'บันทึกสถานะไซด์ ' +
          row.bid.site +
          ' ไม่สำเร็จ: ' +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setBusyId(0);
    }
  };
  if (error)
    return (
      <p role="alert" className="mt-6 text-red-700">
        โหลดไซด์งานจากตารางประมูลแจ้งเตือนไม่สำเร็จ: {error}
      </p>
    );
  if (!rows)
    return <p className="mt-6">กำลังโหลดไซด์งานจากตารางประมูลแจ้งเตือน…</p>;
  const won = rows.filter((row) => row.won);
  // Shared costs are spread over the won sites that can be costed.
  const counted = won.flatMap((row) => (row.site ? [row.site] : []));
  const poolJobs = counted.reduce((sum, site) => sum + site.jobs, 0);
  const allocationFor = (jobs: number): Allocation => ({
    mode: 'jobs',
    otherJobs: poolJobs - jobs,
    sites: counted.length,
  });
  const active = counted.find((site) => site.id === activeId);
  const listed = showAll ? rows : won;
  return (
    <div className="noticeTheme appShell mt-4 rounded-2xl border border-slate-200 overflow-hidden">
      <aside className="siteSidebar noPrint" aria-label="ไซด์งานใบแจ้งเตือน">
        <div className="siteTitle">ไซด์ที่ชนะประมูล · {won.length}</div>
        <button
          type="button"
          onClick={() => selectSite(SUMMARY)}
          aria-current={!active ? 'page' : undefined}
          className={'siteBtn ' + (!active ? 'siteActive' : '')}
        >
          <BarChart3 size={17} />
          <span>สรุปกำไรขาดทุน</span>
          <b aria-hidden="true">›</b>
        </button>
        {listed.map((row) => (
          <div key={row.bid.id} className="siteRow">
            <label
              className="siteWon"
              title={
                row.won
                  ? 'ชนะประมูล (กดเพื่อยกเลิก)'
                  : 'ทำเครื่องหมายว่าชนะประมูล'
              }
            >
              <input
                type="checkbox"
                checked={row.won}
                disabled={busyId === row.bid.id}
                onChange={() => void toggleWon(row)}
                aria-label={'ชนะประมูล ' + row.bid.site}
              />
            </label>
            <button
              type="button"
              disabled={!row.won || !row.site}
              onClick={() => row.site && selectSite(row.site.id)}
              aria-current={active?.id === row.site?.id ? 'page' : undefined}
              className={
                'siteBtn ' +
                (row.site && active?.id === row.site.id ? 'siteActive' : '')
              }
            >
              <Gavel size={17} />
              <span>
                {row.bid.site}
                {row.won && row.missing && (
                  <small className="siteTag">ขาด{row.missing}</small>
                )}
              </span>
              <b aria-hidden="true">›</b>
            </button>
          </div>
        ))}
        <button
          type="button"
          className="siteMore"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? 'แสดงเฉพาะไซด์ที่ชนะประมูล'
            : 'เพิ่มไซด์ที่ชนะประมูล (แสดงทุกไซด์)'}
        </button>
      </aside>
      <div className="appMain px-3 sm:px-6 pb-6">
        {markError && (
          <p role="alert" className="mt-4 text-red-700">
            {markError}
          </p>
        )}
        {active ? (
          <NoticeCalculator
            key={active.id}
            siteId={active.id}
            siteName={active.name}
            bid={active}
            allocation={allocationFor(active.jobs)}
            onDirtyChange={reportDirty}
          />
        ) : (
          <NoticeSummary
            sites={counted}
            incomplete={won
              .filter((row) => !row.site)
              .map((row) => ({ name: row.bid.site, missing: row.missing }))}
            noQuote={won
              .filter((row) => row.site && row.quotePrice == null)
              .map((row) => row.bid.site)}
            noQuoteQty={won
              .filter((row) => row.site && row.quoteQty == null)
              .map((row) => row.bid.site)}
            quoteError={quoteError}
            allocationFor={allocationFor}
            onOpen={selectSite}
          />
        )}
      </div>
    </div>
  );
}
