import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const CH="2011407195"; const OWNER_USER_ID=1;
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json; charset=utf-8"}});
const authCache=new Map<string,{until:number,u:any}>();

function assertOwner(u:any){
  if(!u)throw Error("PROFIT_LOSS_ACCESS_DENIED");
  if(!u.is_active||(u.expires_at&&new Date(u.expires_at).getTime()<=Date.now()))throw Error("PROFIT_LOSS_ACCESS_DENIED");
  if(Number(u.id)!==OWNER_USER_ID)throw Error("PROFIT_LOSS_ACCESS_DENIED");
  return {...u,is_owner:true};
}

async function sessionUser(token:string){
  const {data:s,error:se}=await db.from("app_sessions").select("user_id,is_active,expires_at").eq("token",token).maybeSingle();
  if(se)throw se;
  if(!s)return null;
  if(!s.is_active||(s.expires_at&&new Date(s.expires_at).getTime()<=Date.now()))throw Error("SESSION_EXPIRED");
  const {data:u,error:ue}=await db.from("app_users").select("id,username,role,is_active,expires_at").eq("id",s.user_id).maybeSingle();
  if(ue)throw ue;
  if(!u)throw Error("PROFIT_LOSS_ACCESS_DENIED");
  return assertOwner(u);
}

async function lineUser(token:string){
  const vr=await fetch("https://api.line.me/oauth2/v2.1/verify?access_token="+encodeURIComponent(token));
  const v=await vr.json().catch(()=>({}));
  if(!vr.ok||String(v?.client_id||"")!==CH||!(Number(v?.expires_in)>0))return null;
  const pr=await fetch("https://api.line.me/v2/profile",{headers:{Authorization:"Bearer "+token}});
  const p=await pr.json().catch(()=>({}));
  if(!pr.ok||!p?.userId)return null;
  const {data:u,error}=await db.from("app_users").select("id,username,role,is_active,expires_at").eq("line_user_id",p.userId).maybeSingle();
  if(error)throw error;
  if(!u)throw Error("LINE_NOT_LINKED");
  return assertOwner(u);
}

async function currentUser(req:Request){
  const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!t)throw Error("AUTH_FAILED");
  const hit=authCache.get(t);if(hit&&hit.until>Date.now())return hit.u;
  let u:any=null;
  try{u=await sessionUser(t);}catch(e){const m=e instanceof Error?e.message:String(e);if(m!=="SESSION_EXPIRED")throw e;throw e;}
  if(!u)u=await lineUser(t);
  if(!u)throw Error("AUTH_FAILED");
  authCache.set(t,{until:Date.now()+30000,u});
  return u;
}


function validMonth(value: unknown) {
  const month=String(value||"");
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("INVALID_MONTH");
  return month+"-01";
}
export function payrollSummary(rows: any[]) {
  const sum=(key:string)=>Math.round(rows.reduce((total,row)=>total+Number(row[key]||0),0)*100)/100;
  return {staff_count:rows.length,staff_base_salary:sum("base_salary"),
    staff_social_security:sum("social_security"),staff_payroll_net:sum("net_paid"),
    staff_advance_deduction:sum("advance_deduction"),
    salary_pending:rows.some(row=>row.salary_pending)};
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return J({error:"METHOD_NOT_ALLOWED"},405);
  try{
    await currentUser(req);
    const body=await req.json();
    if(body.action!=="staff_payroll_rows")return J({error:"UNKNOWN_ACTION"},400);
    const month=validMonth(body.month);
    const currentMonth=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit"}).format(new Date());
    // The scheduled job creates months without a browser. This is its retry path.
    if(body.month===currentMonth && month>="2026-09-01"){
      const {error}=await db.rpc("ensure_legacy_staff_payroll_month",{p_month:month});
      if(error)throw error;
    }
    const {data,error}=await db.rpc("legacy_staff_payroll_rows",{p_month:month});
    if(error)throw error;
    const rows=data||[];
    return J({ok:true,rows,summary:payrollSummary(rows)});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    const status=message==="AUTH_FAILED"||message==="SESSION_EXPIRED"?401:
      message==="LINE_NOT_LINKED"||message.includes("DENIED")?403:
      message.startsWith("INVALID_")?400:500;
    console.error("legacy-staff-payroll-api",message);
    return J({error:status===500?"SERVER_ERROR":message},status);
  }
});

