import { createClient } from "npm:@supabase/supabase-js@2";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:H});

async function authStaff(req:Request){
  const m=(req.headers.get("Authorization")||"").match(/^Bearer\s+(.+)$/i);
  if(!m)throw new Error("SESSION_REQUIRED");
  const token=m[1].trim();
  const {data:s,error:se}=await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token",token).maybeSingle();
  if(se)throw se;
  if(!s||s.is_active!==true||!s.expires_at||new Date(s.expires_at).getTime()<=Date.now())throw new Error("SESSION_INVALID");
  const {data:u,error:ue}=await db.from("app_users").select("id,username,role,is_active,expires_at,can_manage_payroll,can_access_payroll").eq("id",s.user_id).maybeSingle();
  if(ue)throw ue;
  if(!u||u.is_active!==true||(u.expires_at&&new Date(u.expires_at).getTime()<=Date.now()))throw new Error("USER_INACTIVE");
  const allowed=String(u.role||"").toLowerCase()==="admin"||u.can_manage_payroll===true;
  if(!allowed)throw new Error("PAYROLL_MANAGE_REQUIRED");
  return u;
}

async function checkLineReachable(lineUserId:string,token:string){
  if(!lineUserId)return {ok:false,reason:"LINE_NOT_LINKED",status:null};
  try{
    const r=await fetch("https://api.line.me/v2/bot/profile/"+encodeURIComponent(lineUserId),{headers:{"Authorization":"Bearer "+token}});
    if(r.ok)return {ok:true,reason:null,status:r.status};
    const detail=await r.text().catch(()=>"");
    console.error("line profile check failed",r.status,detail);
    if(r.status===404)return {ok:false,reason:"LINE_OA_NOT_FRIEND_OR_BLOCKED",status:r.status};
    if(r.status===401)return {ok:false,reason:"LINE_TOKEN_INVALID",status:r.status};
    return {ok:false,reason:"LINE_PROFILE_CHECK_FAILED",status:r.status};
  }catch(e){console.error("line profile check error",e);return {ok:false,reason:"LINE_PROFILE_CHECK_ERROR",status:null};}
}

async function pushLine(lineUserId:string,employeeName:string,amount:number){
  const token=Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")||"";
  if(!lineUserId)return {ok:false,delivery_status:"FAILED",reason:"LINE_NOT_LINKED",status:null,profile_status:null};
  if(!token)return {ok:false,delivery_status:"FAILED",reason:"LINE_CHANNEL_ACCESS_TOKEN_MISSING",status:null,profile_status:null};
  const reachable=await checkLineReachable(lineUserId,token);
  if(!reachable.ok)return {ok:false,delivery_status:"NOT_REACHABLE",reason:reachable.reason,status:null,profile_status:reachable.status};
  const money=Number(amount||0).toLocaleString("th-TH",{minimumFractionDigits:0,maximumFractionDigits:2});
  const text=`Divergent Corporation จำกัด\n\nคุณ${employeeName}\nคำขอเบิกเงินล่วงหน้า จำนวน ${money} บาท ได้รับการอนุมัติแล้ว\nกรุณารอการโอนเงิน`;
  try{
    const r=await fetch("https://api.line.me/v2/bot/message/push",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({to:lineUserId,messages:[{type:"text",text}]})});
    if(!r.ok){const detail=await r.text().catch(()=>"");console.error("line push failed",r.status,detail);return {ok:false,delivery_status:"FAILED",reason:"LINE_PUSH_FAILED",status:r.status,profile_status:reachable.status};}
    return {ok:true,delivery_status:"API_ACCEPTED",reason:null,status:r.status,profile_status:reachable.status};
  }catch(e){console.error("line push error",e);return {ok:false,delivery_status:"FAILED",reason:"LINE_PUSH_ERROR",status:null,profile_status:reachable.status};}
}

async function saveLineResult(requestId:number,line:any){
  const now=new Date().toISOString();
  const patch:any={line_delivery_attempted_at:now,line_delivery_status:String(line?.delivery_status||(line?.ok?"API_ACCEPTED":"FAILED")),line_delivery_reason:line?.ok?null:String(line?.reason||"UNKNOWN"),line_delivery_http_status:Number.isInteger(line?.status)?line.status:null};
  if(line?.ok)patch.shared_to_line_at=now;
  const {error}=await db.from("employee_advance_requests").update(patch).eq("id",requestId);
  if(error)throw error;
}

async function getRecipient(requestId:number){
  const {data:r,error:re}=await db.from("employee_advance_requests").select("id,status,requested_amount,app_user_id,payroll_profile_id").eq("id",requestId).maybeSingle();
  if(re)throw re;if(!r)return null;
  const {data:p,error:pe}=await db.from("employee_payroll_profiles").select("employee_name").eq("id",r.payroll_profile_id).maybeSingle();if(pe)throw pe;
  const {data:u,error:ue}=await db.from("app_users").select("line_user_id").eq("id",r.app_user_id).maybeSingle();if(ue)throw ue;
  return {request:r,employee_name:String(p?.employee_name||"พนักงาน"),line_user_id:String(u?.line_user_id||"")};
}

