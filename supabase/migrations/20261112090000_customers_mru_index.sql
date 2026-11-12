-- ค้นหาพิกัดตำแหน่ง: หาบ้านข้างเคียงในสาย MRU เดียวกัน (mru LIKE 'ROUTE-%') โดยไม่ต้อง seq scan 1 ล้านแถว
create index if not exists idx_customers_mru_pattern on public.customers (mru text_pattern_ops);
