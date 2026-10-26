// Same file-name format as the main app (js/file-name.js): <name>_<DD-MM-YYYY Buddhist year>, Bangkok date of the save.
export function fileDate(d = new Date()): string {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d))
    p[x.type] = x.value;
  return p.day + '-' + p.month + '-' + (Number(p.year) + 543);
}

export function datedFileName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|\r\n\t]+/g, '-').replace(/\s+/g, ' ').trim();
  return (base || 'ไฟล์') + '_' + fileDate();
}

// window.print() saves to PDF under document.title, so name it for the duration of the print.
export function printAs(name: string): void {
  const old = document.title;
  let done = false;
  const restore = () => {
    if (!done) {
      done = true;
      document.title = old;
    }
  };
  document.title = datedFileName(name);
  window.addEventListener('afterprint', restore, { once: true });
  window.print();
  setTimeout(restore, 60000);
}
