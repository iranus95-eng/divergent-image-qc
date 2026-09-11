const {readFileSync}=require('node:fs');
const {stripTypeScriptTypes}=require('node:module');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=readFileSync(path.join(root,'index.html'),'utf8');
for(const [,code] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) new vm.Script(code);
JSON.parse(readFileSync(path.join(root,'vercel.json'),'utf8'));
let handler,role=1;
const calls=[];
const rows=[{base_salary:0,social_security:0,advance_deduction:182.98,net_paid:-182.98,salary_pending:true},
  {base_salary:0,social_security:0,advance_deduction:20,net_paid:-20,salary_pending:true}];
const db={from(table){return {select(){return this},eq(){return this},async maybeSingle(){
  return {data:table==='app_sessions'?{user_id:role,is_active:true,expires_at:'2099-01-01'}:
    {id:role,is_active:true,expires_at:'2099-01-01'}};
}}},async rpc(name,args){calls.push([name,args]);return {data:name==='staff_payroll_report_rows'?rows:0}}};
let source=readFileSync(path.join(root,'supabase/functions/staff-payroll-report-api/index.ts'),'utf8');
source=source.replace(/^import .*\n/,'').replace('export function payrollSummary','function payrollSummary');
vm.runInNewContext(stripTypeScriptTypes(source),{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},
  Response,Request,fetch:()=>{throw Error('unexpected external request')},Intl,Date,console:{error(){}}});
const req=(body,token)=>new Request('https://example.test',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
(async()=>{
  assert.equal((await handler(req({action:'staff_payroll_rows',month:'2026-09'}))).status,401);
  role=2;
  assert.equal((await handler(req({action:'staff_payroll_rows',month:'2026-09'},'other-user'))).status,403);
  role=1;
  assert.equal((await handler(req({action:'staff_payroll_rows',month:'2026-13'},'owner'))).status,400);
  assert.equal((await handler(req({action:'summary',month:'2026-09'},'owner'))).status,400);
  const response=await handler(req({action:'staff_payroll_rows',month:'2026-09'},'owner'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.summary.staff_advance_deduction,202.98);
  assert.equal(data.summary.staff_payroll_net,-202.98);
  assert.equal(data.summary.salary_pending,true);
  assert(calls.some(([name,args])=>name==='staff_payroll_report_rows'&&args.p_month==='2026-09-01'));
  console.log('PASS: inline syntax, config, API authentication, authorization, month validation, summary and route isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
