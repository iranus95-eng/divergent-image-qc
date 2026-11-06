import { createClient } from "npm:@supabase/supabase-js@2";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS"};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json; charset=utf-8"}});
const digits=(v:any)=>String(v??"").replace(/\D/g,"");

async function sha256(s:string){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function auth(req:Request){
  const m=(req.headers.get("Authorization")||"").match(/^Bearer\s+(.+)$/i);
  if(!m)throw new Error("SESSION_REQUIRED");
  const token=m[1].trim();
  const {data:s,error:e}=await db.from("app_sessions").select("id,user_id,expires_at,is_active").eq("token",token).maybeSingle();
  if(e)throw e;
  if(!s||s.is_active!==true||!s.expires_at||new Date(s.expires_at).getTime()<=Date.now())throw new Error("SESSION_INVALID");
  const {data:u,error:ue}=await db.from("app_users").select("id,username,role,is_active,expires_at").eq("id",s.user_id).maybeSingle();
  if(ue)throw ue;
  if(!u||u.is_active!==true||(u.expires_at&&new Date(u.expires_at).getTime()<=Date.now()))throw new Error("USER_INACTIVE");
  return u;
}

function normSite(v:any){
  return String(v??"").toLowerCase().replace(/ภูู/g,"ภู").replace(/การไฟฟ้าส่วนภูมิภาค/g,"").replace(/จังหวัด/g,"").replace(/อำเภอ/g,"").replace(/สาขา/g,"").replace(/[\s().,_\-]/g,"").trim();
}

const CODE_ALIASES:Record<string,string[]>={
  BANFANG:["บ้านฝาง"],BUAYAI:["บัวใหญ่"],CHAIYAPHUM:["ชัยภูมิ"],CHATTURAT:["จัตุรัส"],CHUMPHUANG:["ชุมพวง"],KAENGKHRO:["แก้งคร้อ"],KANTHARALAK:["กันทรลักษ์"],KORAT2:["นม2","นครราชสีมา2","หัวทะเล"],KOSUM:["โกสุมพิสัย"],KRANUAN:["กระนวน"],MANCHAKHIRI:["มัญจาคีรี"],NONGBUNMAK:["หนองบุญมาก"],NONGKI:["หนองกี่"],NONGSONGHONG:["หนองสองห้อง"],NONTHAI:["โนนไทย"],PHUKHIAO:["ภูเขียว"],PHUTTHAISONG:["พุทไธสง"],PRAKHONCHAI:["ประโคนชัย"],PRATHAI:["ประทาย"],SUNGNOEN:["สูงเนิน"],UDON:["อุดรธานี","อุดร1","อุดร"]
};

function pickRate(rates:any[],siteCode:string,siteName:string){
  const active=(rates||[]).filter((r:any)=>r.rate_type==="per_unit"&&Number.isFinite(Number(r.rate_amount)));
  if(!active.length)return null;
  const keys=new Set<string>();
  keys.add(normSite(siteName));
  for(const a of CODE_ALIASES[String(siteCode||"").toUpperCase()]||[])keys.add(normSite(a));
  let hit=active.find((r:any)=>keys.has(normSite(r.site_name)));
  if(hit)return hit;
  hit=active.find((r:any)=>{const rk=normSite(r.site_name);return rk&&[...keys].some(k=>k&&(k.includes(rk)||rk.includes(k)));});
  if(hit)return hit;
  const amounts=[...new Set(active.map((r:any)=>Number(r.rate_amount)))];
  if(amounts.length===1||active.length===1)return active[0];
  return null;
}

async function syncRatesFromMaster(profileId:number){
  const {data:rows,error}=await db.from("payroll_master_rows").select("source_month,source_row,site_name,rate_per_unit").eq("profile_id",profileId).eq("is_active",true);
  if(error)throw error;
  for(const row of rows||[]){
    const site=String(row.site_name||"").trim(),month=String(row.source_month||"").trim(),rate=Number(row.rate_per_unit);
    if(!site||!month||!Number.isFinite(rate)||rate<0)continue;
    const {data:exact,error:xe}=await db.from("employee_pay_rates").select("id").eq("payroll_profile_id",profileId).eq("site_name",site).eq("source_month",month).eq("rate_amount",rate).limit(1);
    if(xe)throw xe;
    if((exact||[]).length){
      const {error:up}=await db.from("employee_pay_rates").update({rate_type:"per_unit",source_row:row.source_row??null,is_active:true,updated_at:new Date().toISOString()}).eq("id",exact![0].id);
      if(up)throw up;continue;
    }
    const {data:anyRate,error:ae}=await db.from("employee_pay_rates").select("id").eq("payroll_profile_id",profileId).eq("site_name",site).eq("source_month",month).limit(1);
    if(ae)throw ae;
    if((anyRate||[]).length){
      const {error:up}=await db.from("employee_pay_rates").update({rate_amount:rate,rate_type:"per_unit",source_row:row.source_row??null,is_active:true,updated_at:new Date().toISOString()}).eq("id",anyRate![0].id);
      if(up)throw up;
    }else{
      const {error:ins}=await db.from("employee_pay_rates").insert({payroll_profile_id:profileId,site_name:site,rate_amount:rate,rate_type:"per_unit",source_month:month,source_row:row.source_row??null,is_active:true});
      if(ins)throw ins;
    }
  }
}

async function profileFor(userId:number){
  const {data:p,error}=await db.from("employee_payroll_profiles").select("id,employee_name,site_name,rate_per_unit,national_id_last4,source_month,bound_at,is_active").eq("app_user_id",userId).eq("is_active",true).maybeSingle();
  if(error)throw error;if(!p)return null;
  await syncRatesFromMaster(Number(p.id));
  const {data:r,error:re}=await db.from("employee_pay_rates").select("site_name,rate_amount,rate_type,source_month").eq("payroll_profile_id",p.id).eq("is_active",true).order("id",{ascending:true});
  if(re)throw re;return {...p,rates:r||[]};
}

async function currentPayrollMonth():Promise<string>{
  const {data,error}=await db.rpc("payroll_current_month");
  if(error){console.error("compensation-api payroll_current_month",error);return "";}
  return String(data||"");
}

// Fallback when no profile carries this national ID's hash yet: look the ID up
// in the active payroll master rows of every month (not only the first
// imported month), so employees added later or by hand on the web can bind.
async function ensureProfileFromCurrentMaster(nid:string,h:string){
  const {data:rows,error}=await db.from("payroll_master_rows").select("id,source_row,source_month,employee_name,national_id,bank_name,bank_account,site_name,rate_per_unit,profile_id,is_active").eq("is_active",true).not("national_id","is",null).order("id",{ascending:false}).limit(5000);
  if(error)throw error;
  const matches=(rows||[]).filter((x:any)=>digits(x.national_id)===nid);if(!matches.length)return null;
  const month=await currentPayrollMonth();
  const row=matches.find((x:any)=>x.profile_id&&x.source_month===month)||matches.find((x:any)=>x.profile_id)||matches.find((x:any)=>x.source_month===month)||matches[0];
  let profile:any=null;
  if(row.profile_id){
    // The master row already belongs to a profile (for example one created on the
    // web, which stores no hash): stamp the hash so later lookups hit directly.
    // An inactive profile may still hold this hash (unique index); it can never be found, so release it.
    const {error:ce}=await db.from("employee_payroll_profiles").update({national_id_hash:null}).eq("national_id_hash",h).eq("is_active",false).neq("id",row.profile_id);if(ce)throw ce;
    const {data:p,error:pe}=await db.from("employee_payroll_profiles").update({national_id_hash:h,national_id_last4:nid.slice(-4),is_active:true,source_updated_at:new Date().toISOString()}).eq("id",row.profile_id).select("id,employee_name,app_user_id,is_active").maybeSingle();if(pe)throw pe;profile=p;
  }
  if(!profile){
    const common:any={employee_name:row.employee_name,site_name:row.site_name||null,rate_per_unit:row.rate_per_unit??null,bank_name:row.bank_name||null,bank_account:row.bank_account||null,source_month:row.source_month||month||null,source_row:row.source_row??null,national_id:null,national_id_hash:h,national_id_last4:nid.slice(-4),source_updated_at:new Date().toISOString(),is_active:true};
    const {data:p,error:pe}=await db.from("employee_payroll_profiles").insert(common).select("id,employee_name,app_user_id,is_active").single();if(pe)throw pe;profile=p;
    const {error:me}=await db.from("payroll_master_rows").update({profile_id:p.id}).eq("id",row.id);if(me)throw me;
  }
  if(profile)await syncRatesFromMaster(Number(profile.id));return profile;
}

async function findProfileByNationalId(nid:string){
  if(nid.length!==13)return {error:"INVALID_NATIONAL_ID",profile:null};
  const h=await sha256(nid);
  const {data:p,error}=await db.from("employee_payroll_profiles").select("id,employee_name,app_user_id,is_active").eq("national_id_hash",h).eq("is_active",true).maybeSingle();
  if(error)throw error;
  if(p){await syncRatesFromMaster(Number(p.id));return {error:null,profile:p};}
  const fallback=await ensureProfileFromCurrentMaster(nid,h);if(!fallback)return {error:"EMPLOYEE_NOT_FOUND",profile:null};return {error:null,profile:fallback};
}

type CivilDate={year:number,month:number,day:number};
function daysInMonth(year:number,month:number){return new Date(Date.UTC(year,month,0)).getUTCDate();}
function ordinal(d:CivilDate){return Date.UTC(d.year,d.month-1,d.day);}
function isoDate(d:CivilDate){return `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}`;}
function bangkokToday():CivilDate{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);return {year:get("year"),month:get("month"),day:get("day")};
}
function cycleWindow(){
  const today=bangkokToday();const lastTodayMonth=daysInMonth(today.year,today.month);let start:CivilDate;
  if(today.day===lastTodayMonth){start={...today};}else{let py=today.year,pm=today.month-1;if(pm===0){pm=12;py--;}start={year:py,month:pm,day:daysInMonth(py,pm)};}
  const nextReset:CivilDate={year:today.year,month:today.month,day:lastTodayMonth};
  return {today,start,nextReset,startOrdinal:ordinal(start),todayOrdinal:ordinal(today),startUtcIso:new Date(ordinal(start)-7*60*60*1000).toISOString()};
}
function parseRawDate(v:any):number|null{
  const s=digits(v);if(s.length!==8)return null;const day=Number(s.slice(0,2)),month=Number(s.slice(2,4));let year=Number(s.slice(4,8));if(year>=2400)year-=543;
  if(year<2000||year>2200||month<1||month>12||day<1||day>daysInMonth(year,month))return null;return ordinal({year,month,day});
}
function createdAtBangkokOrdinal(v:any):number|null{
  const d=new Date(String(v||""));if(!Number.isFinite(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const get=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);
  const c={year:get("year"),month:get("month"),day:get("day")};return c.year&&c.month&&c.day?ordinal(c):null;
}

async function fetchAllIndexRows(batchIds:string[]){
  if(!batchIds.length)return [];
  const out:any[]=[];
  const PAGE=1000;
  for(let from=0;;from+=PAGE){
    const {data,error}=await db.from("image_search_index")
      .select("batch_id,ca_number,site_code,object_path")
      .in("batch_id",batchIds)
      .order("object_path",{ascending:true})
      .range(from,from+PAGE-1);
    if(error)throw error;
    const rows=data||[];out.push(...rows);
    if(rows.length<PAGE)break;
    if(from>100000)throw new Error("INDEX_PAGINATION_LIMIT");
  }
  return out;
}

async function currentSummary(userId:number,p:any){
  const cycle=cycleWindow();
  const {data:allBatches,error:be}=await db.from("image_batches")
    .select("batch_id,site_name,site_code,ca_count,created_at,status,raw_date")
    .eq("uploaded_by_user_id",userId)
    .in("status",["UPLOADED","SERVER_BACKED_UP"])
    .order("created_at",{ascending:true});
  if(be)throw be;
  const batchList=(allBatches||[]).filter((b:any)=>{const workDay=parseRawDate(b.raw_date)??createdAtBangkokOrdinal(b.created_at);return workDay!==null&&workDay>=cycle.startOrdinal&&workDay<=cycle.todayOrdinal;});
  const ids=batchList.map((x:any)=>x.batch_id).filter(Boolean);
  const index=await fetchAllIndexRows(ids);

  const indexByBatch=new Map<string,Set<string>>();
  for(const x of index){const bid=String(x.batch_id||""),ca=String(x.ca_number||"").trim();if(!bid||!ca)continue;if(!indexByBatch.has(bid))indexByBatch.set(bid,new Set());indexByBatch.get(bid)!.add(ca);}

  const groups=new Map<string,{siteCode:string,siteName:string,count:number}>();let workCount=0;const countSources:any[]=[];
  for(const b of batchList){
    const bid=String(b.batch_id||""),siteCode=String(b.site_code||"").trim().toUpperCase(),siteName=String(b.site_name||b.site_code||"").trim();
    const indexedCount=indexByBatch.get(bid)?.size||0,fallbackCount=Math.max(0,Number(b.ca_count||0)),count=indexedCount>0?indexedCount:fallbackCount;if(count<=0)continue;
    workCount+=count;const key=siteCode||normSite(siteName);const g=groups.get(key)||{siteCode,siteName,count:0};g.count+=count;groups.set(key,g);
    countSources.push({batch_id:bid,raw_date:b.raw_date||null,site_code:siteCode,site:siteName,count,source:indexedCount>0?"image_search_index":"image_batches.ca_count"});
  }

  const rates=(p.rates||[]).filter((r:any)=>r.rate_type==="per_unit");let gross=0;const breakdown:any[]=[];
  for(const g of groups.values()){const r=pickRate(rates,g.siteCode,g.siteName);const rate=r?Number(r.rate_amount):0,amount=g.count*rate;gross+=amount;breakdown.push({site:g.siteName,site_code:g.siteCode,count:g.count,rate,amount,rate_found:!!r,matched_rate_site:r?.site_name||null});}
  gross=Math.round(gross*100)/100;const tax=Math.round(gross*0.03*100)/100,net=Math.round((gross-tax)*100)/100;

  const {data:adv,error:ae}=await db.from("employee_advance_requests").select("requested_amount,status,created_at").eq("app_user_id",userId).in("status",["PENDING","APPROVED"]).gte("created_at",cycle.startUtcIso);
  if(ae)throw ae;
  const reserved=Math.round((adv||[]).reduce((ss:number,x:any)=>ss+Number(x.requested_amount||0),0)*100)/100;const available=Math.max(0,Math.round((net-reserved)*100)/100);
  return {work_count:workCount,gross,tax,net,reserved_advance:reserved,available_advance:available,breakdown,count_sources:countSources,count_mode:"month_end_cycle_paginated",period_start:isoDate(cycle.start),period_through:isoDate(cycle.today),next_cycle_start:isoDate(cycle.nextReset)};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const u=await auth(req);const body=await req.json().catch(()=>({}));const action=String(body?.action||"");
    if(action==="bind_profile"){
      const nid=digits(body?.national_id),f=await findProfileByNationalId(nid);if(f.error)return json({error:f.error},f.error==="INVALID_NATIONAL_ID"?400:404);const p:any=f.profile;
      if(p.app_user_id&&Number(p.app_user_id)!==Number(u.id))return json({error:"NATIONAL_ID_ALREADY_BOUND"},409);
      const {data:other,error:oe}=await db.from("employee_payroll_profiles").select("id").eq("app_user_id",u.id).neq("id",p.id).limit(1);if(oe)throw oe;if((other||[]).length)return json({error:"USER_ALREADY_BOUND"},409);
      const {error:up}=await db.from("employee_payroll_profiles").update({app_user_id:u.id,bound_at:new Date().toISOString()}).eq("id",p.id);if(up){if((up as any).code==="23505")return json({error:"USER_ALREADY_BOUND"},409);throw up;}
      return json({ok:true,profile:await profileFor(u.id)});
    }
    if(action==="change_profile"){
      const nid=digits(body?.national_id),f=await findProfileByNationalId(nid);if(f.error)return json({error:f.error},f.error==="INVALID_NATIONAL_ID"?400:404);const target:any=f.profile;
      if(target.app_user_id&&Number(target.app_user_id)!==Number(u.id))return json({error:"NATIONAL_ID_ALREADY_BOUND"},409);
      const {data:current,error:ce}=await db.from("employee_payroll_profiles").select("id").eq("app_user_id",u.id);if(ce)throw ce;const currentIds=(current||[]).map((x:any)=>x.id).filter((id:any)=>Number(id)!==Number(target.id));
      if(currentIds.length){const {error:clr}=await db.from("employee_payroll_profiles").update({app_user_id:null,bound_at:null}).in("id",currentIds);if(clr)throw clr;}
      const {error:up}=await db.from("employee_payroll_profiles").update({app_user_id:u.id,bound_at:new Date().toISOString()}).eq("id",target.id);if(up){if((up as any).code==="23505")return json({error:"USER_ALREADY_BOUND"},409);throw up;}
      return json({ok:true,profile:await profileFor(u.id),changed:true});
    }
    if(action==="profile"){const p=await profileFor(u.id);return p?json({ok:true,profile:p}):json({ok:true,profile:null,requires_national_id:true});}
    if(action==="summary"){const p=await profileFor(u.id);if(!p)return json({error:"PROFILE_REQUIRED"},409);return json({ok:true,profile:p,summary:await currentSummary(u.id,p)});}
    if(action==="advance_request"){
      const p=await profileFor(u.id);if(!p)return json({error:"PROFILE_REQUIRED"},409);const amount=Math.round(Number(body?.amount||0)*100)/100;if(!Number.isFinite(amount)||amount<=0)return json({error:"INVALID_AMOUNT"},400);
      const ss=await currentSummary(u.id,p);if(amount>ss.available_advance)return json({error:"AMOUNT_EXCEEDS_AVAILABLE",available:ss.available_advance},400);
      const code=`ADV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${u.id}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;const note=String(body?.note||"").trim().slice(0,500)||null;
      const {data,error}=await db.from("employee_advance_requests").insert({app_user_id:u.id,payroll_profile_id:p.id,requested_amount:amount,earned_amount_at_request:ss.gross,tax_amount_at_request:ss.tax,available_amount_at_request:ss.available_advance,work_count_at_request:ss.work_count,status:"PENDING",request_note:note,request_code:code}).select("id,request_code,requested_amount,status,created_at").single();if(error)throw error;
      return json({ok:true,request:data,profile:{employee_name:p.employee_name},summary:ss});
    }
    if(action==="advance_history"){const {data,error}=await db.from("employee_advance_requests").select("request_code,requested_amount,status,request_note,created_at,approved_at").eq("app_user_id",u.id).order("created_at",{ascending:false}).limit(50);if(error)throw error;return json({ok:true,requests:data||[]});}
    return json({error:"UNKNOWN_ACTION"},400);
  }catch(e){const m=e instanceof Error?e.message:String(e),status=["SESSION_REQUIRED","SESSION_INVALID"].includes(m)?401:m==="USER_INACTIVE"?403:500;console.error("compensation-api",m,e);return json({error:status===500?"SERVER_ERROR":m},status);}
});