async function listRequests(statusFilter:string){
  let q=db.from("employee_advance_requests").select("id,request_code,app_user_id,payroll_profile_id,requested_amount,earned_amount_at_request,tax_amount_at_request,available_amount_at_request,work_count_at_request,status,request_note,created_at,approved_at,approved_by,shared_to_line_at,line_delivery_status,line_delivery_reason,line_delivery_http_status,line_delivery_attempted_at").order("created_at",{ascending:false}).limit(500);
  if(statusFilter&&statusFilter!=="ALL")q=q.eq("status",statusFilter);
  const {data:reqs,error}=await q;if(error)throw error;
  const rows=reqs||[];const profileIds=[...new Set(rows.map((x:any)=>x.payroll_profile_id).filter(Boolean))];const userIds=[...new Set(rows.map((x:any)=>x.app_user_id).filter(Boolean))];
  const profiles=new Map<number,any>(),users=new Map<number,any>();
  if(profileIds.length){const {data,error}=await db.from("employee_payroll_profiles").select("id,employee_name,site_name,source_month,source_row").in("id",profileIds);if(error)throw error;for(const x of data||[])profiles.set(Number(x.id),x);}
  if(userIds.length){const {data,error}=await db.from("app_users").select("id,username,line_user_id,line_display_name").in("id",userIds);if(error)throw error;for(const x of data||[])users.set(Number(x.id),x);}
  const enriched=rows.map((r:any)=>{const p=profiles.get(Number(r.payroll_profile_id))||{},u=users.get(Number(r.app_user_id))||{};return {...r,employee_name:p.employee_name||u.line_display_name||u.username||"-",site_name:p.site_name||"ไม่ระบุไซต์",username:u.username||null,line_linked:!!u.line_user_id};});
  const groups=new Map<string,any[]>();for(const r of enriched){const site=String(r.site_name||"ไม่ระบุไซต์");if(!groups.has(site))groups.set(site,[]);groups.get(site)!.push(r);}
  const sites=[...groups.entries()].map(([site,items])=>({site_name:site,employee_count:items.length,total_amount:items.reduce((s,x)=>s+Number(x.requested_amount||0),0),items}));
  const totals={count:enriched.length,total_amount:enriched.reduce((s,x)=>s+Number(x.requested_amount||0),0),pending:enriched.filter(x=>x.status==="PENDING").length,approved:enriched.filter(x=>x.status==="APPROVED").length,rejected:enriched.filter(x=>x.status==="REJECTED").length};
  return {requests:enriched,sites,totals};
}

// Delete a request. An APPROVED request was added to payroll_master_rows.advance_deduction at approval:
// take it back out of the same payroll row (skipped if payroll has moved to a newer row since approval).
// Payroll is adjusted first; if the delete then fails, the payroll change is put back.
async function findPayrollRow(req:any){
  const {data:prof}=await db.from("employee_payroll_profiles").select("source_month,source_row").eq("id",req.payroll_profile_id).maybeSingle();
  let {data:rows,error:pe}=await db.from("payroll_master_rows").select("id,created_at,advance_deduction").eq("is_active",true).eq("profile_id",req.payroll_profile_id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1);
  if(pe)throw pe;
  if((!rows||!rows.length)&&prof){
    let q=db.from("payroll_master_rows").select("id,created_at,advance_deduction").eq("is_active",true).is("profile_id",null);
    q=prof.source_month==null?q.is("source_month",null):q.eq("source_month",prof.source_month);
    q=prof.source_row==null?q.is("source_row",null):q.eq("source_row",prof.source_row);
    const r2=await q.order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1);if(r2.error)throw r2.error;rows=r2.data;
  }
  return rows&&rows[0]?rows[0]:null;
}

