import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const headers={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const channelId="2011407195";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});

function randomToken(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}

async function getLineProfile(req:Request){
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)throw new Error("MISSING_LINE_ACCESS_TOKEN");
  const verifyResponse=await fetch("https://api.line.me/oauth2/v2.1/verify?access_token="+encodeURIComponent(token));
  const verify=await verifyResponse.json().catch(()=>({}));
  if(!verifyResponse.ok||String(verify?.client_id||"")!==channelId||!(Number(verify?.expires_in)>0))throw new Error("LINE_AUTH_FAILED");
  const profileResponse=await fetch("https://api.line.me/v2/profile",{headers:{Authorization:"Bearer "+token}});
  const profile=await profileResponse.json().catch(()=>({}));
  if(!profileResponse.ok||!profile?.userId)throw new Error("LINE_AUTH_FAILED");
  return profile;
}

async function userFromEmployeeSession(token:string){
  if(!token)return null;
  const {data:session,error}=await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token",token).maybeSingle();
  if(error)throw error;
  if(!session||!session.is_active||!session.expires_at||new Date(session.expires_at).getTime()<=Date.now())return null;
  const {data:user,error:userError}=await db.from("app_users").select("id,username,role,is_active,expires_at,line_user_id,line_display_name").eq("id",session.user_id).maybeSingle();
  if(userError)throw userError;
  return user;
}

async function startLineLink(sessionToken:string){
  const user=await userFromEmployeeSession(sessionToken);
  if(!user)return json({error:"EMPLOYEE_SESSION_REQUIRED"},401);
  if(user.is_active!==true)return json({error:"USER_DISABLED"},403);
  if(user.expires_at&&new Date(user.expires_at).getTime()<=Date.now())return json({error:"USER_EXPIRED"},403);
  const flowToken=randomToken();
  const flowHash=await sha256(flowToken);
  const expiresAt=new Date(Date.now()+10*60*1000).toISOString();
  const {error}=await db.from("line_link_flows").insert({flow_token_hash:flowHash,user_id:user.id,expires_at:expiresAt});
  if(error)throw error;
  return json({ok:true,flow_token:flowToken,expires_at:expiresAt});
}

async function userFromLineFlow(flowToken:string){
  if(!flowToken)return null;
  const flowHash=await sha256(flowToken);
  const {data:flow,error}=await db.from("line_link_flows")
    .select("id,user_id,expires_at,used_at")
    .eq("flow_token_hash",flowHash).maybeSingle();
  if(error)throw error;
  if(!flow||flow.used_at||new Date(flow.expires_at).getTime()<=Date.now())return null;
  const {data:claimed,error:claimError}=await db.from("line_link_flows")
    .update({used_at:new Date().toISOString()}).eq("id",flow.id).is("used_at",null).select("id").maybeSingle();
  if(claimError)throw claimError;
  if(!claimed)return null;
  const {data:user,error:userError}=await db.from("app_users")
    .select("id,username,role,is_active,expires_at,line_user_id,line_display_name")
    .eq("id",flow.user_id).maybeSingle();
  if(userError)throw userError;
  return user?{user,flowId:flow.id}:null;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({}));
    if(String(body?.action||"")==="start")return await startLineLink(String(body?.session_token||""));

    const profile=await getLineProfile(req);
    let user=await userFromEmployeeSession(String(body?.session_token||""));
    let flowId:number|null=null;

    if(!user&&body?.flow_token){
      const flow=await userFromLineFlow(String(body.flow_token));
      if(!flow)return json({error:"LINE_LINK_FLOW_INVALID"},401);
      user=flow.user;
      flowId=flow.flowId;
    }

    // Backward-compatible fallback for older clients.
    if(!user){
      const username=String(body?.username||"").trim().toLowerCase();
      const password=String(body?.password||"");
      if(!username||!password)return json({error:"EMPLOYEE_SESSION_REQUIRED"},401);
      const {data,error}=await db.from("app_users").select("id,username,password_hash,role,is_active,expires_at,line_user_id,line_display_name").ilike("username",username).maybeSingle();
      if(error)throw error;
      if(!data||!data.password_hash||!await bcrypt.compare(password,data.password_hash))return json({error:"INVALID_CREDENTIALS"},401);
      user=data;
    }

    if(user.is_active!==true)return json({error:"USER_DISABLED"},403);
    if(user.expires_at&&new Date(user.expires_at).getTime()<=Date.now())return json({error:"USER_EXPIRED"},403);
    const {data:owner,error:ownerError}=await db.from("app_users").select("id,username").eq("line_user_id",profile.userId).neq("id",user.id).maybeSingle();
    if(ownerError)throw ownerError;
    if(owner)return json({error:"LINE_ALREADY_LINKED",linked_username:owner.username},409);
    if(user.line_user_id&&user.line_user_id!==profile.userId)return json({error:"USER_ALREADY_LINKED"},409);

    const {data:updated,error:updateError}=await db.from("app_users")
      .update({line_user_id:profile.userId,line_display_name:String(profile.displayName||"").slice(0,120),last_seen_at:new Date().toISOString()})
      .eq("id",user.id)
      .select("id,username,role,is_active,expires_at,line_user_id,line_display_name")
      .single();
    if(updateError)throw updateError;
    let sessionToken="";
    if(flowId!==null){
      sessionToken=randomToken();
      const {error:sessionError}=await db.from("app_sessions").insert({user_id:user.id,token:sessionToken,expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString(),is_active:true});
      if(sessionError)throw sessionError;
    }
    return json({ok:true,user:updated,session_token:sessionToken||undefined});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const status=["MISSING_LINE_ACCESS_TOKEN","LINE_AUTH_FAILED"].includes(message)?401:500;
    console.error("user-bind-line",message);
    return json({error:status===500?"SERVER_ERROR":message},status);
  }
});
