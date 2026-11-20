-- เมนูค้ำประกันสัญญา: ข้อมูลสัญญาของไซด์ที่ชนะประมูล (notice_bids) ตามไฟล์ LG-ตราสาร2570.xlsx
--   ชีต LG2570      : ชื่อการไฟฟ้า, เลขที่สัญญา, ลว., เงินค้ำประกัน, ระยะเวลา  (+ lg_done = ออกหนังสือค้ำ LG แล้ว)
--   ชีต ตราสาร2570  : + เลขผู้เสียภาษี, สาขาที่, ที่อยู่, ค่าจ้าง(ไม่รวม VAT)   (+ stamp_done = ทำตราสาร/อากรแล้ว)
-- เงินค้ำประกัน = ค่าจ้าง × 1.07 × 5% ปัดขึ้นเป็นบาท (ตามไฟล์: 302,400 → 16,179) แก้เองได้
-- เข้าถึงผ่าน edge function contract-guarantee-api เท่านั้น (admin)

create table if not exists public.contract_guarantees (
  notice_bid_id bigint primary key references public.notice_bids(id) on delete cascade,
  pea_name text,                 -- ชื่อการไฟฟ้า (คู่สัญญา)
  tax_id text,                   -- เลขผู้เสียภาษี
  branch_no text,                -- สาขาที่
  address text,                  -- ที่อยู่
  contract_no text,              -- เลขที่สัญญา
  contract_date date,            -- ลว.
  wage_ex_vat numeric(14,2),     -- ค่าจ้าง (ไม่รวม VAT)
  guarantee numeric(14,2),       -- เงินค้ำประกัน
  period text,                   -- ระยะเวลา
  lg_done boolean not null default false,
  stamp_done boolean not null default false,
  note text,
  list_no int,                   -- ลำดับในตาราง (ตามลำดับที่บันทึก เหมือนไฟล์ Excel)
  updated_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contract_guarantees enable row level security;
comment on table public.contract_guarantees is 'เมนูค้ำประกันสัญญา: เลขที่สัญญา ค่าจ้าง เงินค้ำประกัน LG/ตราสาร ของไซด์ที่ชนะประมูล (เข้าถึงผ่าน contract-guarantee-api เท่านั้น)';

-- 6 รายการจากไฟล์ LG-ตราสาร2570.xlsx (2026-11-20); ค่าจ้างของ ประโคนชัย/โชคชัย/พุทไธสง = จำนวนราย × ราคาที่ชนะ (ตรงกับเงินค้ำในไฟล์)
insert into public.contract_guarantees (notice_bid_id, pea_name, tax_id, branch_no, address, contract_no, contract_date, wage_ex_vat, guarantee, period, lg_done, stamp_done, list_no)
select v.* from (values
  (4::bigint,  'การไฟฟ้าส่วนภูมิภาคอำเภอหนองบุญมาก', '0994000165501', '00602', '399 หมู่ 4 ตำบลหนองหัวแรต อำเภอหนองบุญมาก จังหวัดนครราชสีมา 30410', '024/2569', date '2026-11-19', 302400::numeric, 16179::numeric, '1/1/2570-31/12/2570', true, true, 1),
  (1,  'การไฟฟ้าส่วนภูมิภาคอำเภอปักธงชัย', '0994000165501', '00180', '17 ม.8 ต.เมืองปัก อ.ปักธงชัย จ.นครราชสีมา 30150', 'จ.ปธ.(บร)2040/2569', date '2026-11-19', 409200, 21893, '1/1/2570-31/12/2570', true, true, 2),
  (84, 'การไฟฟ้าส่วนภูมิภาคสาขาเมืองนครราชสีมา3(สุรนารี)', '0994000165501', '00919', '3 หมู่ที่ 2 ต.บ้านใหม่ อ.เมือง จ.นครราชสีมา 30000', '(จ)029/2569', date '2026-11-19', 834000, 44619, '1/1/2570-31/12/2570', true, true, 3),
  (40, 'การไฟฟ้าส่วนภูมิภาคสาขาประโคนชัย', '0994000165501', null, null, null, date '2026-11-20', 482460, 25812, '1/1/2570-31/12/2570', true, false, 4),
  (8,  'การไฟฟ้าส่วนภูมิภาคสาขาโชคชัย', '0994000165501', null, null, null, null, 361440, 19338, '1/1/2570-31/12/2570', true, false, 5),
  (31, 'การไฟฟ้าส่วนภูมิภาคสาขาพุทไธสง', '0994000165501', null, null, 'ฉ.3พธ.(บง.)003/2569', date '2026-11-20', 347760, 18606, '1/1/2570-31/12/2570', true, false, 6)
) as v(notice_bid_id, pea_name, tax_id, branch_no, address, contract_no, contract_date, wage_ex_vat, guarantee, period, lg_done, stamp_done, list_no)
where exists (select 1 from public.notice_bids b where b.id = v.notice_bid_id)
on conflict (notice_bid_id) do nothing;
