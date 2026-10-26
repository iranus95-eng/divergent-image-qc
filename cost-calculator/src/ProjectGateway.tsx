import { useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, FileText } from 'lucide-react';
import App from './App';
import NoticeSites from './NoticeSites';

type Project = 'chooser' | 'reading' | 'notice';

export default function ProjectGateway() {
  const [project, setProject] = useState<Project>('chooser');
  const [readingOpened, setReadingOpened] = useState(false);
  const [noticeDirty, setNoticeDirty] = useState(false);
  const leaveNotice = () => {
    if (
      noticeDirty &&
      !window.confirm(
        'มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่? กดยกเลิกเพื่อกลับไปบันทึก',
      )
    )
      return;
    setNoticeDirty(false);
    setProject('chooser');
  };

  const openReading = () => {
    setReadingOpened(true);
    setProject('reading');
  };

  return (
    <>
      {project === 'chooser' && (
        <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold tracking-widest text-sky-700">
              DIVERGENT CORPORATION
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold mt-3">
              เลือกโปรเจกต์
            </h1>
            <p className="text-slate-500 mt-3">
              Executive Profit Calculator — เลือกโปรเจกต์ที่ต้องการใช้งาน
            </p>
            <div className="grid md:grid-cols-2 gap-5 mt-9">
              <button
                type="button"
                onClick={openReading}
                className="text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"
              >
                <Calculator className="text-sky-600" size={32} />
                <h2 className="text-xl font-bold mt-5">จดหน่วยแจ้งค่าไฟฟ้า</h2>
                <p className="text-sm text-slate-500 mt-3 leading-6">
                  ระบบคำนวณต้นทุน เสนอราคา กำไร และบันทึกชุดคำนวณเดิม
                </p>
                <span className="flex items-center gap-2 text-sky-700 font-bold mt-6">
                  เข้าใช้งาน <ArrowRight size={18} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setProject('notice')}
                className="text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"
              >
                <FileText className="text-slate-500" size={32} />
                <h2 className="text-xl font-bold mt-5">ใบแจ้งเตือนค่าไฟฟ้า</h2>
                <p className="text-sm text-slate-500 mt-3 leading-6">
                  คำนวณต้นทุน ค่าแรง อุปกรณ์ และกำไรงานใบแจ้งเตือน
                </p>
                <span className="flex items-center gap-2 text-sky-700 font-bold mt-6">
                  ดูรายละเอียด <ArrowRight size={18} />
                </span>
              </button>
            </div>
          </div>
        </main>
      )}
      {project === 'notice' && (
        <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <button
              type="button"
              onClick={leaveNotice}
              className="flex items-center gap-2 text-sky-700 font-semibold p-2"
            >
              <ArrowLeft size={18} />
              กลับไปเลือกโปรเจกต์
            </button>
            <NoticeSites onDirtyChange={setNoticeDirty} />
          </div>
        </main>
      )}
      {readingOpened && (
        <div
          hidden={project !== 'reading'}
          style={project !== 'reading' ? { display: 'none' } : undefined}
        >
          <div className="noPrint bg-slate-950 text-white border-b border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold">จดหน่วยแจ้งค่าไฟฟ้า</span>
            <button
              type="button"
              onClick={() => setProject('chooser')}
              className="flex items-center gap-2 rounded-lg border border-slate-500 px-3 py-2 text-sm hover:bg-slate-800"
            >
              <ArrowLeft size={16} />
              กลับไปเลือกโปรเจกต์
            </button>
          </div>
          <App />
        </div>
      )}
    </>
  );
}
