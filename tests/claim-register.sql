-- Rollback-only checks; no test business records survive.
begin;
set local role service_role;
do $$
declare a jsonb; b jsonb; rid uuid; req uuid:=gen_random_uuid(); denied boolean:=false; n integer; orig jsonb; legacy_id uuid;
begin
 a=public.claim_register_write(1,req,'create','{"agency":"TEST rollback only","report_year":2569,"report_month":9,"bill_count":10,"claim_cents":1000000,"claim_date":"2026-09-12"}');
 rid=(a->>'record_id')::uuid;
 b=public.claim_register_write(1,req,'create','{"agency":"TEST rollback only","report_year":2569,"report_month":9,"bill_count":10,"claim_cents":1000000,"claim_date":"2026-09-12"}');
 assert a=b,'idempotency failed';
 perform public.claim_register_write(1,gen_random_uuid(),'update',jsonb_build_object('record_id',rid,'revision',1,'agency','TEST updated','report_year',2569,'report_month',9,'bill_count',10,'claim_cents',1000000,'claim_date','2026-09-12'));
 req=gen_random_uuid();a=public.claim_register_write(1,req,'receive',jsonb_build_object('record_id',rid,'amount_cents',300000,'fine_cents',0,'received_on','2026-09-12'));
 b=public.claim_register_write(1,req,'receive',jsonb_build_object('record_id',rid,'amount_cents',300000,'fine_cents',0,'received_on','2026-09-12'));
 select count(*) into n from public.claim_register_receipts where record_id=rid;assert n=1,'receipt retry duplicated';
 assert (select claim_cents-opening_received_cents-opening_fine_cents-(select sum(amount_cents+fine_cents) from public.claim_register_receipts where record_id=rid) from public.claim_register_records where id=rid)=700000,'partial total wrong';
 perform public.claim_register_write(1,gen_random_uuid(),'receive',jsonb_build_object('record_id',rid,'amount_cents',650000,'fine_cents',50000,'received_on','2026-09-12'));
 assert (select sum(amount_cents+fine_cents) from public.claim_register_receipts where record_id=rid)=1000000,'full receipt total wrong';
 begin perform public.claim_register_write(1,gen_random_uuid(),'receive',jsonb_build_object('record_id',rid,'amount_cents',1,'fine_cents',0,'received_on','2026-09-12'));exception when others then denied=sqlerrm='AMOUNT_EXCEEDS_CLAIM';end;assert denied,'overpayment allowed';
 denied=false;begin perform public.claim_register_write(14,gen_random_uuid(),'create','{"agency":"denied","report_year":2569,"report_month":9,"bill_count":1,"claim_cents":100,"claim_date":"2026-09-12"}');exception when others then denied=sqlerrm='ACCESS_DENIED';end;assert denied,'unauthorized actor allowed';
 denied=false;begin perform public.claim_register_write(1,gen_random_uuid(),'update',jsonb_build_object('record_id',rid,'revision',4,'agency','bad'));exception when others then denied=sqlerrm='CLAIM_LOCKED';end;assert denied,'paid claim edited';
 select id,source_data into legacy_id,orig from public.claim_register_records where category='arrears' and source_row=2;
 denied=false;begin perform public.claim_register_write(1,gen_random_uuid(),'receive',jsonb_build_object('record_id',legacy_id,'amount_cents',100,'fine_cents',0,'received_on','2026-09-12'));exception when others then denied=sqlerrm='REVIEW_REQUIRED';end;assert denied,'unreviewed amount changed';
 perform public.claim_register_write(1,gen_random_uuid(),'reconcile',jsonb_build_object('record_id',legacy_id,'revision',1,'claim_cents',7261555,'opening_received_cents',0,'opening_fine_cents',0,'reason','rollback test only'));
 assert (select source_data from public.claim_register_records where id=legacy_id)=orig,'source overwritten';
 assert (select count(*) from public.claim_register_records where source_hash is not null)=206,'source count changed';
end $$;
reset role;
set local role anon;
do $$ declare denied boolean:=false;begin
 begin perform count(*) from public.claim_register_records;exception when insufficient_privilege then denied=true;end;assert denied,'anonymous data exposed';
 denied=false;begin perform public.claim_register_write(1,gen_random_uuid(),'create','{}');exception when insufficient_privilege then denied=true;end;assert denied,'anonymous write exposed';
end $$;
reset role;
set local role authenticated;
do $$ declare denied boolean:=false;begin
 begin perform count(*) from public.claim_register_records;exception when insufficient_privilege then denied=true;end;assert denied,'direct data API exposed';
end $$;
rollback;
