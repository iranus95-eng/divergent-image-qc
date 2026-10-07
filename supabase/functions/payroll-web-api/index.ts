import {createClient} from "npm:@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...H,"content-type":"application/json; charset=utf-8"}});
const CH="2011407195";
const clean=(x:any,n=500)=>{const s=String(x??"").trim();return s?s.slice(0,n):null};
const digits=(x:any)=>String(x??"").replace(/\D/g,"");

// Payroll batches (รอบเงินเดือน): the open batch is the only one that can be edited.
async function currentMonth():Promise<string>{
  const {data,error}=await db.rpc("payroll_current_month");
  if(error)throw error;
  return String(data||"");
}
async function monthIsOpen(month:string){
  const {data,error}=await db.from("payroll_periods").select("status").eq("source_month",month).maybeSingle();
  if(error)throw error;
  return data?.status==="OPEN";
}

async function user(req:Request){
  const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!t)throw Error("AUTH_REQUIRED");

  let u:any=null;

  // Prefer Username/Password web session.
  const {data:s,error:se}=await db
    .from("app_sessions")
    .select("user_id,expires_at,is_active")
    .eq("token",t)
    .maybeSingle();
  if(se)throw se;

  if(s&&s.is_active&&s.expires_at&&new Date(s.expires_at).getTime()>Date.now()){
    const {data:su,error:sue}=await db
      .from("app_users")
      .select("id,username,role,is_active,expires_at,can_access_payroll,can_manage_payroll")
      .eq("id",s.user_id)
      .maybeSingle();
    if(sue)throw sue;
    if(su)u=su;
  }

  // If it is not a valid web session, fall back to LINE Login.
  if(!u){
    const vr=await fetch("https://api.line.me/oauth2/v2.1/verify?access_token="+encodeURIComponent(t));
    const v=await vr.json().catch(()=>({}));
    if(!vr.ok||String(v?.client_id||"")!==CH||!(Number(v?.expires_in)>0))throw Error("AUTH_INVALID");

    const pr=await fetch("https://api.line.me/v2/profile",{headers:{authorization:"Bearer "+t}});
    const p=await pr.json().catch(()=>({}));
    if(!pr.ok||!p?.userId)throw Error("LINE_AUTH_FAILED");

    const {data:lu,error:le}=await db
      .from("app_users")
      .select("id,username,role,is_active,expires_at,can_access_payroll,can_manage_payroll")
      .eq("line_user_id",p.userId)
      .maybeSingle();
    if(le)throw le;
    if(!lu)throw Error("LINE_NOT_LINKED");
    u=lu;
  }

  if(!u.is_active||(u.expires_at&&new Date(u.expires_at).getTime()<=Date.now()))throw Error("PAYROLL_ACCESS_DENIED");

  const role=String(u.role||"").toLowerCase();
  const admin=role==="admin";
  const staffCore=role==="staff"||role==="user_creator";
  const manage=admin||staffCore||u.can_manage_payroll===true;
  if(!(admin||staffCore||u.can_access_payroll===true||manage))throw Error("PAYROLL_ACCESS_DENIED");

  return {...u,manage};
}
async function rowEmp(id:number){
  const {data:r,error}=await db.from("payroll_master_rows").select("*").eq("id",id).maybeSingle();
  if(error)throw error;
  if(!r)return null;
  let p:any=null,rates:any[]=[],adjustments:any[]=[],areaRows:any[]=[];
  if(r.profile_id){
    const {data:pd,error:pe}=await db.from("employee_payroll_profiles")
      .select("id,employee_name,site_name,rate_per_unit,bank_name,bank_account,app_user_id,is_active,national_id_last4,phone,notes,updated_at")
      .eq("id",r.profile_id).maybeSingle();
    if(pe)throw pe;
    p=pd;
    if(p){
      const rr=await db.from("employee_pay_rates")
        .select("id,site_name,rate_amount,rate_type,is_active")
        .eq("payroll_profile_id",p.id).order("id");
      if(rr.error)throw rr.error;
      rates=rr.data||[];
      const aa=await db.from("employee_payroll_adjustments")
        .select("id,period_start,period_end,adjustment_type,amount,note,is_active,created_at")
        .eq("payroll_profile_id",p.id).order("created_at",{ascending:false});
      if(aa.error)throw aa.error;
      adjustments=aa.data||[];
      const ar=await db.from("payroll_master_rows")
        .select("id,source_row,source_month,site_name,work_count,rate_per_unit,gross_amount,special_amount,withholding_amount,advance_deduction,shirt_cost,total_amount,is_active")
        .eq("profile_id",p.id).eq("source_month",r.source_month).eq("is_active",true).order("source_row");
      if(ar.error)throw ar.error;
      areaRows=ar.data||[];

      const used=new Set<number>();
      rates=rates.map((rate:any)=>{
        const site=String(rate.site_name||"").trim().toLowerCase();
        let match=areaRows.find((x:any)=>!used.has(Number(x.id))&&String(x.site_name||"").trim().toLowerCase()===site);
        if(!match)match=areaRows.find((x:any)=>!used.has(Number(x.id))&&Number(x.rate_per_unit)===Number(rate.rate_amount));
        if(match)used.add(Number(match.id));
        return {...rate,
          master_row_id:match?.id||null,
          source_row:match?.source_row||null,
          work_count:match?.work_count??null,
          gross_amount:match?.gross_amount??null
        };
      });
      for(const area of areaRows){
        if(used.has(Number(area.id)))continue;
        rates.push({
          id:null,
          site_name:area.site_name,
          rate_amount:area.rate_per_unit,
          rate_type:"per_unit",
          is_active:area.is_active!==false,
          master_row_id:area.id,
          source_row:area.source_row,
          work_count:area.work_count,
          gross_amount:area.gross_amount
        });
      }
    }
  }
  return {
    id:r.id,master_row_id:r.id,profile_id:r.profile_id,source_row:r.source_row,source_month:r.source_month,
    period_open:await monthIsOpen(String(r.source_month||"")),
    employee_name:r.employee_name,site_name:r.site_name,work_count:r.work_count,
    rate_per_unit:r.rate_per_unit,gross_amount:r.gross_amount,special_amount:r.special_amount,
    withholding_amount:r.withholding_amount,advance_deduction:r.advance_deduction,
    shirt_cost:r.shirt_cost,total_amount:r.total_amount,transfer_amount:r.transfer_amount,
    bank_name:r.bank_name,bank_account:r.bank_account,national_id:r.national_id,
    app_user_id:p?.app_user_id||null,is_active:r.is_active,phone:p?.phone||null,
    notes:p?.notes||null,rates,adjustments,area_rows:areaRows
  };
}
async function log(uid:number,pid:number|null,action:string,field:string,oldv:any,newv:any){await db.from("payroll_change_log").insert({changed_by_user_id:uid,payroll_profile_id:pid,action,field_name:field,old_value:oldv,new_value:newv})}
// Rates are shared by the profile; area rows are synced only inside one batch (sourceMonth).
async function syncRates(pid:number,rates:any[],uid:number,sourceMonth:string){
  const {data:old,error:oe}=await db.from("employee_pay_rates")
    .select("id,site_name,rate_amount,rate_type,source_month,is_active")
    .eq("payroll_profile_id",pid);
  if(oe)throw oe;

  const {data:masters,error:me}=await db.from("payroll_master_rows")
    .select("id,source_row,source_month,employee_name,national_id,bank_name,bank_account,site_name,work_count,rate_per_unit,special_amount,advance_deduction,shirt_cost,notes,is_active")
    .eq("profile_id",pid).eq("source_month",sourceMonth).eq("is_active",true).order("source_row");
  if(me)throw me;
  const masterRows=masters||[];
  const template=masterRows[0]||null;
  if(!template)throw Error("PAYROLL_MASTER_ROW_NOT_FOUND");

  const oldMap=new Map((old||[]).map((x:any)=>[Number(x.id),x]));
  const masterMap=new Map(masterRows.map((x:any)=>[Number(x.id),x]));
  const keepRates=new Set<number>();
  const keepMasters=new Set<number>();

  for(const raw of rates||[]){
    const site=clean(raw?.site_name??raw?.site,250);
    const amount=Number(raw?.rate_amount??raw?.rate_per_unit??raw?.amount);
    if(!site||!Number.isFinite(amount)||amount<0)throw Error("INVALID_RATE_ROW");
    const active=raw?.is_active!==false;
    const workRaw=raw?.work_count;
    const work=workRaw===""||workRaw===null||workRaw===undefined?null:Number(workRaw);
    if(work!==null&&(!Number.isFinite(work)||work<0))throw Error("INVALID_WORK_COUNT");

    let rid=Number(raw?.id||0);
    let prev=rid?oldMap.get(rid):null;
    if(rid&&!prev)throw Error("RATE_NOT_FOUND");

    if(rid){
      const {error}=await db.from("employee_pay_rates")
        .update({site_name:site,rate_amount:amount,rate_type:"per_unit",is_active:active,updated_at:new Date().toISOString()})
        .eq("id",rid).eq("payroll_profile_id",pid);
      if(error)throw error;
    }else{
      const {data:n,error}=await db.from("employee_pay_rates")
        .insert({payroll_profile_id:pid,site_name:site,rate_amount:amount,rate_type:"per_unit",source_month:"MANUAL",is_active:active,updated_at:new Date().toISOString()})
        .select("id").single();
      if(error)throw error;
      rid=Number(n.id);
    }
    keepRates.add(rid);

    let mid=Number(raw?.master_row_id||0);
    let master=mid?masterMap.get(mid):null;
    if(mid&&!master)throw Error("AREA_ROW_NOT_FOUND");

    if(!master&&prev){
      const prevSite=String(prev.site_name||"").trim().toLowerCase();
      master=masterRows.find((x:any)=>!keepMasters.has(Number(x.id))&&String(x.site_name||"").trim().toLowerCase()===prevSite)||
             masterRows.find((x:any)=>!keepMasters.has(Number(x.id))&&Number(x.rate_per_unit)===Number(prev.rate_amount));
      if(master)mid=Number(master.id);
    }
    if(!master){
      master=masterRows.find((x:any)=>!keepMasters.has(Number(x.id))&&String(x.site_name||"").trim().toLowerCase()===String(site).toLowerCase());
      if(master)mid=Number(master.id);
    }

    if(master){
      const patch:any={site_name:site,rate_per_unit:amount,is_active:active,updated_at:new Date().toISOString()};
      if(work!==null||raw?.work_count==="")patch.work_count=work;
      const {error}=await db.from("payroll_master_rows").update(patch).eq("id",mid).eq("profile_id",pid);
      if(error)throw error;
      keepMasters.add(mid);
    }else if(active){
      const mx=await db.from("payroll_master_rows").select("source_row")
        .eq("source_month",sourceMonth).order("source_row",{ascending:false}).limit(1).maybeSingle();
      if(mx.error)throw mx.error;
      const nextRow=Number(mx.data?.source_row||0)+1;
      const {data:nm,error}=await db.from("payroll_master_rows").insert({
        source_month:sourceMonth,source_row:nextRow,profile_id:pid,
        employee_name:template.employee_name,national_id:template.national_id,
        bank_name:template.bank_name,bank_account:template.bank_account,
        site_name:site,work_count:work,rate_per_unit:amount,
        special_amount:0,advance_deduction:0,shirt_cost:0,
        notes:template.notes||null,is_active:active,updated_at:new Date().toISOString()
      }).select("id").single();
      if(error)throw error;
      mid=Number(nm.id);
      keepMasters.add(mid);
    }
  }

  const removedRates=(old||[]).filter((x:any)=>x.is_active===true&&!keepRates.has(Number(x.id))).map((x:any)=>Number(x.id));
  if(removedRates.length){
    const {error}=await db.from("employee_pay_rates")
      .update({is_active:false,updated_at:new Date().toISOString()})
      .in("id",removedRates).eq("payroll_profile_id",pid);
    if(error)throw error;
  }

  const removedMasters=masterRows.filter((x:any)=>x.is_active===true&&!keepMasters.has(Number(x.id))).map((x:any)=>Number(x.id));
  if(removedMasters.length){
    const {error}=await db.from("payroll_master_rows")
      .update({is_active:false,updated_at:new Date().toISOString()})
      .in("id",removedMasters).eq("profile_id",pid).eq("source_month",sourceMonth);
    if(error)throw error;
  }

  await log(uid,pid,"SYNC_PAY_RATES","rates",old,{
    source_month:sourceMonth,
    count:(rates||[]).length,
    active_rate_ids:[...keepRates],
    active_master_row_ids:[...keepMasters]
  });
}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});try{const u=await user(req);const b=await req.json().catch(()=>({}));const a=String(b.action||"");
if(a==="permissions")return J({ok:true,can_access:true,can_manage:u.manage,user:{id:u.id,username:u.username}});
if(a==="list_employees"){const month=clean(b.source_month,20)||await currentMonth();const {data,error}=await db.from("payroll_master_rows").select("id,source_row,source_month,employee_name,national_id,bank_name,bank_account,site_name,work_count,rate_per_unit,gross_amount,special_amount,withholding_amount,advance_deduction,shirt_cost,total_amount,transfer_amount,profile_id,is_active,updated_at").eq("source_month",month).eq("is_active",true).gte("source_row",1).order("source_row").limit(500);if(error)throw error;const pids=[...new Set((data||[]).map((x:any)=>x.profile_id).filter(Boolean))];const bound=new Map();if(pids.length){const {data:ps,error:pe}=await db.from("employee_payroll_profiles").select("id,app_user_id").in("id",pids);if(pe)throw pe;for(const p of ps||[])bound.set(p.id,p.app_user_id)}const open=await monthIsOpen(month);return J({ok:true,employees:(data||[]).map((x:any)=>({...x,master_row_id:x.id,app_user_id:x.profile_id?bound.get(x.profile_id)||null:null,national_id_last4:digits(x.national_id).slice(-4)})),can_manage:u.manage&&open,period_open:open,source_month:month,record_count:(data||[]).length})}
if(a==="get_employee"){const e=await rowEmp(Number(b.id));return e?J({ok:true,employee:e,can_manage:u.manage&&e.period_open}):J({error:"EMPLOYEE_NOT_FOUND"},404)}
if(!u.manage)throw Error("PAYROLL_MANAGE_DENIED");
if(a==="update_employee"){const id=Number(b.id);const {data:o,error:oe}=await db.from("payroll_master_rows").select("*").eq("id",id).maybeSingle();if(oe)throw oe;if(!o)return J({error:"EMPLOYEE_NOT_FOUND"},404);const month=String(o.source_month||"");if(!(await monthIsOpen(month)))return J({error:"PAYROLL_PERIOD_CLOSED"},409);const nid=digits(b.national_id);if("national_id" in b&&nid.length!==13)return J({error:"NATIONAL_ID_MUST_BE_13_DIGITS"},400);if(nid){const {data:dup,error:de}=await db.from("payroll_master_rows").select("id,profile_id").eq("source_month",month).eq("is_active",true).eq("national_id",nid).neq("id",id);if(de)throw de;const conflict=(dup||[]).some((x:any)=>!o.profile_id||Number(x.profile_id||0)!==Number(o.profile_id));if(conflict)return J({error:"NATIONAL_ID_DUPLICATE"},409);}const patch:any={updated_at:new Date().toISOString()};for(const f of ["employee_name","site_name","bank_name","bank_account"])if(f in b)patch[f]=clean(b[f],250);if("work_count" in b)patch.work_count=b.work_count===""||b.work_count===null?null:Math.max(0,Number(b.work_count));if("rate_per_unit" in b)patch.rate_per_unit=b.rate_per_unit===""?null:Number(b.rate_per_unit);for(const f of ["special_amount","advance_deduction","shirt_cost"])if(f in b)patch[f]=b[f]===""||b[f]===null?0:Math.max(0,Number(b[f]));if("is_active" in b)patch.is_active=!!b.is_active;if(nid)patch.national_id=nid;if(o.profile_id){const pp:any={updated_at:new Date().toISOString(),source_updated_at:new Date().toISOString()};for(const f of ["employee_name","site_name","bank_name","bank_account"])if(f in patch)pp[f]=patch[f];if("rate_per_unit" in patch)pp.rate_per_unit=patch.rate_per_unit;if("phone" in b)pp.phone=clean(b.phone,50);if("notes" in b)pp.notes=clean(b.notes,1000);if(nid)pp.national_id_last4=nid.slice(-4);const {error:ppe}=await db.from("employee_payroll_profiles").update(pp).eq("id",o.profile_id);if(ppe)throw ppe;}const {error:me}=await db.from("payroll_master_rows").update(patch).eq("id",id);if(me)throw me;if(o.profile_id&&Array.isArray(b.rates))await syncRates(Number(o.profile_id),b.rates,u.id,month);await log(u.id,o.profile_id,"UPDATE_PAYROLL_ROW","master_row",null,{id,source_month:month,fields:Object.keys(patch),national_id_last4:nid?nid.slice(-4):undefined});return J({ok:true,employee:await rowEmp(id)})}
if(a==="create_employee"){const month=await currentMonth();const name=clean(b.employee_name,200),nid=digits(b.national_id),site=clean(b.site_name,250),bank=clean(b.bank_name,100),acct=clean(b.bank_account,100);const rate=Number(b.rate_per_unit),work=b.work_count===""||b.work_count==null?null:Math.max(0,Number(b.work_count)),special=Math.max(0,Number(b.special_amount||0)),advance=Math.max(0,Number(b.advance_deduction||0)),shirt=Math.max(0,Number(b.shirt_cost||0));if(!name)return J({error:"EMPLOYEE_NAME_REQUIRED"},400);if(nid.length!==13)return J({error:"NATIONAL_ID_MUST_BE_13_DIGITS"},400);if(!site)return J({error:"SITE_REQUIRED"},400);if(!bank)return J({error:"BANK_REQUIRED"},400);if(!acct)return J({error:"BANK_ACCOUNT_REQUIRED"},400);if(!Number.isFinite(rate))return J({error:"RATE_REQUIRED"},400);const {data:dup,error:de}=await db.from("payroll_master_rows").select("id").eq("source_month",month).eq("is_active",true).eq("national_id",nid).limit(1);if(de)throw de;if((dup||[]).length)return J({error:"NATIONAL_ID_DUPLICATE"},409);let pid:number|null=null;let mid:number|null=null;try{const {data:p,error:pe}=await db.from("employee_payroll_profiles").insert({employee_name:name,site_name:site,rate_per_unit:rate,bank_name:bank,bank_account:acct,national_id:null,national_id_last4:nid.slice(-4),phone:clean(b.phone,50),notes:clean(b.notes,1000),source_month:"MANUAL",source_updated_at:new Date().toISOString(),is_active:true}).select("id").single();if(pe)throw pe;pid=Number(p.id);const {data:m,error:mqe}=await db.from("payroll_master_rows").select("id,source_row").eq("profile_id",pid).eq("source_month",month).maybeSingle();if(mqe)throw mqe;if(!m)throw Error("MASTER_ROW_TRIGGER_MISSING");mid=Number(m.id);const {error:ue}=await db.from("payroll_master_rows").update({employee_name:name,national_id:nid,site_name:site,work_count:work,rate_per_unit:rate,special_amount:special,advance_deduction:advance,shirt_cost:shirt,bank_name:bank,bank_account:acct,is_active:true,updated_at:new Date().toISOString()}).eq("id",mid);if(ue)throw ue;if(Array.isArray(b.rates)&&b.rates.length)await syncRates(pid,b.rates,u.id,month);else await syncRates(pid,[{site_name:site,rate_amount:rate,work_count:work,is_active:true}],u.id,month);const saved=await rowEmp(mid);if(!saved||digits(saved.national_id).length!==13||saved.profile_id!==pid)throw Error("CREATE_VERIFY_FAILED");await log(u.id,pid,"CREATE_EMPLOYEE","profile",null,{employee_name:name,source_month:month,source_row:saved.source_row,national_id_last4:nid.slice(-4)});return J({ok:true,employee:saved});}catch(e){if(mid)await db.from("payroll_master_rows").delete().eq("id",mid);if(pid){await db.from("payroll_master_rows").delete().eq("profile_id",pid);await db.from("employee_payroll_profiles").delete().eq("id",pid);}throw e;}}
if(a==="add_rate"){const row=await rowEmp(Number(b.payroll_master_row_id||b.id));if(!row?.profile_id)return J({error:"PROFILE_REQUIRED_FOR_RATE"},400);if(!row.period_open)return J({error:"PAYROLL_PERIOD_CLOSED"},409);const rate=Number(b.rate_amount),site=clean(b.site_name,250);const {data,error}=await db.from("employee_pay_rates").insert({payroll_profile_id:row.profile_id,site_name:site,rate_amount:rate,rate_type:"per_unit",source_month:"MANUAL",is_active:true,updated_at:new Date().toISOString()}).select().single();if(error)throw error;return J({ok:true,rate:data})}
if(a==="add_adjustment"){const row=await rowEmp(Number(b.payroll_master_row_id||b.id));if(!row?.profile_id)return J({error:"PROFILE_REQUIRED_FOR_ADJUSTMENT"},400);if(!row.period_open)return J({error:"PAYROLL_PERIOD_CLOSED"},409);const amount=Number(b.amount),type=String(b.adjustment_type||"").toUpperCase();const {data,error}=await db.from("employee_payroll_adjustments").insert({payroll_profile_id:row.profile_id,period_start:b.period_start,period_end:b.period_end,adjustment_type:type,amount,note:clean(b.note),is_active:true,created_by_user_id:u.id,updated_at:new Date().toISOString()}).select().single();if(error)throw error;return J({ok:true,adjustment:data})}
return J({error:"UNKNOWN_ACTION"},400)}catch(e){const m=e instanceof Error?e.message:String(e);const status=m==="LINE_NOT_LINKED"?403:m.includes("DENIED")?403:m.includes("AUTH")?401:m.includes("REQUIRED")||m.includes("DUPLICATE")?400:500;return J({error:m},status)}});
