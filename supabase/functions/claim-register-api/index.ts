import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...H,"Content-Type":"application/json; charset=utf-8"}});
const fields="id,role,is_active,expires_at,can_access_qc";
export function permissions(u:any){const active=!!u&&u.is_active===true&&(!u.expires_at||Date.parse(u.expires_at)>Date.now());const admin=String(u?.role).toLowerCase()==="admin";const read=active&&(admin||u.can_access_qc===true);return {read,write:read&&(admin||["staff","user_creator"].includes(String(u.role).toLowerCase()))};}
async function user(req:Request){
 const t=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();if(!t||t.length>4096)throw Error("AUTH_REQUIRED");
 const {data:s,error}=await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token",t).maybeSingle();if(error)throw Error("DATABASE_ERROR");
 let u:any;
 if(s){if(s.is_active!==true||!s.expires_at||Date.parse(s.expires_at)<=Date.now())throw Error("AUTH_INVALID");const result=await db.from("app_users").select(fields).eq("id",s.user_id).maybeSingle();if(result.error)throw Error("DATABASE_ERROR");u=result.data;}
 else {const vr=await fetch("https://api.line.me/oauth2/v2.1/verify?access_token="+encodeURIComponent(t));const v=await vr.json().catch(()=>({}));if(!vr.ok||v.client_id!=="2011407195"||!(Number(v.expires_in)>0))throw Error("AUTH_INVALID");const pr=await fetch("https://api.line.me/v2/profile",{headers:{Authorization:"Bearer "+t}});const p=await pr.json().catch(()=>({}));if(!pr.ok||!p.userId)throw Error("AUTH_INVALID");const result=await db.from("app_users").select(fields).eq("line_user_id",p.userId).maybeSingle();if(result.error)throw Error("DATABASE_ERROR");u=result.data;}
 if(!permissions(u).read)throw Error("ACCESS_DENIED");return u;
}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validate(action:string,data:any){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID_INPUT');
 for(const k of ['claim_cents','opening_received_cents','opening_fine_cents','amount_cents','fine_cents','bill_count'])if(k in data&&(!Number.isSafeInteger(data[k])||data[k]<0||data[k]>999999999999))throw Error('INVALID_AMOUNT');
 for(const k of ['claim_date','received_on'])if(k in data){const s=data[k];if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01'||s>'2200-12-31'||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('INVALID_DATE');}
 if(action!=='create'&&!uuid(data.record_id))throw Error('INVALID_ID');
 if(action==='create'||action==='update'){if(typeof data.agency!=='string'||!data.agency.trim()||data.agency.length>200||!Number.isInteger(data.report_year)||data.report_year<2400||data.report_year>2700||!Number.isInteger(data.report_month)||data.report_month<1||data.report_month>12||!Number.isInteger(data.bill_count)||!data.claim_date||!(data.claim_cents>0))throw Error('INVALID_INPUT');}
 if(action==='receive'&&(!data.received_on||!Number.isSafeInteger(data.amount_cents)||!Number.isSafeInteger(data.fine_cents)||data.amount_cents+data.fine_cents<=0))throw Error('INVALID_INPUT');
 if(action==='reconcile'&&(!Number.isSafeInteger(data.claim_cents)||!Number.isSafeInteger(data.opening_received_cents)||!Number.isSafeInteger(data.opening_fine_cents)||typeof data.reason!=='string'||data.reason.trim().length<3))throw Error('INVALID_INPUT');
 if(data.note!==undefined&&(typeof data.note!=='string'||data.note.length>4000))throw Error('INVALID_INPUT');
}
async function queryResult(q:any){const {data,error}=await q;if(error)throw Error('DATABASE_ERROR');return data;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:H});if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const u=await user(req),access=permissions(u);
  if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
   if(!access.write)throw Error('ACCESS_DENIED');if(Number(req.headers.get('content-length'))>11000000)throw Error('FILE_TOO_LARGE');
   const form=await req.formData(),recordId=form.get('record_id'),receiptId=form.get('receipt_id'),requestId=form.get('request_id'),file=form.get('file');
   if(!uuid(recordId)||!uuid(receiptId)||!uuid(requestId)||!(file instanceof File)||file.size>10485760||file.size<5)throw Error('INVALID_ATTACHMENT');
   const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('PDF_REQUIRED');
   const receipt=await queryResult(db.from('claim_register_receipts').select('id,record_id,attachment_path').eq('id',receiptId).eq('record_id',recordId).maybeSingle());if(!receipt)throw Error('NOT_FOUND');
   if(receipt.attachment_path)return json({ok:true,attached:true});
   const path=`claims/${recordId}/${receiptId}/${requestId}.pdf`;
   const uploaded=await db.storage.from('money-reports').upload(path,bytes,{contentType:'application/pdf',upsert:false});
   if(uploaded.error&&String((uploaded.error as any).statusCode)!=='409')throw Error('UPLOAD_FAILED');
   const {error}=await db.rpc('claim_register_write',{p_actor:u.id,p_request:requestId,p_action:'attach',p_data:{record_id:recordId,receipt_id:receiptId,path,name:file.name.slice(0,200)}});if(error)throw Error('ATTACHMENT_LINK_FAILED');return json({ok:true,attached:true});
  }
  if(Number(req.headers.get('content-length'))>65536)throw Error('INVALID_INPUT');
  const b=await req.json(),action=String(b.action||'');
  if(action==='list'){
   if(!['monthly','arrears','guarantee'].includes(b.category))throw Error('INVALID_INPUT');
   const page=Number(b.page||0);if(!Number.isInteger(page)||page<0)throw Error('INVALID_INPUT');
   const records=await queryResult(db.from('claim_register_records').select('*').eq('category',b.category).order('report_year',{ascending:false}).order('report_month',{ascending:false}).order('created_at').order('id').range(page*500,page*500+499));
   let receipts:any[]=[];if(records.length){for(let p=0;;p++){const part=await queryResult(db.from('claim_register_receipts').select('*').in('record_id',records.map((r:any)=>r.id)).order('created_at').order('id').range(p*500,p*500+499));receipts.push(...part);if(part.length<500)break;}}
   return json({ok:true,access,records,receipts,has_more:records.length===500});
  }
  if(action==='history'){
   if(!uuid(b.record_id))throw Error('INVALID_ID');
   const rows=await queryResult(db.from('claim_register_audit').select('id,action,actor_id,created_at,before_data,after_data').eq('record_id',b.record_id).order('id',{ascending:false}).limit(100));return json({ok:true,rows});
  }
  if(action==='attachment'){
   if(!uuid(b.receipt_id))throw Error('INVALID_ID');const r=await queryResult(db.from('claim_register_receipts').select('attachment_path').eq('id',b.receipt_id).maybeSingle());if(!r?.attachment_path)throw Error('NOT_FOUND');const signed=await db.storage.from('money-reports').createSignedUrl(r.attachment_path,300);if(signed.error)throw Error('DOWNLOAD_FAILED');return json({ok:true,url:signed.data.signedUrl});
  }
  if(!['create','update','receive','reconcile'].includes(action))throw Error('UNKNOWN_ACTION');
  if(!access.write)throw Error('ACCESS_DENIED');if(!uuid(b.request_id))throw Error('INVALID_ID');validate(action,b.data);
  const {data,error}=await db.rpc('claim_register_write',{p_actor:u.id,p_request:b.request_id,p_action:action,p_data:b.data});
  if(error){const known=['ACCESS_DENIED','REQUEST_CONFLICT','INVALID_AMOUNT','MISSING_FIELDS','NOT_FOUND','GUARANTEE_READ_ONLY','REVISION_CONFLICT','CLAIM_LOCKED','REVIEW_REQUIRED','AMOUNT_EXCEEDS_CLAIM'];throw Error(known.includes(error.message)?error.message:'DATABASE_ERROR');}
  return json({ok:true,...data});
 }catch(e){const m=e instanceof Error?e.message:'SERVER_ERROR';const status=m.startsWith('AUTH_')?401:m==='ACCESS_DENIED'?403:m==='NOT_FOUND'?404:m.endsWith('CONFLICT')||m==='CLAIM_LOCKED'?409:m.startsWith('INVALID')||m.includes('REQUIRED')||m==='AMOUNT_EXCEEDS_CLAIM'||m==='GUARANTEE_READ_ONLY'||m==='UNKNOWN_ACTION'||m==='MISSING_FIELDS'?400:500;return json({error:m},status);}
});