async function deleteRequest(requestId:number,userId:number){
  const {data:req,error:re}=await db.from("employee_advance_requests").select("*").eq("id",requestId).maybeSingle();
  if(re)throw re;if(!req)return null;
  let payrollRowId:number|null=null,before:number|null=null,after:number|null=null,reversed=false;
  if(req.status==="APPROVED"&&req.payroll_profile_id){
    const row=await findPayrollRow(req);
    if(row&&(!req.approved_at||new Date(row.created_at).getTime()<=new Date(req.approved_at).getTime())){
      payrollRowId=Number(row.id);before=Number(row.advance_deduction||0);after=Math.max(0,Math.round((before-Number(req.requested_amount||0))*100)/100);
      const upq=db.from("payroll_master_rows").update({advance_deduction:after,updated_at:new Date().toISOString()}).eq("id",payrollRowId);
      const {data:upd,error:ue}=await (row.advance_deduction==null?upq.is("advance_deduction",null):upq.eq("advance_deduction",row.advance_deduction)).select("id").maybeSingle();
      if(ue)throw ue;if(!upd)throw new Error("PAYROLL_CHANGED_RETRY");
      reversed=true;
    }
  }
  const {data:del,error:de}=await db.from("employee_advance_requests").delete().eq("id",requestId).eq("status",req.status).select("id").maybeSingle();
  if(de||!del){
    if(reversed)await db.from("payroll_master_rows").update({advance_deduction:before,updated_at:new Date().toISOString()}).eq("id",payrollRowId);
    if(de)throw de;throw new Error("ADVANCE_REQUEST_CHANGED_RETRY");
  }
  const {error:le}=await db.from("payroll_change_log").insert({changed_by_user_id:userId,payroll_profile_id:req.payroll_profile_id||null,action:"EMPLOYEE_ADVANCE_DELETED",field_name:"advance_deduction",old_value:{request:req,before},new_value:{after,payroll_row_id:payrollRowId,reversed},note:"Deleted employee cash advance request from web"});
  if(le)console.error("delete log failed",le);
  return {request_id:req.id,status:req.status,requested_amount:req.requested_amount,payroll_reversed:reversed,payroll_row_id:payrollRowId,advance_deduction:after};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const staff=await authStaff(req);const body=await req.json().catch(()=>({}));const action=String(body?.action||"list");
    if(action==="list")return json({ok:true,...await listRequests(String(body?.status||"ALL").toUpperCase())});

    if(action==="approve"){
      const requestId=Number(body?.request_id);if(!Number.isInteger(requestId)||requestId<=0)return json({error:"INVALID_REQUEST_ID"},400);
      const rec=await getRecipient(requestId);if(!rec)return json({error:"ADVANCE_REQUEST_NOT_FOUND"},404);
      const {data:result,error:re}=await db.rpc("approve_employee_advance_atomic",{p_request_id:requestId,p_approver_user_id:staff.id});
      if(re){const msg=String(re.message||"");if(msg.includes("CURRENT_PAYROLL_ROW_NOT_FOUND"))return json({error:"CURRENT_PAYROLL_ROW_NOT_FOUND"},409);if(msg.includes("ADVANCE_REQUEST_NOT_PENDING"))return json({error:"ADVANCE_REQUEST_NOT_PENDING"},409);throw re;}
      let line:any={ok:false,delivery_status:"FAILED",reason:"ALREADY_APPROVED",status:null};
      if(!result?.already_approved){line=await pushLine(rec.line_user_id,rec.employee_name,Number(rec.request.requested_amount||0));await saveLineResult(requestId,line);}
      return json({ok:true,approval:result,line});
    }

    if(action==="retry_line"){
      const requestId=Number(body?.request_id);if(!Number.isInteger(requestId)||requestId<=0)return json({error:"INVALID_REQUEST_ID"},400);
      const rec=await getRecipient(requestId);if(!rec)return json({error:"ADVANCE_REQUEST_NOT_FOUND"},404);
      if(String(rec.request.status)!=="APPROVED")return json({error:"ADVANCE_REQUEST_NOT_APPROVED"},409);
      const line=await pushLine(rec.line_user_id,rec.employee_name,Number(rec.request.requested_amount||0));await saveLineResult(requestId,line);return json({ok:true,line});
    }

    if(action==="reject"){
      const requestId=Number(body?.request_id);if(!Number.isInteger(requestId)||requestId<=0)return json({error:"INVALID_REQUEST_ID"},400);
      const {data,error}=await db.from("employee_advance_requests").update({status:"REJECTED",approved_at:new Date().toISOString(),approved_by:staff.id}).eq("id",requestId).eq("status","PENDING").select("id,request_code,status,requested_amount").maybeSingle();
      if(error)throw error;if(!data)return json({error:"ADVANCE_REQUEST_NOT_PENDING"},409);return json({ok:true,request:data});
    }

    if(action==="delete"){
      const requestId=Number(body?.request_id);if(!Number.isInteger(requestId)||requestId<=0)return json({error:"INVALID_REQUEST_ID"},400);
      let result:any;try{result=await deleteRequest(requestId,Number(staff.id));}catch(e){const m=e instanceof Error?e.message:String(e);if(m.endsWith("_RETRY"))return json({error:m},409);throw e;}
      if(!result)return json({error:"ADVANCE_REQUEST_NOT_FOUND"},404);
      return json({ok:true,...result});
    }

    return json({error:"UNKNOWN_ACTION"},400);
  }catch(e){const m=e instanceof Error?e.message:String(e);const status=["SESSION_REQUIRED","SESSION_INVALID"].includes(m)?401:["USER_INACTIVE","PAYROLL_MANAGE_REQUIRED"].includes(m)?403:500;console.error("employee-advance-web-api",m,e);return json({error:status===500?"SERVER_ERROR":m},status);}
});
